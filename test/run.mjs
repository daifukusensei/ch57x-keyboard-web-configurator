#!/usr/bin/env node
// Runs every suite against the built ch57x-keyboard-web-configurator.html (or argv[2]) and fails if any fails.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const extra = process.argv.slice(2);
const suites = readdirSync(dir).filter((f) => f.endsWith('.cjs')).sort();
const failed = [];
for (const s of suites) {
  const r = spawnSync(process.execPath, [join(dir, s), ...extra], { encoding: 'utf8' });
  const out = (r.stdout + r.stderr).trimEnd();
  const pass = r.status === 0;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${s}`);
  if (!pass) { failed.push(s); console.log(out.split('\n').map((l) => '      ' + l).join('\n')); }
}
console.log(`\n${suites.length - failed.length}/${suites.length} suites passed`);
process.exit(failed.length ? 1 : 0);
