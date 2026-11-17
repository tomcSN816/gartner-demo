import './globals.css';
import Nav from '@/components/Nav';
import { getCurrentReseller } from '@/lib/session';

export const metadata = {
  title: 'Ordering Portal',
  description: 'Generic ordering portal',
};

export default function RootLayout({ children }) {
  const reseller = getCurrentReseller();
  return (
    <html lang="en">
      {/* Theme vars as a stylesheet too: the embedded UX framework can wipe the
          body's inline style, which dropped the page back to the default blue. */}
      {reseller && (
        <head>
          <style>{`:root:root{${Object.entries(reseller.theme).map(([k, v]) => `${k}:${v}`).join(';')}}`}</style>
        </head>
      )}
      <body style={reseller?.theme}>
        <Nav
          reseller={reseller && { name: reseller.name, initials: reseller.initials }}
        />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
