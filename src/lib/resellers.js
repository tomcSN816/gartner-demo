// Fake resellers for the demo login. `logikLayout` values are placeholders:
// rename them to match the layouts that exist in the Logik tenant.
export const RESELLER_COOKIE = 'reseller';

export const DEFAULT_THEME = {
  '--accent': '#0b5fff',
  '--accent-tint': '#e8f0ff',
  '--bg': '#f5f6f8',
  '--surface': '#ffffff',
  '--text': '#1a1a1a',
  '--muted': '#4a5160',
  '--border': '#e2e5ea',
};

export const RESELLERS = [
  {
    id: 'northwind',
    name: 'Northwind Technologies',
    tagline: 'Enterprise IT, delivered.',
    initials: 'NW',
    logikLayout: 'layoutNorthwind',
    theme: {
      '--accent': '#0b5fff',
      '--accent-tint': '#e8f0ff',
      '--bg': '#f5f6f8',
      '--surface': '#ffffff',
      '--text': '#1a1a1a',
      '--muted': '#4a5160',
      '--border': '#e2e5ea',
    },
  },
  {
    id: 'contoso-cloud',
    name: 'Contoso Cloud',
    tagline: 'Your partner in the cloud.',
    initials: 'CC',
    logikLayout: 'layoutContoso',
    theme: {
      '--accent': '#0f8a5f',
      '--accent-tint': '#e3f5ee',
      '--bg': '#f3f7f5',
      '--surface': '#ffffff',
      '--text': '#12261f',
      '--muted': '#46584f',
      '--border': '#d9e4de',
    },
  },
  {
    id: 'apex-systems',
    name: 'Apex Systems',
    tagline: 'Solutions at the summit.',
    initials: 'AS',
    logikLayout: 'layoutApex',
    theme: {
      '--accent': '#e05a00',
      '--accent-tint': '#fff0e5',
      '--bg': '#faf6f2',
      '--surface': '#ffffff',
      '--text': '#2a1c12',
      '--muted': '#6a5646',
      '--border': '#ecdfd3',
    },
  },
];

export function getReseller(id) {
  return RESELLERS.find((r) => r.id === id) || null;
}

// Resolve the embedded configurator's look. URL params win over the login
// cookie so the page URL visibly drives the theme:
//   ?reseller=<id>   -> that reseller's --lgk-* colour tokens (and its layout)
//   ?layout=<name>   -> Logik layout sent as layout=<name> on tenant calls
export function resolveConfiguratorStyle(cookieReseller, searchParams = {}) {
  const urlReseller = getReseller(searchParams.reseller);
  const base = urlReseller || cookieReseller;
  const urlLayout = typeof searchParams.layout === 'string' ? searchParams.layout : '';
  return {
    layout: urlLayout || base.logikLayout,
    tokens: getLogikTokens(base),
    // What the configurator is actually using; written to the address bar on Customize.
    active: { reseller: base.id, layout: urlLayout || base.logikLayout },
    params: {
      ...(urlReseller && { reseller: urlReseller.id }),
      ...(urlLayout && { layout: urlLayout }),
    },
  };
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) =>
    Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * (1 + amount))));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

// Logik theme tokens (--lgk-*) derived from the reseller's portal palette, so
// the embedded CPQ UI matches the portal chrome.
export function getLogikTokens(reseller) {
  const t = reseller.theme;
  const accent = t['--accent'];
  const tint = t['--accent-tint'];
  const hover = shade(accent, -0.15);
  const dark = shade(accent, -0.3);
  const mid = shade(accent, 0.2);
  const soft = shade(accent, 0.45);
  const rgb = parseInt(accent.slice(1), 16);
  const focusRing = `rgba(${(rgb >> 16) & 255}, ${(rgb >> 8) & 255}, ${rgb & 255}, 0.15)`;
  return {
    'palette-primary-50': tint,
    'palette-primary-100': tint,
    'palette-primary-200': shade(tint, -0.06),
    'palette-primary-300': soft,
    'palette-primary-400': mid,
    'palette-primary-500': accent,
    'palette-primary-600': hover,
    'palette-primary-700': dark,
    'palette-primary-800': shade(accent, -0.45),
    'palette-primary-900': shade(accent, -0.6),
    'palette-primary-950': shade(accent, -0.7),
    'palette-primary-hover': hover,
    'palette-primary-disabled': soft,
    'root-backgroundColor': t['--bg'],
    'root-color': t['--text'],
    // Component tokens with hard-coded colors that ignore the palette.
    'Checkbox-checked-backgroundColor': accent,
    'Checkbox-hover-backgroundColor': shade(tint, -0.06),
    'Combobox-optionFocused-backgroundColor': shade(tint, -0.06),
    'Dropdown-optionFocused-backgroundColor': shade(tint, -0.06),
    'Input-hover-backgroundColor': shade(tint, -0.06),
    'Input-hover-border': `1px solid ${accent}`,
    'Input-focus-borderColor': accent,
    'Input-focus-box-shadow': `inset 0 0 0 1px ${accent}, 0 0 0 4px ${focusRing}`,
    'Input-focus-outline': `1px auto ${accent}`,
    'PicklistGrid-bodyCell-hover-backgroundColor': tint,
    'TabPanel-active-color': hover,
    'TabPanel-active-borderBottomColor': accent,
    'TabPanel-active-hover-color': hover,
    'TabPanel-hover-color': dark,
    'TabPanel-vertical-active-backgroundColor': tint,
    'TabPanel-vertical-hover-backgroundColor': tint,
    'TabPanel-vertical-hover-color': hover,
  };
}
