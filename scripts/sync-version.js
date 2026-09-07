#!/usr/bin/env node
/**
 * Syncs package.json version to:
 * - android/app/version.properties (APK versionName + monotonic versionCode)
 * - public/version.json (for in-app "Update available" check)
 * - website/index.html (replaces {{VERSION}})
 * Run before build:android / build:apk so web and APK match.
 *
 * Version cap: patch (third number) is capped at 9. If patch >= 10,
 * it rolls to the next minor: e.g. 1.1.10 → 1.2.0, then 1.2.1, 1.2.2, …
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
let pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
let version = pkg.version || '1.0.0';

// Cap patch at 9: if patch >= 10, roll to (major, minor+1, 0) and write back.
let parts = version.split('.').map((s) => parseInt(s, 10) || 0);
if ((parts[2] ?? 0) >= 10) {
  version = `${parts[0] ?? 1}.${(parts[1] ?? 0) + 1}.0`;
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`Version rolled to ${version} (patch was >= 10).`);
  parts = version.split('.').map((s) => parseInt(s, 10) || 0);
}

const major = Math.max(0, parts[0] ?? 1);
const minor = Math.max(0, parts[1] ?? 0);
const patch = Math.max(0, parts[2] ?? 0);
// Android versionCode must monotonically increase. With SnapMap's patch<10
// convention this leaves generous space while staying human-predictable:
// 2.28.0 => 22800, 2.28.1 => 22801, 2.29.0 => 22900.
const versionCode = (major * 10000) + (minor * 100) + patch;
if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
  throw new Error(`Cannot derive a valid Android versionCode from ${version}`);
}

const propsPath = path.join(root, 'android', 'app', 'version.properties');
writeFileSync(propsPath, `VERSION_NAME=${version}\nVERSION_CODE=${versionCode}\n`, 'utf8');
console.log(`Synced version ${version} (${versionCode}) to android/app/version.properties`);

const versionJsonPath = path.join(root, 'public', 'version.json');
writeFileSync(versionJsonPath, JSON.stringify({ version }, null, 2) + '\n', 'utf8');
console.log(`Synced version ${version} to public/version.json (for update check)`);

const websiteIndex = path.join(root, 'website', 'index.html');
if (existsSync(websiteIndex)) {
  let html = readFileSync(websiteIndex, 'utf8');
  // Replace {{VERSION}} or existing version numbers so footer and download area match package.json (APK version)
  html = html.replace(/\{\{VERSION\}\}/g, version);
  html = html.replace(/(App v)[\d.]+/g, `$1${version}`);
  html = html.replace(/(version-under-btn">v)[\d.]+/g, `$1${version}`);
  writeFileSync(websiteIndex, html, 'utf8');
  console.log(`Synced version ${version} to website/index.html (footer = APK version)`);
}
