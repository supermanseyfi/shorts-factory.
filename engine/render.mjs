// Renders the episode with headless Chrome (software WebGL) -> one mp4 per scene -> concat.
// usage: node engine/render.mjs <template> [--stills 1.2,8.5,...] [--fps 30] [--resume  (keep finished scenes after an interrupted render)]
import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn, execFileSync } from 'child_process';
const args = process.argv.slice(2), template = args[0] || 'ranking-map';
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const FPS = +(opt('fps') || 30), stills = opt('stills'), root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mjs': 'text/javascript' };
const server = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); });
await new Promise(r => server.listen(0, r)); const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--no-proxy-server', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1920'] });
const page = await browser.newPage(); await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/template/${template}/index.html`);
await page.waitForFunction('window.READY === true', { timeout: 120000 });
const EP = await page.evaluate('window.EP');
const shot = async t => { await page.evaluate(t => window.renderFrame(t), t); return page.screenshot({ type: 'jpeg', quality: 92 }); };
fs.mkdirSync('build/scenes', { recursive: true });
if (stills) {
  for (const t of stills.split(',').map(Number)) { fs.writeFileSync(`build/still_${t.toFixed(2)}.jpg`, await shot(t)); }
  console.log('stills done');
} else {
  const t0 = Date.now(); let n = 0; const total = Math.round(EP.duration * FPS), files = [];
  for (let s = 0; s < EP.segments.length; s++) {
    const f0 = Math.round(EP.segments[s][0] * FPS), f1 = s === EP.segments.length - 1 ? total : Math.round(EP.segments[s][1] * FPS);
    const tmp = `build/scenes/tmp_${s}.mp4`, out = `build/scenes/scene_${String(s).padStart(2, '0')}.mp4`;
    if (args.includes('--resume') && fs.existsSync(out)) { files.push(out); n += f1 - f0; console.log(`scene ${s} kept`); continue; }
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = f0; f < f1; f++) { const buf = await shot(f / FPS); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); n++; }
    ff.stdin.end(); const code = await new Promise(r => ff.on('close', r)); if (code) throw new Error('ffmpeg failed');
    fs.renameSync(tmp, out); files.push(out);
    console.log(`scene ${s} done  ${n}/${total} frames  ${(n / ((Date.now() - t0) / 1000)).toFixed(2)} fps`);
  }
  fs.writeFileSync('build/scenes/list.txt', files.map(f => `file '${path.resolve(f)}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'build/scenes/list.txt', '-c', 'copy', 'build/video_silent.mp4']);
  console.log('video_silent.mp4', total, 'frames');
}
await browser.close(); server.close();
