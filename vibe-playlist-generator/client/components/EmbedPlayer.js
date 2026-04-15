// Spotify's track embed only plays one item at a time, but when we save a
// playlist we get a real playlist embed. Use whichever is available.

export default function EmbedPlayer({ playlistId, firstTrackId }) {
  const src = playlistId
    ? `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`
    : firstTrackId
    ? `https://open.spotify.com/embed/track/${firstTrackId}?utm_source=generator&theme=0`
    : null;

  if (!src) return null;

  return (
    <div className="embed">
      <iframe
        src={src}
        width="100%"
        height={playlistId ? 380 : 152}
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title="Spotify player"
      />
    </div>
  );
}
