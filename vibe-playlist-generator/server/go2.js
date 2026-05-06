require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const axios = require('axios');
const qs = require('querystring');
const config = require('./src/config');
const authRouter = require('./src/routes/auth');
const playlistRouter = require('./src/routes/playlist');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({ name: 'vibe.sid', secret: config.sessionSecret, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 86400000 } }));

// --- Client credentials token for search (bypasses OAuth token issues) ---
let ccToken = null, ccExp = 0;
async function getSearchToken() {
  if (ccToken && Date.now() < ccExp) return ccToken;
  const auth = Buffer.from(config.spotify.clientId + ':' + config.spotify.clientSecret).toString('base64');
  const r = await axios.post('https://accounts.spotify.com/api/token', qs.stringify({ grant_type: 'client_credentials' }), { headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' } });
  ccToken = r.data.access_token;
  ccExp = Date.now() + (r.data.expires_in - 60) * 1000;
  return ccToken;
}

async function searchTracks(query, limit) {
  const token = await getSearchToken();
  const r = await axios.get('https://api.spotify.com/v1/search', { headers: { Authorization: 'Bearer ' + token }, params: { q: query, type: 'track', limit: limit || 20 } });
  return r.data.tracks?.items || [];
}

const PRESETS = {
  'afro-house': { label: 'Afro House', artists: ['Keinemusik', '&ME', 'Black Coffee', 'Rampa', 'Adam Port'] },
  'melodic-tech': { label: 'Melodic Tech', artists: ['Mind Against', 'Tale Of Us', 'Adriatique', 'Massano', 'Anyma'] },
  'deep-house': { label: 'Deep House', artists: ['Lane 8', 'Yotto', 'Ben Bohmer', 'Nora En Pure', 'Dixon'] },
  'organic-house': { label: 'Organic House', artists: ['Bedouin', 'Acid Pauli', 'YokoO', 'Be Svendsen', 'Monolink'] },
};
const LABELS = {
  moblack: { label: 'MoBlack Records', artists: ['MoBlack', 'Caiiro', 'Enoo Napa', 'Manoo', 'Atmos Blaq'] },
  keinemusik: { label: 'Keinemusik', artists: ['Keinemusik', '&ME', 'Rampa', 'Adam Port', 'Reznik'] },
  'dawn-patrol': { label: 'Dawn Patrol', artists: ['Bedouin', 'Acid Pauli', 'YokoO', 'Be Svendsen'] },
};

function requireLogin(req, res, next) {
  if (!req.session?.spotify?.accessToken) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function norm(t) {
  return { track: { id: t.id, uri: t.uri, name: t.name, url: t.external_urls?.spotify, popularity: t.popularity, artists: (t.artists || []).map(a => ({ id: a.id, name: a.name })), album: { name: t.album?.name, image: t.album?.images?.[0]?.url } }, features: {} };
}

app.get('/', (req, res) => res.type('html').send(PAGE));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/playlist', playlistRouter);

app.post('/api/recommendations/generate', requireLogin, async (req, res) => {
  try {
    const { genre = 'afro-house', mood = 'hypnotic', artistSeed, underground, label, limit = 20 } = req.body || {};
    const preset = PRESETS[genre] || PRESETS['afro-house'];
    const lp = label && LABELS[label] ? LABELS[label] : null;
    const names = [...(lp ? lp.artists : preset.artists).slice(0, 4)];
    if (artistSeed) names.unshift(artistSeed);
    console.log('[vibe] generate: ' + preset.label + ' / ' + mood + ' / seeds: ' + names.slice(0, 5).join(', '));

    let pool = [];
    for (const n of names.slice(0, 5)) {
      try { const t = await searchTracks(n, 15); console.log('[vibe]   ' + n + ' -> ' + t.length + ' tracks'); pool.push(...t); }
      catch (e) { console.log('[vibe]   ' + n + ' FAILED: ' + e.message); }
    }
    try { const t = await searchTracks(preset.label + ' ' + mood, 30); console.log('[vibe]   text -> ' + t.length + ' tracks'); pool.push(...t); }
    catch (e) { console.log('[vibe]   text FAILED: ' + e.message); }

    const seen = new Set();
    pool = pool.filter(t => { if (!t?.id || seen.has(t.id)) return false; seen.add(t.id); return true; });
    if (underground) pool = pool.filter(t => (t.popularity ?? 100) <= 45);
    shuffle(pool);
    const tracks = pool.slice(0, Math.min(100, Number(limit) || 20)).map(norm);
    console.log('[vibe] returning ' + tracks.length + ' tracks');
    res.json({ tracks, meta: { genre: preset.label, mood, underground: !!underground, label: lp?.label || null, trackCount: tracks.length } });
  } catch (e) { console.log('[vibe] generate error:', e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/recommendations/dj-set', requireLogin, async (req, res) => {
  req.body = { ...req.body, limit: Math.min(100, (Number(req.body?.length) || 30) * 2) };
  app.handle(Object.assign(Object.create(Object.getPrototypeOf(req)), req, { url: '/api/recommendations/generate', method: 'POST' }), res);
});

app.use(errorHandler);
app.listen(config.port, () => console.log('[vibe] listening on :' + config.port));

const PAGE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vibe Playlist Generator</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0b0c0f;color:#e9ecf1;font-family:-apple-system,sans-serif;padding:30px}a{color:#ff6a3d}.box{max-width:900px;margin:0 auto}.hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:10px}.hd h1{font-size:20px}.hd small{color:#8a93a6;font-size:12px;display:block}select,input[type=text]{padding:8px;background:#181b22;color:#e9ecf1;border:1px solid #2a2f3a;border-radius:6px;font-size:14px;width:100%;margin-bottom:10px}label{display:block;font-size:11px;color:#8a93a6;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}.btn{padding:12px 20px;background:#ff6a3d;color:#111;border:none;border-radius:7px;font-weight:700;cursor:pointer;font-size:14px;width:100%;margin-bottom:8px}.btn:hover{filter:brightness(1.08)}.btn:disabled{opacity:.5}.btn2{background:transparent;color:#e9ecf1;border:1px solid #2a2f3a}.card{display:flex;gap:12px;align-items:center;border:1px solid #2a2f3a;border-radius:8px;padding:10px;margin-bottom:8px}.card img{width:50px;height:50px;border-radius:5px;background:#21252e}.card .nm{font-weight:600;font-size:14px}.card .ar{font-size:12px;color:#8a93a6}.msg{text-align:center;padding:40px;color:#8a93a6}.msg h3{color:#e9ecf1;margin-bottom:8px}.err{color:#ff5a5a;padding:10px;border:1px solid #ff5a5a;border-radius:6px;margin-bottom:10px}.ok{color:#8ef0c0;padding:10px;border:1px solid #8ef0c0;border-radius:6px;margin-bottom:10px}.pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.pill{font-size:11px;padding:3px 8px;border:1px solid #2a2f3a;border-radius:99px;color:#8a93a6}.pill.a{color:#ff6a3d;border-color:#ff6a3d}#form,#res{background:#121419;border:1px solid #2a2f3a;border-radius:10px;padding:20px}.grid{display:grid;grid-template-columns:320px 1fr;gap:20px}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style></head><body><div class="box"><div class="hd"><div><h1>Vibe Playlist Generator</h1><small>Afro House · Melodic Tech · Deep House</small></div><div id="prof"></div></div><div id="main"></div></div><script>
let me=null,busy=false,err=null,result=null,saved=null;
async function api(p,o={}){const r=await fetch(p,{method:o.method||'GET',headers:o.body?{'Content-Type':'application/json'}:void 0,body:o.body?JSON.stringify(o.body):void 0});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={raw:t}}if(!r.ok){const e=new Error(d?.message||d?.error||r.statusText);e.status=r.status;throw e}return d}
function render(){document.getElementById('prof').innerHTML=me?'<span style="color:#8a93a6;font-size:13px">'+me.displayName+' </span><button class="btn2" style="width:auto;padding:4px 10px;font-size:12px;border-radius:5px;cursor:pointer;background:transparent;color:#e9ecf1;border:1px solid #2a2f3a" onclick="logout()">Log out</button>':'';
if(!me){document.getElementById('main').innerHTML='<div class="msg"><h3>Connect Spotify to start</h3><p style="margin-bottom:16px">Generate curated playlists with one click.</p><a class="btn" style="display:inline-block;width:auto;padding:12px 28px;text-decoration:none" href="/api/auth/login">Connect Spotify</a></div>';return}
document.getElementById('main').innerHTML='<div class="grid"><div id="form"><h3 style="font-size:13px;color:#8a93a6;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Vibe</h3><label>Genre</label><select id="g"><option value="afro-house">Afro House</option><option value="melodic-tech">Melodic Tech</option><option value="deep-house">Deep House</option><option value="organic-house">Organic House</option></select><label>Mood</label><select id="m"><option>hypnotic</option><option>emotional</option><option>dark</option><option>uplifting</option><option>dreamy</option><option>driving</option><option>warm</option></select><label>Artist Seed (optional)</label><input type="text" id="as" placeholder="e.g. Keinemusik"><label>Label Mode</label><select id="lb"><option value="">-- none --</option><option value="moblack">MoBlack Records</option><option value="keinemusik">Keinemusik</option><option value="dawn-patrol">Dawn Patrol</option></select><div style="margin:10px 0"><label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="ug" style="accent-color:#ff6a3d"> <span>Underground bias</span></label></div><div style="height:1px;background:#2a2f3a;margin:14px 0"></div><button class="btn" onclick="gen()" id="genb">Generate Playlist</button><button class="btn btn2" onclick="dj()">DJ Set Mode</button></div><div id="res"><h3 style="font-size:13px;color:#8a93a6;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Result</h3>'+renderRes()+'</div></div>'}
function renderRes(){let h='';if(err)h+='<div class="err">'+err+'</div>';if(saved)h+='<div class="ok">Saved! <a href="'+saved.url+'" target="_blank">Open in Spotify</a></div>';if(!result&&!busy)return h+'<div class="msg"><h3>No playlist yet</h3><p>Pick a vibe and generate.</p></div>';if(busy&&!result)return h+'<div class="msg"><h3>Generating...</h3></div>';if(!result)return h;const{tracks:t,meta:m}=result;h+='<div class="pills">';if(m?.genre)h+='<span class="pill a">'+m.genre+'</span>';if(m?.mood)h+='<span class="pill">'+m.mood+'</span>';h+='</div>';if(!t||!t.length)return h+'<div class="err">No tracks found. Try different settings.</div>';h+='<button class="btn" onclick="sav()">Save to My Spotify</button>';for(const i of t){const k=i.track;h+='<div class="card"><img src="'+(k.album?.image||'')+'" onerror="this.style.visibility=\'hidden\'"><div><div class="nm"><a href="'+(k.url||'#')+'" target="_blank" style="color:#e9ecf1">'+k.name+'</a></div><div class="ar">'+(k.artists||[]).map(a=>a.name).join(', ')+'</div></div></div>'}if(t[0]?.track?.id)h+='<div style="margin-top:16px;border-radius:12px;overflow:hidden;border:1px solid #2a2f3a"><iframe src="https://open.spotify.com/embed/track/'+t[0].track.id+'?theme=0" width="100%" height="152" frameborder="0" allow="autoplay;clipboard-write;encrypted-media" loading="lazy"></iframe></div>';return h}
function gf(){return{genre:el('g'),mood:el('m'),artistSeed:el('as')||void 0,label:el('lb')||null,underground:document.getElementById('ug')?.checked,limit:20}}
function el(id){return document.getElementById(id)?.value}
async function gen(){busy=true;err=null;result=null;saved=null;render();try{result=await api('/api/recommendations/generate',{method:'POST',body:gf()})}catch(e){err=e.message;if(e.status===401)me=null}busy=false;render()}
async function dj(){busy=true;err=null;result=null;saved=null;render();try{result=await api('/api/recommendations/dj-set',{method:'POST',body:{...gf(),length:30}})}catch(e){err=e.message;if(e.status===401)me=null}busy=false;render()}
async function sav(){if(!result?.tracks?.length)return;busy=true;err=null;render();try{const u=result.tracks.map(t=>t.track.uri).filter(Boolean);const n=[result.meta?.genre,result.meta?.mood].filter(Boolean).join(' - ');saved=await api('/api/playlist/save',{method:'POST',body:{name:n||'Vibe Playlist',uris:u}})}catch(e){err=e.message}busy=false;render()}
async function logout(){await api('/api/auth/logout',{method:'POST'});me=null;result=null;saved=null;render()}
async function init(){try{me=await api('/api/auth/me')}catch{}render()}
init();
</script></body></html>`;
