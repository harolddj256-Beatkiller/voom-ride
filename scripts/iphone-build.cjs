'use strict';
// Beklo: guided iPhone build -> TestFlight. Run by "BUILD BEKLO IPHONE.command".
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = path.resolve(__dirname, '..');
const EAS_VERSION = '24.7.0';
const say = (...lines) => console.log(lines.join('\n'));
const step = (n, text) => say('', `STEP ${n} of 4 - ${text}`, '-'.repeat(44));
const fail = (msg) => { console.error('\n' + msg); process.exit(1); };

function eas(args, { quiet = false } = {}) {
  return spawnSync('npx', ['--yes', `eas-cli@${EAS_VERSION}`, ...args], {
    cwd: ROOT, encoding: 'utf8',
    stdio: quiet ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, EAS_NO_VCS: '1' },
  });
}
function projectId() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo?.extra?.eas?.projectId || ''; }
  catch (_) { return ''; }
}
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

async function main() {
  const dyn = path.join(ROOT, 'app.config.js');
  if (!fs.existsSync(dyn) && fs.existsSync(dyn + '.parked')) fs.renameSync(dyn + '.parked', dyn);
  say('Beklo - make the real iPhone app', '',
    'You need: an Apple Developer account ($99/year) and a free Expo account.',
    "The app is built on Expo's computers, then sent to TestFlight on your iPhone.");

  step(1, 'Sign in to Expo');
  if (eas(['whoami'], { quiet: true }).status !== 0) {
    say('Type your Expo email/username and password. No account? Make one free at expo.dev/signup');
    if (eas(['login']).status !== 0) fail('Expo sign-in did not finish. Double-click the file again.');
  } else say('Already signed in to Expo.');

  step(2, 'Connect Beklo to your Expo account');
  if (!projectId()) {
    // Expo can only save the project link into a plain app.json, so the
    // map-key helper (app.config.js) steps aside for a moment and comes back.
    const dyn = path.join(ROOT, 'app.config.js'), parked = dyn + '.parked';
    if (fs.existsSync(dyn)) fs.renameSync(dyn, parked);
    let ok;
    try { ok = eas(['init', '--force']).status === 0; }
    finally { if (fs.existsSync(parked)) fs.renameSync(parked, dyn); }
    if (!ok || !projectId()) {
      fail('Could not connect Beklo to Expo. Take a screenshot of the lines above and share it.');
    }
  }
  say('Beklo is connected to Expo.');

  step(3, 'Map style (optional)');
  say('Without a key, the iPhone app uses Apple Maps. That works fine and is free.',
    'If you have an iPhone Google Maps key (restricted to com.beklo.ride), paste it now.');
  const key = await ask('Google Maps iPhone key (or just press Enter to use Apple Maps): ');
  const setEnv = (name, value, visibility) => eas(['env:create', '--name', name, '--value', value,
    '--environment', 'production', '--visibility', visibility, '--scope', 'project', '--force', '--non-interactive'], { quiet: true });
  const results = key
    ? [setEnv('GOOGLE_MAPS_IOS_KEY', key, 'sensitive'), setEnv('EXPO_PUBLIC_USE_GOOGLE_MAPS', 'true', 'plaintext')]
    : [setEnv('EXPO_PUBLIC_USE_GOOGLE_MAPS', 'false', 'plaintext')];
  const bad = results.find((r) => r.status !== 0);
  if (bad) {
    const out = `${bad.stdout || ''}${bad.stderr || ''}`;
    fail('Could not save the map setting on Expo:\n' + (key ? out.split(key).join('[hidden]') : out).slice(-1200));
  }
  say(key ? 'Google Maps key saved on Expo (hidden).' : 'Using Apple Maps.');

  step(4, 'Build the iPhone app and send it to TestFlight');
  say('Expo will ask for your Apple ID and may send a code to your iPhone.',
    'When it asks questions, pressing Enter (the suggested answer) is usually right.',
    'The build takes about 15-30 minutes. When it finishes, open TestFlight on your iPhone.');
  const r = eas(['build', '--platform', 'ios', '--profile', 'production', '--auto-submit']);
  if (r.status !== 0) fail('The build stopped. Take a screenshot of the lines above and share it.');
  say('', 'Done! Apple takes a little while to process it, then Beklo appears in TestFlight.');
}
main().catch((e) => fail(String(e && e.message || e)));
