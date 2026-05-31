// ================================================================
// VIKRETHA — SHOP CONFIGURATION
// Edit this file to configure your shop. All settings in one place.
// See README.md for setup instructions.
// ================================================================

/**
 * Firebase Configuration
 * Get these values from: Firebase Console → Project Settings → Your apps → Config
 */
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",                          // From Firebase Console
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",  // Replace YOUR_PROJECT_ID
  projectId: "YOUR_PROJECT_ID",                   // Your Firestore project ID
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/**
 * Shop Identity
 */
export const SHOP_NAME = "My Shop";          // Displayed in header and receipts
export const SHOP_ID = "shop_001";           // Unique ID for Firestore path: /shops/{SHOP_ID}/
                                             // Use a URL-safe string (no spaces)

/**
 * Localization
 */
export const CURRENCY = "₹";                // Currency symbol shown on receipts and reports
export const LOCALE = "en-IN";              // Locale for date/number formatting (e.g., "en-IN", "en-US")

/**
 * WhatsApp
 */
export const WHATSAPP_NUMBER = "";          // Your shop's WhatsApp number with country code
                                             // e.g., "+919876543210" — used for receipt sharing

/**
 * Branding
 */
export const THEME_COLOR = "#2563eb";        // Primary color (hex) — used for header, buttons, charts
export const LOGO_URL = "";                  // URL to shop logo image — shown on receipts (leave empty to hide)
