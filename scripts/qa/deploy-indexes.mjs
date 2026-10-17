// Create the composite indexes in firestore.indexes.json on the project in .firebaserc, with the
// Admin SDK's service account and the Firestore REST API (run from the repo root). Existing
// indexes are skipped; nothing is deleted. New indexes take a few minutes to finish building.
// The default firebase-adminsdk service account may lack index rights: grant it the "Cloud Datastore
// Index Admin" role in Google Cloud IAM, or run `npx firebase-tools deploy --only firestore:indexes`
// after `npx firebase-tools login` instead.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { FIREBASE_PROJECT } from '../lib/brand.mjs';
const require = createRequire(`${process.cwd()}/package.json`);
require('dotenv').config({ quiet: true });
const admin = require('firebase-admin');
const sa = JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_SDK_BASE64, 'base64').toString('utf8'));
if (sa.project_id !== FIREBASE_PROJECT) throw new Error(`refusing: service account is for ${sa.project_id} (.firebaserc says ${FIREBASE_PROJECT})`);
const { access_token: token } = await admin.credential.cert(sa).getAccessToken();
const { indexes } = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));
const base = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/collectionGroups`;
let created = 0, existing = 0;
for (const { collectionGroup, queryScope, fields } of indexes) {
  const res = await fetch(`${base}/${collectionGroup}/indexes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryScope, fields }),
  });
  const label = `${collectionGroup} (${fields.map((f) => f.fieldPath).join(', ')})`;
  if (res.ok) { created++; console.log('creating', label); }
  else if (res.status === 409) { existing++; console.log('exists  ', label); }
  else throw new Error(`${label}: ${res.status} ${await res.text()}`);
}
console.log(`done: ${created} created, ${existing} already there`);
process.exit(0);
