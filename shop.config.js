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
  apiKey: "AIzaSyCoCUb_y1EOaZ87rS6idIsCCwsFUdXIVAY",
  authDomain: "vikretha-8978b.firebaseapp.com",
  projectId: "vikretha-8978b",
  storageBucket: "vikretha-8978b.firebasestorage.app",
  messagingSenderId: "210720989974",
  appId: "1:210720989974:web:fd3869cde378f5c6936637"
};

/**
 * Shop Identity
 */
export const SHOP_NAME = "Vikretha";          // Displayed in header and receipts
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
export const THEME_COLOR = "#1c0070";        // Primary color (hex) — used for header, buttons, charts
export const LOGO_URL = "";                  // URL to shop logo image — shown on receipts; leave empty to show shop name as wordmark
export const RECEIPT_FOOTER = "";             // Custom footer text on receipts; leave empty for default 'THANK YOU FOR SHOPPING!'

/**
 * Color Theme
 * Set the app-wide color palette here. This is a config-level setting — not changeable in the app UI.
 * Available values: 'orange' | 'emerald' | 'sky' | 'violet' | 'rose' | 'slate'
 * The id matches the data-theme HTML attribute defined in styles/main.css.
 */
export const COLOR_THEME = 'gold';

/**
 * Theme Palette Reference (CSS only — not exposed in the app UI)
 * These palettes are defined as [data-theme="..."] blocks in styles/main.css.
 * Change COLOR_THEME above to switch the active palette.
 */
export const THEME_PALETTES = [
  { id: 'orange',    label: 'Orange',     primary: '#f97316', lightBg: '#f8fafc', darkBg: '#0f172a' },
  { id: 'emerald',   label: 'Emerald',    primary: '#10b981', lightBg: '#f0fdf4', darkBg: '#052e16' },
  { id: 'sky',       label: 'Sky',        primary: '#0ea5e9', lightBg: '#f0f9ff', darkBg: '#082f49' },
  { id: 'violet',    label: 'Violet',     primary: '#7c3aed', lightBg: '#f5f3ff', darkBg: '#1e1b4b' },
  { id: 'rose',      label: 'Rose',       primary: '#f43f5e', lightBg: '#fff1f2', darkBg: '#4c0519' },
  { id: 'slate',     label: 'Slate',      primary: '#475569', lightBg: '#f8fafc', darkBg: '#0f172a' },
  { id: 'gold',      label: 'Gold',       primary: '#d4af37', lightBg: '#fffdf0', darkBg: '#0f0c00' },
  { id: 'trueblack', label: 'True Black', primary: '#d1d5db', lightBg: '#f8fafc', darkBg: '#000000' },
  { id: 'warm',      label: 'Warm',       primary: '#e07b39', lightBg: '#fffdf7', darkBg: '#1a1208' },
  { id: 'nord',      label: 'Nord',       primary: '#81a1c1', lightBg: '#eceff4', darkBg: '#2e3440' },
  { id: 'sepia',     label: 'Sepia',      primary: '#c0882a', lightBg: '#f5f0e8', darkBg: '#1a0f07' },
];
