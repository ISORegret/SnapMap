#!/usr/bin/env node
/**
 * Syncs package.json version to:
 * - android/app/version.properties (APK versionName)
 * - website/index.html (replaces {{VERSION}})
 * Run before build:android / build:apk so web and APK match.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.0';

const propsPath = path.join(root, 'android', 'app', 'version.properties');
writeFileSync(propsPath, `VERSION_NAME=${version}\n`, 'utf8');
console.log(`Synced version ${version} to android/app/version.properties`);

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
