// AuthManager facade — delegates to the active AuthProvider
const AuthManager = {
  _provider: null,

  setProvider(provider) {
    this._provider = provider;
  },

  get user() {
    return this._provider?.user || null;
  },

  set user(val) {
    if (this._provider) this._provider.user = val;
  },

  init(onAuthChange) { return this._provider.init(onAuthChange); },
  login()            { return this._provider.login(); },
  logout()           { return this._provider.logout(); },
  getToken()         { return this._provider.getToken(); },
  isLoggedIn()       { return this._provider.isLoggedIn(); },
};

// Bootstrap auth provider from config
(function bootstrapAuth() {
  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  if (!config) return;
  const provider = config.PROVIDER || 'google-drive';
  if (provider === 'google-drive') {
    AuthManager.setProvider(new GoogleAuthProvider(config));
  }
})();
