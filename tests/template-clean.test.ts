import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Words that only belong to past clients. Built from parts so this file doesn't match itself.
const BANNED = [
  ['isha', 'putra'], ['sree', 'rasthu'], ['dcoim', 'qij'],
  ['ayur', 'ved'], ['botan', 'ical'], ['shila', 'jit'], ['ashwa', 'gandha'],
  ['apothe', 'cary'], ['bhring', 'raj'], ['tri', 'phala'], ['tul', 'si'],
  ['her', 'bal'], ['banjara', ' hills'], ['98765', ' 43210'],
].map((p) => p.join(''));

const SKIP = [/^docs\/template\/build\//, /^package-lock\.json$/, /\.(png|jpe?g|ico|webp|gif|pdf|woff2?|lockb)$/i];

test('no past-client words in tracked text files', () => {
  const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((f) => !SKIP.some((re) => re.test(f)));
  const hits: string[] = [];
  const re = new RegExp(BANNED.join('|'), 'i');
  for (const f of files) {
    let text: string;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    text.split('\n').forEach((line, i) => {
      const m = line.match(re);
      if (m) hits.push(`${f}:${i + 1}: ${m[0]}`);
    });
  }
  assert.deepEqual(hits, [], `${hits.length} past-client words left:\n${hits.slice(0, 80).join('\n')}`);
});
