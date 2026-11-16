#!/usr/bin/env node
// Builds the single-file deliverable ch57x-config-editor.html from src/.
//
// src/index.template.html holds the markup; every line that is exactly
//   <!-- @inline NAME -->
// is replaced by the contents of src/NAME. The surrounding <style>/<script id="…">
// tags live in the template, so the tests' <script id="core"> regex keeps working.
//
//   node build.mjs           write ch57x-config-editor.html
//   node build.mjs --check   exit 1 if the committed file differs from a fresh build
//
// No dependencies, no network.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const outPath = join(root, 'ch57x-config-editor.html');
const PLACEHOLDER = /^<!-- @inline ([\w.-]+) -->$/;

// A part must not close its own tag early, or the browser would end the block there.
const CLOSERS = { '.css': /<\/style/i, '.js': /<\/script/i };

export function build() {
  const template = readFileSync(join(src, 'index.template.html'), 'utf8');
  const used = new Set();
  const lines = template.split('\n').map((line) => {
    const m = line.match(PLACEHOLDER);
    if (!m) return line;
    const name = m[1];
    if (used.has(name)) throw new Error(`${name} is inlined twice`);
    used.add(name);
    let body = readFileSync(join(src, name), 'utf8');
    if (body.includes('\r')) throw new Error(`${name} has CR line endings; use LF`);
    const closer = CLOSERS[name.slice(name.lastIndexOf('.'))];
    if (closer && closer.test(body)) throw new Error(`${name} contains ${closer.source.replace('\\', '')}`);
    if (body.endsWith('\n')) body = body.slice(0, -1); // the placeholder line supplies the newline
    return body;
  });
  return lines.join('\n');
}

const html = build();
if (process.argv.includes('--check')) {
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  if (current !== html) {
    console.error('ch57x-config-editor.html is out of date: run `npm run build` and commit the result.');
    process.exit(1);
  }
  console.log('ch57x-config-editor.html is up to date.');
} else {
  writeFileSync(outPath, html);
  console.log(`wrote ch57x-config-editor.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}
