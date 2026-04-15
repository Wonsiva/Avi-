import { useEffect, useState } from 'react';
import Head from 'next/head';

import { api } from '../lib/api';
import LoginButton from '../components/LoginButton';
import VibeForm from '../components/VibeForm';
import TrackList from '../components/TrackList';
import EmbedPlayer from '../components/EmbedPlayer';

export default function Home() {
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [result, setResult] = useState(null); // { meta, tracks }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // { id, url }

  // On mount, check whether the user is already logged in. The backend's
  // session cookie is httpOnly so we can't read it from JS — we just ask.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setMeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runRequest(fn, args) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const data = await fn(args);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Request failed.');
      if (err.status === 401) setMe(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!result?.tracks?.length) return;
    setBusy(true);
    setError(null);
    try {
      const uris = result.tracks.map((t) => t.track.uri).filter(Boolean);
      const name = buildPlaylistName(result.meta);
      const description = buildPlaylistDescription(result.meta);
      const data = await api.savePlaylist({
        name,
        description,
        uris,
        isPublic: false,
      });
      setSaved(data);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await api.logout();
    setMe(null);
    setResult(null);
    setSaved(null);
  }

  return (
    <>
      <Head>
        <title>Vibe Playlist Generator</title>
        <meta
          name="description"
          content="Curated Spotify playlists tuned for Afro House, Melodic Tech and Deep House vibes."
        />
      </Head>

      <div className="container">
        <header className="header">
          <div className="brand">
            <div className="brand-mark">V</div>
            <div>
              <h1>Vibe Playlist Generator</h1>
              <small>curated sets for Afro House · Melodic Tech · Deep House</small>
            </div>
          </div>

          <div className="profile">
            {meLoading ? null : me ? (
              <>
                {me.image ? <img src={me.image} alt={me.displayName} /> : null}
                <span>{me.displayName}</span>
                <button className="btn ghost" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <LoginButton />
            )}
          </div>
        </header>

        {!me && !meLoading ? (
          <div className="panel empty">
            <h3>Connect Spotify to start generating playlists</h3>
            <p>
              We use the official Spotify Web API. Your tokens are stored in a
              secure httpOnly session cookie and never exposed to the browser.
            </p>
            <div style={{ marginTop: 18 }}>
              <LoginButton />
            </div>
          </div>
        ) : null}

        {me ? (
          <div className="grid">
            <VibeForm
              loading={busy}
              onGenerate={(payload) => runRequest(api.generate, payload)}
              onDjSet={(payload) => runRequest(api.djSet, payload)}
              onTrackAlike={(payload) => runRequest(api.trackAlike, payload)}
            />

            <section className="panel">
              <h2>Result</h2>

              {error ? <div className="banner err">{error}</div> : null}

              {saved ? (
                <div className="banner ok">
                  Saved to Spotify:&nbsp;
                  <a href={saved.url} target="_blank" rel="noreferrer">
                    {saved.name}
                  </a>
                </div>
              ) : null}

              {!result && !busy ? (
                <div className="empty">
                  <h3>No playlist yet</h3>
                  <p>
                    Pick a vibe and hit <strong>Generate playlist</strong>. Try
                    DJ Set Mode for a smooth-flow set.
                  </p>
                </div>
              ) : null}

              {busy && !result ? (
                <div className="empty">
                  <h3>Generating…</h3>
                  <p>Asking Spotify for the good stuff.</p>
                </div>
              ) : null}

              {result ? (
                <>
                  <MetaPills meta={result.meta} />

                  <div className="stack" style={{ marginBottom: 14 }}>
                    <button
                      className="btn"
                      onClick={handleSave}
                      disabled={busy || !result.tracks.length}
                    >
                      Save Playlist to My Spotify Account
                    </button>
                  </div>

                  <TrackList tracks={result.tracks} />

                  <EmbedPlayer
                    playlistId={saved?.id}
                    firstTrackId={result.tracks?.[0]?.track?.id}
                  />
                </>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}

function MetaPills({ meta }) {
  if (!meta) return null;
  const pills = [];
  if (meta.genre) pills.push(meta.genre);
  if (meta.mood) pills.push(meta.mood);
  if (typeof meta.energy === 'number') pills.push(`energy ${meta.energy}/10`);
  if (meta.bpm) pills.push(`${meta.bpm.min}-${meta.bpm.max} BPM`);
  if (meta.label) pills.push(`label: ${meta.label}`);
  if (meta.underground) pills.push('underground');
  if (meta.djSet) pills.push('DJ Set');
  if (meta.source)
    pills.push(`similar to: ${meta.source.artist} — ${meta.source.name}`);

  return (
    <div className="meta-pills">
      {pills.map((p, i) => (
        <span key={i} className={`pill ${i === 0 ? 'accent' : ''}`}>
          {p}
        </span>
      ))}
    </div>
  );
}

function buildPlaylistName(meta) {
  if (!meta) return 'Vibe Playlist';
  const parts = [];
  if (meta.genre) parts.push(meta.genre);
  if (meta.mood) parts.push(meta.mood);
  if (meta.djSet) parts.push('DJ Set');
  if (meta.source) parts.push('inspired');
  return parts.join(' · ') || 'Vibe Playlist';
}

function buildPlaylistDescription(meta) {
  if (!meta) return 'Generated by Vibe Playlist Generator';
  const bits = ['Generated by Vibe Playlist Generator'];
  if (meta.genre) bits.push(meta.genre);
  if (meta.mood) bits.push(meta.mood);
  if (meta.underground) bits.push('underground bias');
  if (meta.label) bits.push(`${meta.label} style`);
  return bits.join(' • ');
}
