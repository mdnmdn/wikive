// Google Wiki Configuration
const CONFIG = {
  // Replace with your Google Cloud Console OAuth 2.0 Client ID
  GOOGLE_CLIENT_ID:
    "87745xxxxx4.apps.googleusercontent.com",

  // Root folder path in Google Drive (supports hierarchical paths)
  // Examples:
  // - "_wiki" → creates/uses _wiki in Drive root
  // - "test1/test2/_wiki" → creates full nested hierarchy automatically
  // The app will search for existing folders and create any missing levels.
  ROOT_FOLDER_NAME: "_wiki",

  // Cache TTL in milliseconds (5 minutes)
  CACHE_TTL: 5 * 60 * 1000,

  // Google Drive API base URL
  DRIVE_API: "https://www.googleapis.com/drive/v3",
  DRIVE_UPLOAD_API: "https://www.googleapis.com/upload/drive/v3",

  // OAuth scope - only files created by this app
  SCOPE: "https://www.googleapis.com/auth/drive.file",

  // Cloudflare Worker URL for real-time notifications and presence.
  // Deploy the worker from /worker and set the URL here.
  // Leave empty to disable real-time features.
  WORKER_URL: "",
};
