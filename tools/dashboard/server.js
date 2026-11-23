/**
 * Hams_Alarm build & phone dashboard (no dependencies).
 *
 *   node tools/dashboard/server.js        → http://localhost:7777
 *
 * Shows the latest EAS cloud build with an estimated progress bar (based on how
 * long previous builds took), the build history, and — if a phone is attached
 * over adb — a live mirror of its screen, free storage and whether the app runs.
 */
const http = require('http');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 7777;
const ROOT = path.join(__dirname, '..', '..');
const ADB = process.env.ADB || 'C:/Users/chimd/Android/ptools/platform-tools/adb.exe';
const PKG = 'com.hamsalarm.app';

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: ROOT, windowsHide: true, maxBuffer: 64 * 1024 * 1024, encoding: opts.encoding ?? 'utf8', shell: opts.shell ?? false, timeout: opts.timeout ?? 120000 },
      (err, stdout) => resolve(err && !stdout ? null : stdout));
  });
}

// ---------- EAS builds (cached; the CLI is slow) ----------
let builds = { at: 0, list: [], error: null, refreshing: false };
async function refreshBuilds() {
  if (builds.refreshing) return;
  builds.refreshing = true;
  const out = await run('npx', ['eas-cli@latest', 'build:list', '--platform', 'android', '--limit', '8', '--json', '--non-interactive'], { shell: true });
  try {
    const list = JSON.parse(out.slice(out.indexOf('[')));
    builds = { at: Date.now(), list, error: null, refreshing: false };
  } catch {
    builds = { ...builds, error: 'Could not read builds from EAS', refreshing: false };
  }
}
setInterval(refreshBuilds, 20000);
refreshBuilds();

function buildState() {
  const list = builds.list;
  const done = list.filter((b) => b.status === 'FINISHED' && b.completedAt);
  const durations = done.map((b) => new Date(b.completedAt) - new Date(b.createdAt));
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 18 * 60000;
  const latest = list[0];
  let current = null;
  if (latest) {
    const active = ['NEW', 'IN_QUEUE', 'IN_PROGRESS', 'PENDING_CANCEL'].includes(latest.status);
    const elapsed = (latest.completedAt ? new Date(latest.completedAt) : new Date()) - new Date(latest.createdAt);
    let pct = latest.status === 'FINISHED' ? 100 : active ? Math.min(97, Math.round((elapsed / avg) * 100)) : 0;
    if (latest.status === 'IN_QUEUE' || latest.status === 'NEW') pct = Math.min(pct, 6);
    const stage =
      latest.status === 'FINISHED' ? 'Done — APK ready' :
      latest.status === 'ERRORED' ? 'Failed' :
      latest.status === 'CANCELED' ? 'Canceled' :
      latest.status !== 'IN_PROGRESS' ? 'Waiting in queue for a build machine' :
      pct < 12 ? 'Setting up the build machine' :
      pct < 28 ? 'Installing dependencies (npm)' :
      pct < 40 ? 'Generating the native Android project' :
      pct < 88 ? 'Compiling the Android app (Gradle)' :
      'Packaging and uploading the APK';
    current = {
      id: latest.id, status: latest.status, pct, stage, elapsed, avg,
      remaining: active ? Math.max(0, avg - elapsed) : 0,
      apk: latest.artifacts?.applicationArchiveUrl ?? null,
      url: `https://expo.dev/accounts/${latest.project?.ownerAccount?.name ?? 'serenityeye'}/projects/hams-alarm/builds/${latest.id}`,
    };
  }
  return {
    updatedAt: builds.at, error: builds.error, current,
    history: list.map((b) => ({ id: b.id, status: b.status, createdAt: b.createdAt, duration: b.completedAt ? new Date(b.completedAt) - new Date(b.createdAt) : null })),
  };
}

// ---------- Phone over adb ----------
let phone = { at: 0, data: null };
async function phoneState() {
  if (Date.now() - phone.at < 5000 && phone.data) return phone.data;
  const devs = (await run(ADB, ['devices', '-l'])) || '';
  const line = devs.split('\n').find((l) => /\sdevice\s/.test(l));
  if (!line) { phone = { at: Date.now(), data: { connected: false } }; return phone.data; }
  const model = (line.match(/model:(\S+)/) || [])[1];
  const df = ((await run(ADB, ['shell', 'df', '-h', '/sdcard'])) || '').trim().split('\n').pop().split(/\s+/);
  const pid = ((await run(ADB, ['shell', 'pidof', PKG])) || '').trim();
  const ver = ((await run(ADB, ['shell', `dumpsys package ${PKG} | grep lastUpdateTime | head -1`])) || '').trim().replace('lastUpdateTime=', '');
  phone = { at: Date.now(), data: { connected: true, model, size: df[1], used: df[2], free: df[3], pct: df[4], appRunning: !!pid, appInstalled: ver || null } };
  return phone.data;
}

let shot = { at: 0, png: null, busy: false };
async function screenshot() {
  if ((Date.now() - shot.at < 1500 || shot.busy) && shot.png) return shot.png;
  shot.busy = true;
  const png = await run(ADB, ['exec-out', 'screencap', '-p'], { encoding: 'buffer', timeout: 15000 });
  shot = { at: Date.now(), png: png && png.length > 1000 ? png : shot.png, busy: false };
  return shot.png;
}

http
  .createServer(async (req, res) => {
    if (req.url === '/api/state') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ build: buildState(), phone: await phoneState(), now: Date.now() }));
    }
    if (req.url.startsWith('/phone.png')) {
      const png = await screenshot();
      if (!png) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return res.end(png);
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  })
  .listen(PORT, () => console.log(`dashboard on http://localhost:${PORT}`));
