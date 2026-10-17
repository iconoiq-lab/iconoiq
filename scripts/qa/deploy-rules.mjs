// Release firestore.rules to the project in .firebaserc with the Admin SDK (run from the repo root).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { FIREBASE_PROJECT } from '../lib/brand.mjs';
const require = createRequire(`${process.cwd()}/package.json`);
require('dotenv').config({ quiet: true });
const admin = require('firebase-admin');
const sa = JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_SDK_BASE64, 'base64').toString('utf8'));
if (sa.project_id !== FIREBASE_PROJECT) throw new Error(`refusing: service account is for ${sa.project_id} (.firebaserc says ${FIREBASE_PROJECT})`);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const source = fs.readFileSync('firestore.rules', 'utf8');
const rs = await admin.securityRules().releaseFirestoreRulesetFromSource(source);
console.log('released', rs.name);
process.exit(0);
