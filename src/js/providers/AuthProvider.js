// Base class for authentication providers
// All methods throw by default — providers must override what they support.
class AuthProvider {
  constructor() {
    this.user = null;
  }

  init(onAuthChange) { throw new Error('Not implemented: init'); }
  login() { throw new Error('Not implemented: login'); }
  logout() { throw new Error('Not implemented: logout'); }
  getToken() { throw new Error('Not implemented: getToken'); }
  isLoggedIn() { throw new Error('Not implemented: isLoggedIn'); }
}
