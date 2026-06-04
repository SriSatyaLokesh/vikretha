#!/usr/bin/env node
/**
 * scripts/deploy-rules.js
 * Deploy Firestore security rules to Firebase.
 *
 * Usage:  node scripts/deploy-rules.js
 *
 * Prerequisites:
 *   - Firebase CLI installed globally: npm install -g firebase-tools
 *   - Logged in: firebase login
 *   - .firebaserc or firebase.json present in repo root
 */
'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT       = path.resolve(__dirname, '..');
const RULES_FILE = path.join(ROOT, 'firestore.rules');

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  grey:  (s) => `\x1b[90m${s}\x1b[0m`,
};

// ── Preflight: firestore.rules must exist ─────────────────────────────────────
if (!fs.existsSync(RULES_FILE)) {
  console.error(c.red('✗ firestore.rules not found at:'), RULES_FILE);
  process.exit(1);
}

// ── Preflight: Firebase CLI must be available ────────────────────────────────
try {
  execSync('firebase --version', { stdio: 'pipe' });
} catch {
  console.error(c.red('✗ Firebase CLI not found.'));
  console.error('  Install it with:  npm install -g firebase-tools');
  console.error('  Then log in with: firebase login');
  process.exit(1);
}

// ── Preview the rules being deployed ─────────────────────────────────────────
const rulesPreview = fs.readFileSync(RULES_FILE, 'utf8').split('\n').slice(0, 5).join('\n');
console.log(c.cyan('→ Deploying Firestore rules from:'), RULES_FILE);
console.log(c.grey(rulesPreview));
console.log(c.grey('  ...'));
console.log('');

// ── Deploy ────────────────────────────────────────────────────────────────────
try {
  execSync('firebase deploy --only firestore:rules', {
    cwd:   ROOT,
    stdio: 'inherit',
  });
  console.log('');
  console.log(c.green('✓ Firestore rules deployed successfully.'));
} catch {
  console.error('');
  console.error(c.red('✗ Deploy failed.'));
  console.error('  Ensure you are logged in:  firebase login');
  console.error('  Then retry:  node scripts/deploy-rules.js');
  process.exit(1);
}
