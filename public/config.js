// Google Wiki Configuration
const CONFIG = {
  // Replace with your Google Cloud Console OAuth 2.0 Client ID
  GOOGLE_CLIENT_ID:
    "877456137532-qlk8nkmnulac4vv6fmmvbb6a6i39c914.apps.googleusercontent.com",

  // Root folder path in Google Drive (supports hierarchical paths)
  // Examples:
  // - "_wiki" → creates/uses _wiki in Drive root
  // - "sefin-devops/_wiki" → creates/uses sefin-devops, then _wiki inside it
  // - "test1/test2/_wiki" → creates full nested hierarchy automatically
  // The app will search for existing folders and create any missing levels.
  // ROOT_FOLDER_NAME: "sefin-devops/_wiki",

  // Cache TTL in milliseconds (5 minutes)
  CACHE_TTL: 5 * 60 * 1000,

  // Google Drive API base URL
  DRIVE_API: "https://www.googleapis.com/drive/v3",
  DRIVE_UPLOAD_API: "https://www.googleapis.com/upload/drive/v3",

  // OAuth scope - only files created by this app
  // Added userinfo.email for AI chat email validation
  SCOPE: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",

  // AI Chat (optional) - Cloudflare Worker URL for hashbrown AI chat
  // If not set, the AI chat button will not appear
  // AI_URL: "https://your-worker.workers.dev",

  // Default AI model
  AI_MODEL: "gemini-flash-lite-latest",

  AI_URL: "http://localhost:8788"
  // AI_URL: "https://wiki-realtime.mdn.workers.dev"
};
