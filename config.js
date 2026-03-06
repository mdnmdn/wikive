// Google Wiki Configuration
const CONFIG = {
  // Replace with your Google Cloud Console OAuth 2.0 Client ID
  GOOGLE_CLIENT_ID:
    "877456137532-qlk8nkmnulac4vv6fmmvbb6a6i39c914.apps.googleusercontent.com",

  // Root folder name in Google Drive
  ROOT_FOLDER_NAME: "_wiki",

  // Cache TTL in milliseconds (5 minutes)
  CACHE_TTL: 5 * 60 * 1000,

  // Google Drive API base URL
  DRIVE_API: "https://www.googleapis.com/drive/v3",
  DRIVE_UPLOAD_API: "https://www.googleapis.com/upload/drive/v3",

  // OAuth scope - only files created by this app
  SCOPE: "https://www.googleapis.com/auth/drive.file",
};
