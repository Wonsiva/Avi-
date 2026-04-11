import TrackCard from './TrackCard';

export default function TrackList({ tracks }) {
  if (!tracks?.length) return null;
  return (
    <div className="track-list">
      {tracks.map((t, i) => (
        <TrackCard key={`${t.track.id}-${i}`} {...t} />
      ))}
    </div>
  );
}
