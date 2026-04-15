import { useState } from 'react';
import Slider from './Slider';

const GENRES = [
  { value: 'afro-house', label: 'Afro House' },
  { value: 'melodic-tech', label: 'Melodic Tech' },
  { value: 'deep-house', label: 'Deep House' },
  { value: 'organic-house', label: 'Organic House' },
];

const MOODS = [
  'hypnotic',
  'emotional',
  'dark',
  'uplifting',
  'dreamy',
  'driving',
  'warm',
];

const LABELS = [
  { value: '', label: '— none —' },
  { value: 'moblack', label: 'MoBlack Records' },
  { value: 'keinemusik', label: 'Keinemusik' },
  { value: 'dawn-patrol', label: 'Dawn Patrol' },
];

/**
 * Controlled form for the vibe input. Owns its state locally so the parent
 * page only has to care about the final generate() call.
 */
export default function VibeForm({ onGenerate, onDjSet, onTrackAlike, loading }) {
  const [genre, setGenre] = useState('afro-house');
  const [mood, setMood] = useState('hypnotic');
  const [energy, setEnergy] = useState(6);
  const [bpmMin, setBpmMin] = useState('');
  const [bpmMax, setBpmMax] = useState('');
  const [artistSeed, setArtistSeed] = useState('');
  const [underground, setUnderground] = useState(false);
  const [label, setLabel] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [mode, setMode] = useState('vibe'); // 'vibe' | 'track'

  function buildPayload() {
    return {
      genre,
      mood,
      energy,
      bpmMin: bpmMin ? Number(bpmMin) : undefined,
      bpmMax: bpmMax ? Number(bpmMax) : undefined,
      artistSeed: artistSeed.trim() || undefined,
      underground,
      label: label || null,
      limit: 20,
    };
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'track') {
      onTrackAlike({ trackUrl: trackUrl.trim(), underground, limit: 20 });
    } else {
      onGenerate(buildPayload());
    }
  }

  function handleDjSet() {
    onDjSet({ ...buildPayload(), length: 30 });
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Vibe</h2>

      <div className="stack" style={{ marginBottom: 16 }}>
        <div className="row">
          <button
            type="button"
            className={`btn ghost ${mode === 'vibe' ? '' : ''}`}
            onClick={() => setMode('vibe')}
            style={{
              flex: 1,
              borderColor: mode === 'vibe' ? 'var(--accent)' : undefined,
              color: mode === 'vibe' ? 'var(--accent)' : undefined,
            }}
          >
            Vibe Form
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setMode('track')}
            style={{
              flex: 1,
              borderColor: mode === 'track' ? 'var(--accent)' : undefined,
              color: mode === 'track' ? 'var(--accent)' : undefined,
            }}
          >
            Track-Alike
          </button>
        </div>
      </div>

      {mode === 'vibe' ? (
        <>
          <div className="field">
            <label>Genre</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              {GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Mood</label>
            <select value={mood} onChange={(e) => setMood(e.target.value)}>
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <Slider label="Energy" value={energy} onChange={setEnergy} />

          <div className="row">
            <div className="field">
              <label>BPM min</label>
              <input
                type="number"
                placeholder="auto"
                value={bpmMin}
                onChange={(e) => setBpmMin(e.target.value)}
              />
            </div>
            <div className="field">
              <label>BPM max</label>
              <input
                type="number"
                placeholder="auto"
                value={bpmMax}
                onChange={(e) => setBpmMax(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Artist seed (optional)</label>
            <input
              placeholder="e.g. Keinemusik"
              value={artistSeed}
              onChange={(e) => setArtistSeed(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Label Mode (optional)</label>
            <select value={label} onChange={(e) => setLabel(e.target.value)}>
              {LABELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <div className="field">
          <label>Spotify track link</label>
          <input
            placeholder="https://open.spotify.com/track/..."
            value={trackUrl}
            onChange={(e) => setTrackUrl(e.target.value)}
          />
        </div>
      )}

      <label className="toggle">
        <input
          type="checkbox"
          checked={underground}
          onChange={(e) => setUnderground(e.target.checked)}
        />
        Bias toward underground artists
      </label>

      <div className="divider" />

      <div className="stack">
        <button type="submit" className="btn block" disabled={loading}>
          {loading ? <span className="loader" /> : null}
          {mode === 'track' ? 'Find similar tracks' : 'Generate playlist'}
        </button>

        {mode === 'vibe' ? (
          <button
            type="button"
            className="btn ghost block"
            onClick={handleDjSet}
            disabled={loading}
          >
            DJ Set Mode
          </button>
        ) : null}
      </div>
    </form>
  );
}
