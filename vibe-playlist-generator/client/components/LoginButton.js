import { api } from '../lib/api';

export default function LoginButton() {
  // Full-page redirect — the backend sets the OAuth state cookie before
  // sending the user to Spotify, so we can't use fetch() for this step.
  return (
    <a className="btn" href={api.loginUrl()}>
      Connect Spotify
    </a>
  );
}
