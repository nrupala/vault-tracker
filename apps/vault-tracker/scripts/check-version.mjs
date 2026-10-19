#!/usr/bin/env node
/**
 * Version-truth gate.
 *
 * The app version has exactly one source of truth: this app's
 * package.json "version". vite.config.ts injects it into the bundle
 * as __APP_VERSION__, and every in-app version display renders that
 * constant. This script fails (exit 1) when any leg disagrees:
 *
 *   1. package.json version  ==  android/app/build.gradle versionName
 *   2. No hardcoded version literal (x.y.z) anywhere in src/ code —
 *      comment-only lines are exempt (they record history, e.g.
 *      "the pre-v1.2.0 storage engine"); a literal in code or JSX
 *      is a display waiting to go stale.
 *   3. With --assets <dir>: the built web assets contain the exact
 *      package.json version string (i.e. the injected constant
 *      actually reached the shipped bundle).
 *
 * Usage:
 *   node scripts/check-version.mjs
 *   node scripts/check-version.mjs --assets android/app/src/main/assets/public
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`VERSION GATE FAIL: ${msg}`);
};

// --- Leg 1: package.json == gradle versionName ------------------------------
const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf-8'));
const pkgVersion = pkg.version;
const gradle = readFileSync(join(appRoot, 'android/app/build.gradle'), 'utf-8');
const gradleMatch = gradle.match(/versionName\s+"([^"]+)"/);
if (!gradleMatch) {
  fail('could not find versionName in android/app/build.gradle');
} else if (gradleMatch[1] !== pkgVersion) {
  fail(`package.json version (${pkgVersion}) != gradle versionName (${gradleMatch[1]})`);
} else {
  console.log(`version: package.json == gradle versionName == ${pkgVersion}`);
}

// --- Leg 2: no version literals in src/ code --------------------------------
const versionLiteral = /\bv?\d+\.\d+\.\d+\b/;
function scanDir(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      scanDir(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      const lines = readFileSync(full, 'utf-8').split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Comment-only lines record history; they are not displays.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        const m = line.match(versionLiteral);
        if (m) {
          fail(`${full.replace(appRoot + '/', '')}:${i + 1} hardcodes version literal "${m[0]}" — render __APP_VERSION__ instead`);
        }
      });
    }
  }
}
scanDir(join(appRoot, 'src'));
if (failures === 0) console.log('version: no hardcoded version literals in src/');

// --- Leg 3 (optional): built assets carry the injected version --------------
const assetsIdx = process.argv.indexOf('--assets');
if (assetsIdx !== -1) {
  const assetsDir = process.argv[assetsIdx + 1];
  if (!assetsDir) {
    fail('--assets requires a directory argument');
  } else {
    let found = false;
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.js') && readFileSync(full, 'utf-8').includes(pkgVersion)) found = true;
      }
    };
    try {
      walk(assetsDir);
    } catch (e) {
      fail(`could not read assets dir ${assetsDir}: ${e.message}`);
    }
    if (!found) {
      fail(`built assets in ${assetsDir} do not contain version ${pkgVersion} — the __APP_VERSION__ injection did not reach the bundle`);
    }
    if (found) console.log(`version: built assets contain ${pkgVersion}`);
  }
}

if (failures > 0) {
  console.error(`version gate: ${failures} failure(s)`);
  process.exit(1);
}
console.log('version gate: PASS');
