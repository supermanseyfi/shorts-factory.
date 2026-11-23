// Multiple-choice quiz Shorts. Question kinds: "choice" (2-4 options, optional outline/emoji visual), "tf" (true/false), "duel" (pick between outlines drawn to the same scale).
const [ep, shapes] = await Promise.all([fetch('/build/episode.json').then(r => r.json()), fetch('/build/shapes.json').then(r => r.json()).catch(() => ({}))]);
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t, prog = (t, t0, d) => clamp((t - t0) / d);
const eout = x => 1 - Math.pow(1 - x, 3), eback = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function rng(seed) { let s = seed; return () => (s = (s * 16807 + 11) % 2147483647) / 2147483647; }
const segs = ep.segments, Q = ep.questions, L = 'ABCD', HUES = [222, 268, 196, 328, 160, 24, 250, 205];
// background blobs
const r = rng(9), blobs = []; for (let i = 0; i < 9; i++) { const e = document.createElement('i'), s = 520 + r() * 520; e.style.width = e.style.height = s + 'px'; $('bg').appendChild(e); blobs.push({ e, x: r() * 1080, y: r() * 1920, ax: 120 + r() * 200, ay: 160 + r() * 260, w: .15 + r() * .25, p: r() * 6.28, h: (r() - .5) * 70, s }); }
$('series').textContent = ep.series; $('dots').innerHTML = Q.map(() => '<i></i>').join('');
$('title').innerHTML = ep.title.map(l => `<div>${l}</div>`).join(''); $('sub').firstChild.textContent = ep.sub || `${Q.length} QUESTIONS · 3 SECONDS EACH`;
$('outro').innerHTML = `<div class="h">${ep.outroLines[0]}</div>` + (ep.ranks || []).map(x => `<div class="r"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('') + `<div class="c">${ep.outroLines[1]}</div>`;
const fmt = n => typeof n === 'number' ? n.toLocaleString('en-US') : n;
function shapeSvg(ids, boxW, boxH, same) {   // outlines side by side; same=true keeps one px-per-km scale for all
  const n = ids.length, cw = boxW / n, sc = ids.map(id => Math.min((cw - 40) / shapes[id].w, boxH / shapes[id].h)), k = Math.min(...sc);
  return `<svg width="${boxW}" height="${boxH}" viewBox="0 0 ${boxW} ${boxH}">` + ids.map((id, i) => { const s = same ? k : sc[i]; return `<g class="sh" data-i="${i}" transform="translate(${cw * (i + .5)},${boxH / 2}) scale(${s})">` + shapes[id].paths.map(p => `<path d="M${p.map(q => q.join(',')).join('L')}Z" fill="#59d7a8" stroke="#eafff6" stroke-width="${3 / s}" stroke-linejoin="round"/>`).join('') + '</g>'; }).join('') + '</svg>';
}
// build one DOM block per question (shown/hidden per frame)
const blocks = Q.map((q, k) => { const kind = q.kind || 'choice', vis = q.visual, b = { kind, els: [], y: {} };
  const hasVis = kind !== 'duel' && vis; b.vTop = 660; b.vH = hasVis ? 330 : 0;
  if (kind === 'duel') { const n = vis.ids.length, bw = 1000, bh = 620; b.svg = shapeSvg(vis.ids, bw, bh, true); b.vTop = 640; b.vH = bh;
    q.options.forEach((o, i) => { const d = document.createElement('div'); d.className = 'duel'; d.style.cssText = `left:${40 + bw / n * i}px;width:${bw / n}px;top:${b.vTop + bh + 16}px`; d.innerHTML = `<u>${L[i]}</u><div>${o}</div><small>${q.values ? fmt(q.values[i]) + ' ' + (q.unit || '') : ''}</small>`; $('opts').appendChild(d); b.els.push(d); });
    b.factTop = b.vTop + bh + 250;
  } else if (kind === 'tf') { ['TRUE', 'FALSE'].forEach((o, i) => { const d = document.createElement('div'); d.className = 'big'; d.textContent = o; d.style.cssText = `left:${90 + i * 470}px;top:${hasVis ? 1060 : 900}px;color:${i ? '#ff8f8f' : '#8dffbf'};border-color:${i ? '#ff6b6b' : '#59e38f'};background:rgba(14,26,58,.85)`; $('opts').appendChild(d); b.els.push(d); });
    b.factTop = (hasVis ? 1060 : 900) + 290;
  } else { const n = q.options.length, top = hasVis ? 1030 : 760, h = hasVis ? 116 : 136, gap = hasVis ? 18 : 26;
    q.options.forEach((o, i) => { const d = document.createElement('div'); d.className = 'opt'; d.style.cssText = `top:${top + i * (h + gap)}px;height:${h}px`; d.innerHTML = `<u>${L[i]}</u><span style="font-size:${o.length > 22 ? 42 : o.length > 16 ? 48 : 54}px">${o}</span><em></em>`; $('opts').appendChild(d); b.els.push(d); });
    b.factTop = top + n * (h + gap) + 14; }
  if (hasVis && vis.type === 'shapes') b.svg = shapeSvg(vis.ids, 1000, b.vH, false);
  return b; });
const chunks = []; segs.forEach((s, i) => { if (s.kind === 'item') return; let cur = []; for (const w of s.words) { cur.push(w); if (cur.length >= 3 || /[.!?,:;]$/.test(w.w)) { chunks.push(cur); cur = []; } } if (cur.length) chunks.push(cur); });
let shownQ = -2, lastChunk = null;
function frame(t) {
  let si = segs.findIndex(s => t < s.end); if (si < 0) si = segs.length - 1; const s = segs[si], lt = t - s.start;
  const it = s.kind === 'item' ? ep.items[s.item] : null, k = it ? it.qi : -1, q = k >= 0 ? Q[k] : null, b = k >= 0 ? blocks[k] : null;
  const hue = HUES[(k + 1 + HUES.length) % HUES.length];
  document.body.style.background = `linear-gradient(160deg,hsl(${hue},62%,16%),hsl(${hue + 40},70%,9%))`;
  for (const o of blobs) { o.e.style.background = `radial-gradient(circle,hsla(${hue + o.h},85%,55%,.9) 0%,hsla(${hue + o.h},85%,55%,.35) 40%,hsla(${hue + o.h},85%,55%,0) 70%)`; o.e.style.transform = `translate(${o.x + Math.sin(t * o.w + o.p) * o.ax - o.s / 2}px,${o.y + Math.cos(t * o.w * .8 + o.p) * o.ay - o.s / 2}px)`; }
  $('grid').style.backgroundPosition = `${t * 12}px ${t * 18}px`;
  // hook / outro
  const hook = s.kind === 'hook', outro = s.kind === 'outro';
  $('title').style.opacity = hook ? prog(t, .1, .25) * (1 - prog(t, s.end - .3, .25)) : 0; $('title').style.transform = `scale(${lerp(.8, 1, eback(prog(t, .1, .5)))}) rotate(${Math.sin(t * 2) * .6}deg)`;
  $('sub').style.opacity = hook ? prog(t, .9, .3) * (1 - prog(t, s.end - .3, .25)) : 0; $('sub').style.transform = `translateY(${(1 - eout(prog(t, .9, .4))) * 60}px)`;
  $('outro').style.opacity = outro ? prog(lt, .1, .3) : 0;
  [...$('outro').children].forEach((e, i) => { e.style.transform = `translateY(${(1 - eback(prog(lt, .15 + i * .14, .45))) * 80}px)`; e.style.opacity = prog(lt, .15 + i * .14, .25); });
  $('top').style.opacity = k >= 0 ? 1 : 0;
  [...$('dots').children].forEach((e, i) => { const done = i < k || (i === k && it.part === 'a'); e.style.background = done ? '#59e38f' : i === k ? '#ffd24d' : 'rgba(255,255,255,.18)'; e.style.transform = i === k ? `scaleY(${1.3 + Math.sin(t * 6) * .25})` : ''; });
  // question block
  if (k !== shownQ) { blocks.forEach((bb, i) => bb.els.forEach(e => e.style.display = i === k ? '' : 'none')); $('visual').innerHTML = b && b.svg ? b.svg : ''; $('emoji').textContent = q && q.visual && q.visual.type === 'emoji' ? q.visual.text : ''; shownQ = k;
    if (q) { $('qlabel').textContent = `QUESTION ${k + 1} / ${Q.length}`; $('qtext').textContent = q.q; $('qtext').style.fontSize = (q.q.length > 70 ? 54 : q.q.length > 48 ? 62 : 70) + 'px'; $('fact').textContent = q.fact; } }
  const show = k >= 0; for (const id of ['qlabel', 'qtext', 'tbar', 'tnum', 'fact', 'visual', 'emoji']) $(id).style.opacity = show ? 1 : 0;
  if (show) { const qs = segs[si - (it.part === 'a' ? 1 : 0)], as = segs[si + (it.part === 'q' ? 1 : 0)], qt = t - qs.start, rev = it.part === 'a', at = t - as.start;
    const tm = ep.timers[k], tp = prog(t, tm[0], tm[1] - tm[0]), left = Math.ceil((tm[1] - t) - 1e-6);
    $('qlabel').style.transform = `translateY(${(1 - eout(prog(qt, 0, .3))) * -40}px)`; $('qlabel').style.opacity = prog(qt, 0, .2);
    $('qtext').style.transform = `scale(${lerp(.9, 1, eback(prog(qt, .05, .4)))})`; $('qtext').style.opacity = prog(qt, .05, .2);
    const qh = $('qtext').offsetHeight, barY = 356 + qh + 26; $('tbar').style.top = barY + 'px'; $('tbar').firstChild.style.width = (rev ? 0 : (1 - tp) * 100) + '%'; $('tbar').style.opacity = rev ? 0 : prog(qt, .3, .2);
    const ticking = !rev && t >= tm[0]; $('tnum').style.opacity = ticking ? 1 : 0; $('tnum').textContent = Math.max(1, left); const fr = (tm[1] - t) % 1; $('tnum').style.transform = `scale(${1 + .25 * Math.pow(fr, 6)})`; $('tnum').style.top = (b.factTop + 6) + 'px';
    const vy = Math.max(b.vTop, barY + 40); $('visual').style.top = vy + 'px'; $('visual').style.left = '40px'; $('emoji').style.top = (vy + 30) + 'px';
    $('visual').style.transform = $('emoji').style.transform = `scale(${lerp(.7, 1, eback(prog(qt, .2, .45)))})`; if (!rev) { $('visual').style.opacity = $('emoji').style.opacity = prog(qt, .2, .2); }
    const ans = q.answer;
    b.els.forEach((e, i) => { const inn = prog(qt, .35 + i * .12, .35), ok = i === ans; let tr = b.kind === 'choice' ? `translateX(${(1 - eback(inn)) * (i % 2 ? 300 : -300)}px)` : `scale(${lerp(.6, 1, eback(inn))})`, op = inn > 0 ? Math.min(1, inn * 3) : 0;
      if (!rev && ticking && b.kind !== 'duel') tr += ` translateX(${Math.sin(t * 9 + i * 1.7) * 2.5 * tp}px)`;
      if (rev) { const p = eback(prog(at, 0, .35)); if (ok) tr += ` scale(${1 + .07 * p + Math.sin(t * 5) * .008})`; else op = lerp(1, .32, prog(at, 0, .25)); }
      e.style.transform = tr; e.style.opacity = op;
      if (b.kind === 'choice') { e.className = 'opt' + (rev ? (ok ? ' ok' : ' no') : ''); e.lastChild.textContent = rev ? (ok ? '✓' : '') : ''; }
      else if (b.kind === 'tf') { e.style.background = rev && ok ? (i ? '#c0392b' : '#1faa5e') : 'rgba(14,26,58,.85)'; e.style.color = rev && ok ? '#fff' : (i ? '#ff8f8f' : '#8dffbf'); }
      else { e.lastChild.style.opacity = rev ? prog(at, .15, .3) : 0; e.children[0].style.background = rev && ok ? '#59e38f' : '#4de3ff'; } });
    if (b.kind === 'duel') document.querySelectorAll('#visual .sh path').forEach(p => { const i = +p.parentNode.dataset.i, ok = i === ans; p.setAttribute('fill', rev ? (ok ? '#ffd24d' : '#3d6f86') : '#59d7a8'); });
    const f = $('fact'); f.style.top = b.factTop + 'px'; f.style.opacity = rev ? prog(at, .3, .25) : 0; f.style.transform = `translateY(${(1 - eback(prog(at, .3, .4))) * 70}px)`;
    $('flash').style.opacity = rev ? (1 - prog(at, 0, .22)) * .5 : 0;
  } else { $('flash').style.opacity = 0; }
  // captions on hook / outro only
  const ch = chunks.find(c => t >= c[0].t0 - .05 && t < c.at(-1).t1 + .2), cap = $('cap');
  if (ch !== lastChunk) { cap.innerHTML = ch ? ch.map(w => `<span>${w.w.toUpperCase()}</span>`).join('') : ''; lastChunk = ch; }
  if (ch) [...cap.children].forEach((el, i) => { const w = ch[i], on = t >= w.t0 && t < w.t1 + .04; el.style.color = on ? '#ffd24d' : t >= w.t1 ? '#fff' : 'rgba(255,255,255,.55)'; el.style.transform = `translateY(${on ? -8 : 0}px)`; });
  cap.style.top = outro ? '1560px' : '1500px';
}
window.EP = { duration: ep.duration, segments: segs.map(s => [s.start, s.end]) };
window.renderFrame = frame; await document.fonts.ready; frame(0); window.READY = true;
