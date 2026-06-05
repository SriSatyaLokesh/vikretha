/**
 * modules/adminSettings.js — Redirects to /settings
 * The admin panel has been merged into the main Settings screen (role-aware).
 */
export function render() {
  window.location.hash = '#/settings';
}
