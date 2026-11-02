export default function EmbedFrame({ src, title, height = '80vh' }) {
  if (!src) {
    return (
      <div className="embed-empty">
        No embed URL configured. Set it in <code>.env</code> and restart the dev server.
      </div>
    );
  }

  return (
    <iframe
      className="embed-frame"
      src={src}
      title={title}
      style={{ height }}
      allow="clipboard-write"
    />
  );
}
