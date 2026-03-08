// Google Identity Services wrapper
const AuthService = {
  tokenClient: null,
  accessToken: null,
  tokenExpiry: null,
  user: null,

  init(onAuthChange) {
    this._onAuthChange = onAuthChange;

    // Wait for Google Identity Services to load
    (window.googleReady || Promise.resolve()).then(() => {
      // Initialize Google Identity Services
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.SCOPE,
        callback: (response) => this._handleTokenResponse(response),
      });

      // Check for existing session
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
  },

  login() {
    if (!this.tokenClient) {
      console.warn('Google Identity Services not ready yet');
      return;
    }
    this.tokenClient.requestAccessToken();
  },

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
  },

  getToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }
    // Token expired - trigger re-auth
    this.login();
    return null;
  },

  isLoggedIn() {
    return this.accessToken && this.tokenExpiry > Date.now();
  },

  async _handleTokenResponse(response) {
    if (response.error) {
      console.error('Auth error:', response.error);
      return;
    }

    this.accessToken = response.access_token;
    // Token valid for ~1 hour, set expiry slightly early
    this.tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;

    // Fetch user info
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      this.user = await res.json();
    } catch (e) {
      this.user = { name: 'User', picture: '' };
    }

    // Save session
    sessionStorage.setItem('wiki_auth', JSON.stringify({
      token: this.accessToken,
      expiry: this.tokenExpiry,
      user: this.user,
    }));

    this._onAuthChange(true);
  },
};
