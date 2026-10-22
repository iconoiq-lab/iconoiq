import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Admin > Settings edits the store's order-alert number (siteSettings/adminNotification,
 * which orderService reads). It once filled the field from the signed-in admin's profile,
 * so a second admin saw it empty and their next save wiped the store's number.
 */
test('Admin settings loads and saves the store alert number, not the profile one', () => {
  const src = readFileSync('src/pages/admin/AdminSettings.tsx', 'utf8');
  assert.match(src, /'siteSettings', 'adminNotification'/, 'the alert number lives in siteSettings/adminNotification');
  assert.match(src, /getDoc\(doc\(db, \.\.\.ALERT_DOC\)\)/, 'the field is loaded from the store setting');
  assert.doesNotMatch(src, /useState\(userProfile\?\.whatsappNumber/, 'the field must not start from the admin profile');
  const save = src.match(/updateUserProfile\(\{[^}]*\}\)/);
  assert.ok(save, 'the profile save is still there');
  assert.doesNotMatch(save[0], /whatsappNumber/, 'the store number is not copied into the admin profile (it means "verified by a code")');
  assert.match(src, /if \(alertState === 'ready'\)/, 'a number that failed to load is never written back');
});
