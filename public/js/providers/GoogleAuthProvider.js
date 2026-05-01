// Google Identity Services implementation of AuthProvider
class GoogleAuthProvider extends AuthProvider {
  constructor(config) {
    super();
    this._config = config;
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this._onAuthChange = null;
    this._interactiveFallback = false; // true when retrying after silent-auth failure
  }

  init(onAuthChange) {
    this._onAuthChange = onAuthChange;

    (window.googleReady || Promise.resolve()).then(() => {
      this._initTokenClient();

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
    if (!this.tokenClient) { console.warn('Google Identity Services not ready yet'); return; }
    this.tokenClient.requestAccessToken();
  }

  // Re-auth targeting a specific account. Tries silent first; falls back to interactive.
  loginWithHint(email) {
    if (!this.tokenClient) { console.warn('Google Identity Services not ready yet'); return; }
    this._interactiveFallback = false;
    this._initTokenClient(email);
    this.tokenClient.requestAccessToken({ prompt: 'none' });
  }

  // Clear current session (no revoke) then re-auth with hint.
  switchUser(email) {
    this._clearSession();
    this.loginWithHint(email);
  }

  // Clear current session then show Google account picker.
  addNewUser() {
    this._clearSession();
    this._initTokenClient();
    this.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }

  logout() {
    if (this.accessToken) google.accounts.oauth2.revoke(this.accessToken);
    this._clearSession();
    CacheService.clear();
    this._onAuthChange(false);
  }

  getToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) return this.accessToken;
    this.login();
    return null;
  }

  isLoggedIn() {
    return !!(this.accessToken && this.tokenExpiry > Date.now());
  }

  // Returns all stored known users except the currently active one.
  getKnownUsers() {
    try {
      const all = JSON.parse(localStorage.getItem('wiki_known_users') || '[]');
      return all.filter(u => u.email !== this.user?.email);
    } catch { return []; }
  }

  // ─── private ────────────────────────────────────────────────────────────────

  _initTokenClient(loginHint) {
    const params = {
      client_id: this._config.GOOGLE_CLIENT_ID,
      scope: this._config.SCOPE,
      callback: (response) => this._handleTokenResponse(response),
    };
    if (loginHint) params.login_hint = loginHint;
    this.tokenClient = google.accounts.oauth2.initTokenClient(params);
  }

  _clearSession() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.user = null;
    sessionStorage.removeItem('wiki_auth');
  }

  _saveKnownUser(user) {
    if (!user?.email) return;
    try {
      const stored = JSON.parse(localStorage.getItem('wiki_known_users') || '[]');
      const idx = stored.findIndex(u => u.email === user.email);
      const entry = { email: user.email, name: user.name, picture: user.picture };
      if (idx >= 0) stored[idx] = entry; else stored.push(entry);
      localStorage.setItem('wiki_known_users', JSON.stringify(stored));
    } catch {}
  }

  async _handleTokenResponse(response) {
    if (response.error) {
      // Silent auth failed — retry once with interactive account picker
      if (!this._interactiveFallback &&
          (response.error === 'interaction_required' || response.error === 'login_required')) {
        this._interactiveFallback = true;
        this.tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      }
      // User cancelled or unrecoverable error — fall back to login screen
      this._clearSession();
      this._onAuthChange(false);
      return;
    }

    this._interactiveFallback = false;
    this.accessToken = response.access_token;
    this.tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;

    try {
      // Use the Drive about endpoint — always accessible with drive.file scope and
      // reliably returns displayName, emailAddress, and photoLink (unlike userinfo
      // which requires additional scopes).
      const res = await fetch(`${this._config.DRIVE_API}/about?fields=user`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      const data = await res.json();
      const u = data.user || {};
      this.user = {
        id: u.permissionId || '',
        email: u.emailAddress || '',
        name: u.displayName || 'User',
        picture: (u.photoLink || '').replace(/=s\d+$/, '=s96'),
      };
    } catch {
      this.user = { id: '', email: '', name: 'User', picture: '' };
    }

    sessionStorage.setItem('wiki_auth', JSON.stringify({
      token: this.accessToken,
      expiry: this.tokenExpiry,
      user: this.user,
    }));

    this._saveKnownUser(this.user);
    this._onAuthChange(true);
  }
}
