# Configuration

All configuration lives in `config.js` at the project root.

## Settings

```javascript
const CONFIG = {
  GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
  ROOT_FOLDER_NAME: '_wiki',
  CACHE_TTL: 5 * 60 * 1000,
  DRIVE_API: 'https://www.googleapis.com/drive/v3',
  DRIVE_UPLOAD_API: 'https://www.googleapis.com/upload/drive/v3',
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
};
```

### GOOGLE_CLIENT_ID

**Required**. Your OAuth 2.0 Client ID from Google Cloud Console. See [installation.md](installation.md) for setup instructions.

Format: `<numbers>-<hash>.apps.googleusercontent.com`

### ROOT_FOLDER_NAME

Default: `_wiki`

The name of the root folder created in the user's Google Drive. Change this to use a different folder name. The folder is created in the Drive root on first login.

If you change this after the app has been used, a new folder will be created and the old one will remain in Drive (but won't be used by the app anymore).

### CACHE_TTL

Default: `300000` (5 minutes)

How long cached data remains "fresh" in milliseconds. After this time, cached data is still served (stale-while-revalidate) but a background fetch updates the cache.

- **Lower values** (e.g., 60000 = 1 minute): More API calls, more up-to-date content
- **Higher values** (e.g., 600000 = 10 minutes): Fewer API calls, potentially stale content
- **0**: Effectively disables caching (every request hits Drive API)

### DRIVE_API / DRIVE_UPLOAD_API

Google Drive API endpoints. These should not need to be changed unless Google changes their API URLs.

### SCOPE

Default: `https://www.googleapis.com/auth/drive.file`

The OAuth scope requested during login. `drive.file` only allows access to files created by the app. Other options:

- `drive.file` (default): Most restrictive. App can only see its own files.
- `drive`: Full Drive access. Would allow the app to read/write any file. Not recommended.
- `drive.readonly`: Read-only access to all files. Not useful for a wiki.

## Tailwind Theme

The color system is defined as CSS custom properties in `index.html`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
}
```

These follow the [shadcn/ui](https://ui.shadcn.com/) color token convention. Values are HSL components without the `hsl()` wrapper (used as `hsl(var(--name))`).

To change the theme:
1. Edit the CSS custom properties in `index.html`
2. Use a shadcn theme generator to get a complete color set
3. Dark mode can be added by defining values under a `.dark` class or `prefers-color-scheme` media query

## Customizing the Welcome Page

The default content for `index.md` (created on first login) is defined in `DriveService._welcomeContent()` in `js/services/drive.js`. Edit this method to change what new users see on their first visit.

## Port Configuration

The development server port is configured in the `justfile`:

```
serve:
    python3 -m http.server 9595

npx-serve:
    npx -y serve -p 9595
```

Change `9595` to use a different port. Remember to update your Google OAuth credentials' **Authorized JavaScript origins** to match.
