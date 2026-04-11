// Single row in the result list. Uses plain <img> so it works without
// configuring next/image loaders for every Spotify CDN host.

function fmtTempo(t) {
  if (!t) return '—';
  return `${Math.round(t)} BPM`;
}

function fmtPercent(v) {
  if (v == null) return '—';
  return `${Math.round(v * 100)}`;
}

export default function TrackCard({ track, features }) {
  return (
    <div className="track">
      <img
        src={track.album?.image || '/placeholder.png'}
        alt={track.album?.name || track.name}
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden';
        }}
      />

      <div className="track-main">
        <a
          className="track-name"
          href={track.url}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--text)' }}
        >
          {track.name}
        </a>
        <div className="track-artist">
          {(track.artists || []).map((a) => a.name).join(', ')}
        </div>
      </div>

      <div className="track-stats">
        <span>
          <strong>{fmtTempo(features?.tempo)}</strong>
        </span>
        <span>
          E <strong>{fmtPercent(features?.energy)}</strong>
        </span>
        <span>
          D <strong>{fmtPercent(features?.danceability)}</strong>
        </span>
      </div>
    </div>
  );
}
