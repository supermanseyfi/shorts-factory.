// Story cut from real footage: background frames are pre-extracted by engine/footage_bg.py (build/bg/NNNNNN.jpg); this page adds title, era chip and captions.
const ep = await fetch('/build/episode.json').then(r => r.json());
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, t0, d) => clamp((t - t0) / d);
const eout = x => 1 - Math.pow(1 - x, 3);
const eback = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// ---------- HUD ----------
const segs = ep.segments, ERAS = ['ISTANBUL', ...ep.items.map(i => i.era), ''];
$('title').innerHTML = ep.title.map(l => `<div>${l}</div>`).join(''); $('outro').innerHTML = ep.outroLines.map(l => `<div>${l}</div>`).join('');
const chunks = []; for (const s of segs) { let cur = []; for (const w of s.words) { cur.push(w); if (cur.length >= 3 || /[.!?,:;]$/.test(w.w)) { chunks.push(cur); cur = []; } } if (cur.length) chunks.push(cur); }
let lastChunk = null;
function hud(t, si, u) {
  const s = segs[si], d = s.end - s.start, lt = t - s.start;
  $('dip').style.opacity = si === 0 ? 1 - prog(t, 0, .35) : (lt < .16 ? (1 - lt / .16) * .85 : 0);
  const era = $('era'); era.firstChild.textContent = ERAS[si]; era.style.opacity = ERAS[si] && si > 0 ? prog(lt, .15, .3) * (1 - prog(lt, d - .25, .2)) : 0; era.style.transform = `translateY(${(1 - eout(prog(lt, .15, .4))) * -30}px)`;
  const ti = $('title'); ti.style.opacity = si === 0 ? prog(t, .25, .3) * (1 - prog(t, s.end - .35, .3)) : 0; ti.style.transform = `scale(${lerp(.86, 1, eback(prog(t, .25, .5)))})`;
  const last = si === segs.length - 1, ou = $('outro'); ou.style.opacity = last ? prog(lt, .2, .35) : 0; ou.style.transform = `scale(${lerp(.86, 1, eback(prog(lt, .2, .5)))})`;
  const ch = chunks.find(c => t >= c[0].t0 - .05 && t < c.at(-1).t1 + .22), cap = $('cap');
  if (ch !== lastChunk) { cap.innerHTML = ch ? ch.map(w => `<span>${w.w.toUpperCase()}</span>`).join('') : ''; lastChunk = ch; }
  if (ch) { const tw = ch.reduce((a, w) => a + w.w.length, 0); cap.style.fontSize = tw > 21 ? '52px' : tw > 16 ? '60px' : '70px';
    [...cap.children].forEach((el, i) => { const w = ch[i], on = t >= w.t0 && t < w.t1 + .04, done = t >= w.t1; el.style.color = on ? '#ffd24d' : done ? '#fff' : 'rgba(255,255,255,.55)'; el.style.transform = `translateY(${on ? -8 : 0}px)`; }); }
}
window.EP = { duration: ep.duration, segments: segs.map(s => [s.start, s.end]) };
const bg = $('bg'), total = Math.round(ep.duration * 30);
window.renderFrame = async t => { let si = segs.findIndex(s => t < s.end); if (si < 0) si = segs.length - 1; const s = segs[si], u = clamp((t - s.start) / (s.end - s.start));
  const n = Math.min(total - 1, Math.round(t * 30)); bg.src = '/build/bg/' + String(n).padStart(6, '0') + '.jpg'; await bg.decode(); hud(t, si, u); };
await document.fonts.ready; await window.renderFrame(0); window.READY = true;
