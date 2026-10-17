// node scripts/progress.mjs [file]   (npm run progress)
// Recounts the ✅ / ⏳ / ⛔ steps in PROGRESS.md (or the file given) and updates its Overall line.
import { readFileSync, writeFileSync } from 'node:fs';
import { updateProgress } from './lib/progress.mjs';

const file = process.argv[2] || 'PROGRESS.md';
const next = updateProgress(readFileSync(file, 'utf8'));
writeFileSync(file, next);
console.log(next.match(/^\*\*Overall:.*\*\*$/m)[0]);
