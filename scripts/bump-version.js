#!/usr/bin/env node
/**
 * Bumps the patch version in package.json (e.g. 1.0.0 → 1.0.1).
 * Run before build:apk so each build gets a new version automatically.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const parts = (pkg.version || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0);
const major = parts[0] ?? 1;
const minor = parts[1] ?? 0;
const patch = (parts[2] ?? 0) + 1;
const newVersion = `${major}.${minor}.${patch}`;
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`Bumped version to ${newVersion}`);
