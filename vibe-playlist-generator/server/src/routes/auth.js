// Spotify OAuth Authorization Code Flow.
//
// Flow:
//   1. GET /api/auth/login
//        - Create a random state, stash it on the session, 302 to Spotify
//   2. GET /api/auth/callback?code=...&state=...
//        - Verify state, exchange code for tokens, stash on session,
//          redirect back to the frontend
//   3. GET /api/auth/me    — who is logged in?
//   4. POST /api/auth/logout

const express = require('express');
const crypto = require('crypto');
const qs = require('querystring');

const config = require('../config');
const {
  exchangeCodeForTokens,
  getMe,
} = require('../services/spotifyService');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const authUrl =
    `${config.spotify.accountsBase}/authorize?` +
    qs.stringify({
      response_type: 'code',
      client_id: config.spotify.clientId,
      scope: config.spotify.scopes,
      redirect_uri: config.spotify.redirectUri,
      state,
      show_dialog: 'false',
    });

  res.redirect(authUrl);
});

router.get('/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(
        `${config.clientUrl}/?auth_error=${encodeURIComponent(String(error))}`
      );
    }

    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect(`${config.clientUrl}/?auth_error=state_mismatch`);
    }

    delete req.session.oauthState;

    const tokens = await exchangeCodeForTokens(String(code));

    req.session.spotify = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    };

    res.redirect(`${config.clientUrl}/?auth=ok`);
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await getMe(req.accessToken);
    res.json({
      id: profile.id,
      displayName: profile.display_name,
      email: profile.email,
      product: profile.product,
      image: profile.images?.[0]?.url || null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('vibe.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
