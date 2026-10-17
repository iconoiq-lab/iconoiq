import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  changePhonePatch,
  changePhoneSecurityPatch,
  checkSignupPhone,
  effectiveWhatsAppChoice,
  isIndianMobile,
} from '../src/lib/whatsappOtpPolicy.ts';

test('isIndianMobile accepts a 10-digit number starting 6-9 and nothing else', () => {
  assert.equal(isIndianMobile('9876543210'), true);
  assert.equal(isIndianMobile('6000000000'), true);
  assert.equal(isIndianMobile('5876543210'), false);
  assert.equal(isIndianMobile('987654321'), false);
  assert.equal(isIndianMobile('98765432100'), false);
  assert.equal(isIndianMobile('98 76543210'), false);
  assert.equal(isIndianMobile(''), false);
});

test('the WhatsApp choice is ignored when the whatsappOtp switch is off', () => {
  assert.equal(effectiveWhatsAppChoice(true, true), true);
  assert.equal(effectiveWhatsAppChoice(true, false), false);
  assert.equal(effectiveWhatsAppChoice(false, true), false, 'the box default is true but the switch wins');
  assert.equal(effectiveWhatsAppChoice(false, false), false);
});

test('switch on: a typed phone with "same for WhatsApp" needs a verified code (as before)', () => {
  const base = { otpEnabled: true, phone: '9876543210', wantsWhatsApp: true };
  assert.equal(checkSignupPhone({ ...base, whatsappVerified: false }), 'needs-whatsapp-code');
  assert.equal(checkSignupPhone({ ...base, whatsappVerified: true }), 'ok');
});

test('switch on: unticked box, or no phone, does not need a code', () => {
  assert.equal(checkSignupPhone({ otpEnabled: true, phone: '9876543210', wantsWhatsApp: false, whatsappVerified: false }), 'ok');
  assert.equal(checkSignupPhone({ otpEnabled: true, phone: '', wantsWhatsApp: true, whatsappVerified: false }), 'ok');
});

test('switch on: an invalid phone is reported before the code step', () => {
  assert.equal(checkSignupPhone({ otpEnabled: true, phone: '12345', wantsWhatsApp: true, whatsappVerified: false }), 'invalid-phone');
});

test('switch off: sign-up never waits for WhatsApp, a valid phone passes', () => {
  assert.equal(checkSignupPhone({ otpEnabled: false, phone: '9876543210', wantsWhatsApp: true, whatsappVerified: false }), 'ok');
  assert.equal(checkSignupPhone({ otpEnabled: false, phone: '', wantsWhatsApp: true, whatsappVerified: false }), 'ok');
});

test('switch off: a typed phone is still checked as a 10-digit Indian mobile', () => {
  assert.equal(checkSignupPhone({ otpEnabled: false, phone: '12345', wantsWhatsApp: true, whatsappVerified: false }), 'invalid-phone');
  assert.equal(checkSignupPhone({ otpEnabled: false, phone: '5876543210', wantsWhatsApp: true, whatsappVerified: false }), 'invalid-phone');
});

test('changing a phone number: switch on saves it as the verified WhatsApp number too', () => {
  assert.deepEqual(changePhonePatch(true, '9876543210', '919876543210'), { whatsappNumber: '919876543210', phone: '919876543210' });
});

test('changing a phone number: switch off saves the plain phone only, never a WhatsApp number', () => {
  const patch = changePhonePatch(false, '9876543210', '919876543210');
  assert.deepEqual(patch, { phone: '9876543210' });
  assert.equal('whatsappNumber' in patch, false);
});

const verified = { phone: '919876543210', whatsappNumber: '919876543210', phoneVerified: true };

test('changing a phone with the switch off clears a WhatsApp number saved for the old number', () => {
  assert.deepEqual(changePhonePatch(false, '9123456780', '919123456780', verified), { phone: '9123456780', whatsappNumber: '' });
  // 10 digits, 91-prefixed or +91 all name the same number
  assert.deepEqual(changePhonePatch(false, '9876543210', '919876543210', verified), { phone: '9876543210' });
  assert.deepEqual(changePhonePatch(false, '9000012345', '919000012345', { whatsappNumber: '+91 90000 12345' }), { phone: '9000012345' });
  // nothing saved, nothing to clear
  assert.deepEqual(changePhonePatch(false, '9123456780', '919123456780', { phone: '9876543210' }), { phone: '9123456780' });
});

test('changing a phone with the switch on is as before and writes no security settings', () => {
  assert.deepEqual(changePhonePatch(true, '9123456780', '919123456780', verified), { whatsappNumber: '919123456780', phone: '919123456780' });
  assert.equal(changePhoneSecurityPatch(true, '9123456780', verified), null);
});

test('changing a phone with the switch off to a different number turns the verified mark off', () => {
  assert.deepEqual(changePhoneSecurityPatch(false, '9123456780', verified), { phoneVerified: false });
  // only a verified plain phone (no WhatsApp number): the new number is unchecked too
  assert.deepEqual(changePhoneSecurityPatch(false, '9123456780', { phone: '9876543210', phoneVerified: true }), { phoneVerified: false });
});

test('changing a phone with the switch off writes no security settings when there is nothing to clear or the number is the verified one', () => {
  assert.equal(changePhoneSecurityPatch(false, '9123456780', { phone: '9876543210' }), null, 'no verified mark to clear');
  assert.equal(changePhoneSecurityPatch(false, '9876543210', verified), null, 'the same verified number');
  assert.equal(changePhoneSecurityPatch(false, '9123456780'), null);
});

test('the Security page saves a phone change through the phone rules', () => {
  const security = readFileSync('src/pages/SecurityPage.tsx', 'utf8');
  assert.match(security, /changePhoneSecurityPatch\(whatsappCheckOn/, 'SecurityPage.tsx phone change');
  assert.match(security, /changePhonePatch\(whatsappCheckOn/, 'SecurityPage.tsx phone change');
});

/**
 * Customer 2-step was removed (docs/HANDOFF.md, Decisions): it could only be enforced in the browser, because
 * the on/off flag and the trusted devices sat in the customer's own editable user document. This keeps a
 * second copy of it from coming back through the sign-in flow by accident. A client that needs 2-step builds it
 * server-side (Phase 4); that change updates this test on purpose.
 */
test('sign-in has no 2-step challenge: no modal, no 2-step flag, no trusted devices anywhere in src', () => {
  assert.equal(existsSync('src/components/auth/TwoFactorChallengeModal.tsx'), false, 'the challenge modal stays deleted');
  const account = readFileSync('src/pages/Account.tsx', 'utf8');
  assert.doesNotMatch(account, /TwoFactor|twoFactor|trustedDevice|generateDeviceFingerprint/, 'Account.tsx sign-in flow');
  const banned = /TwoFactorChallenge|twoFactorEnabled|twoFactorMethod|twoStepEnforced|twoStepOffered|trustedDevices|trustCurrentDevice/;
  const hits = (readdirSync('src', { recursive: true }) as string[])
    .map((f) => join('src', f).replace(/\\/g, '/'))
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => banned.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, [], 'files that bring customer 2-step back');
});
