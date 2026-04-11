// Express entrypoint. Keep this file tiny — actual logic lives in routes/ and
// services/. Middleware order matters: cors → json → session → routes → error.

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const config = require('./config');
const authRouter = require('./routes/auth');
const recommendationsRouter = require('./routes/recommendations');
const playlistRouter = require('./routes/playlist');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(
  session({
    name: 'vibe.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true behind HTTPS in production
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Health check — useful for load balancers and for the frontend to sanity-check
// that the backend is reachable before attempting auth.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'vibe-playlist-server' });
});

app.use('/api/auth', authRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/playlist', playlistRouter);

// 404 for unmatched /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

app.use(errorHandler);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[vibe] server listening on :${config.port}`);
});
