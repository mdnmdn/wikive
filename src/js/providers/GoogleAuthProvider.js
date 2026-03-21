// Google Identity Services implementation of AuthProvider
class GoogleAuthProvider extends AuthProvider {
  constructor(config) {
    super();
    this._config = config;
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this._onAuthChange = null;
  }

  init(onAuthChange) {
    this._onAuthChange = onAuthChange;

    (window.googleReady || Promise.resolve()).then(() => {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this._config.GOOGLE_CLIENT_ID,
        scope: this._config.SCOPE,
        callback: (response) => this._handleTokenResponse(response),
      });

      const saved = sessionStorage.getItem('wiki_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiry > Date.now()) {
          this.accessToken = parsed.token;
          this.tokenExpiry = parsed.expiry;
          this.user = parsed.user;
          this._onAuthChange(true);
        } else {
          sessionStorage.removeItem('wiki_auth');
        }
      }
    });
  }

  login() {
    if (!this.tokenClient) {
      console.warn('Google Identity Services not ready yet');
      return;
    }
    this.tokenClient.requestAccessToken();
  }

  logout() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken);
    }
    this.accessToken = null;
    this.tokenExpiry = null;
    this.user = null;
    sessionStorage.removeItem('wiki_auth');
    CacheService.clear();
    this._onAuthChange(false);
  }

  getToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }
    this.login();
    return null;
  }

  isLoggedIn() {
    return this.accessToken && this.tokenExpiry > Date.now();
  }

  async _handleTokenResponse(response) {
    if (response.error) {
      console.error('Auth error:', response.error);
      return;
    }

    this.accessToken = response.access_token;
    this.tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;

    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      this.user = await res.json();
    } catch (e) {
      this.user = { name: 'User', picture: '' };
    }

    sessionStorage.setItem('wiki_auth', JSON.stringify({
      token: this.accessToken,
      expiry: this.tokenExpiry,
      user: this.user,
    }));

    this._onAuthChange(true);
  }
}
