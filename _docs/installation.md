# Installation

## Prerequisites

- A Google account
- Python 3 (for the local dev server) or any static file server
- A web browser (Chrome, Firefox, Safari, Edge)
- [just](https://github.com/casey/just) command runner (optional, for `just serve`)

## Step 1: Clone the Project

```bash
git clone <repository-url> google-wiki
cd google-wiki
```

Or simply download and extract the project files. The complete file structure is:

```
google-wiki/
  index.html
  config.js
  justfile
  css/
    app.css
  js/
    app.js
    services/
      auth.js
      cache.js
      drive.js
    components/
      LoginScreen.js
      AppHeader.js
      Breadcrumb.js
      Sidebar.js
      PageView.js
      PageEditor.js
      PageNotFound.js
      AssetManager.js
  _docs/
    (documentation files)
```

## Step 2: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** > **New Project**
3. Name it (e.g., "Google Wiki") and click **Create**
4. Select your new project from the dropdown

## Step 3: Enable the Google Drive API

1. In the Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Drive API"
3. Click on it and press **Enable**

## Step 4: Configure the OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (unless you have a Google Workspace org) and click **Create**
3. Fill in the required fields:
   - **App name**: Google Wiki
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue**
5. On the **Scopes** page, click **Add or Remove Scopes**
   - Search for `drive.file` and check the box for `https://www.googleapis.com/auth/drive.file`
   - Click **Update**, then **Save and Continue**
6. On the **Test users** page, add your Google email address
   - While in "Testing" mode, only listed test users can log in
   - You can publish the app later to remove this restriction
7. Click **Save and Continue**, then **Back to Dashboard**

## Step 5: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application** as the application type
4. Name it (e.g., "Google Wiki Web Client")
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:8080` (for local development)
   - Any other origins where you'll host the app (e.g., `https://yourdomain.com`)
6. Under **Authorized redirect URIs**, add the same origins
7. Click **Create**
8. Copy the **Client ID** (it looks like `123456789-abcdefg.apps.googleusercontent.com`)

## Step 6: Configure the App

Open `config.js` and replace the placeholder with your Client ID:

```javascript
const CONFIG = {
  GOOGLE_CLIENT_ID: '123456789-abcdefg.apps.googleusercontent.com',
  // ... rest stays the same
};
```

## Step 7: Start the Server

Using the justfile:

```bash
just serve
```

Or directly with Python:

```bash
python3 -m http.server 8080
```

Or any static file server:

```bash
# Node.js
npx serve -p 8080

# PHP
php -S localhost:8080
```

## Step 8: Open and Log In

1. Open `http://localhost:8080` in your browser
2. Click **Sign in with Google**
3. Select your Google account and grant permissions
4. The app will create a `_wiki` folder in your Google Drive with a welcome page

## Verification

After logging in, verify everything works:

- [ ] User avatar and name appear in the header
- [ ] The sidebar shows the welcome `index.md` page
- [ ] Clicking the page renders the welcome Markdown content
- [ ] The mermaid diagram in the welcome page renders correctly
- [ ] Clicking **Edit** opens the Toast UI Editor
- [ ] Changes can be saved
- [ ] The **Assets** link in the sidebar opens the asset manager
- [ ] Files can be uploaded via drag-and-drop

## Troubleshooting

### "Access blocked" or "App not verified"

Your OAuth consent screen is in "Testing" mode. Make sure your Google account is listed as a test user (Step 4.6 above).

### "popup_closed_by_user" error

Google's sign-in popup was blocked. Allow popups for `localhost:8080` in your browser settings.

### "Not a valid origin" error

The URL you're accessing doesn't match the **Authorized JavaScript origins** in your OAuth credentials. Make sure `http://localhost:8080` (exact match, including port) is listed.

### CORS errors in the console

This usually means the Google Drive API is not enabled for your project (Step 3) or your access token has expired. Refresh the page to re-authenticate.

### "drive.file scope" - can the app see my other files?

No. The `drive.file` scope only allows the app to access files it created itself. It cannot list, read, or modify any other files in your Drive.

## Hosting Options

Since the app is pure static files, it can be hosted anywhere:

- **GitHub Pages**: Push to a repo and enable Pages in settings
- **Netlify/Vercel**: Drag and drop the folder, or connect a repo
- **Any web server**: nginx, Apache, Caddy - just serve the files
- **Local only**: Run `just serve` whenever you want to use it

Remember to add your hosting domain to the OAuth credentials' **Authorized JavaScript origins**.
