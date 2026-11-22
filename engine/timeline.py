"""Builds build/episode.json: narration segments with timing + word timings for captions.
Uses real voice files (build/voice/NN.wav from tts.py) when present, otherwise an estimate.
Each narration has "say" (what the voice reads; respell foreign names phonetically) and optional
"cap" (what the caption shows) - both must have the same number of space-separated words."""
import json, re, sys, os, wave, numpy as np
CPS = 15.0
def spoken_len(tok):
    core = re.sub(r"[^\w'’]", "", tok)
    return len(core) * 7.5 if core.isdigit() else len(core)   # digits are read out as long words
def wav_read(p):
    with wave.open(p) as w: return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768, w.getframerate()
def phrase_bounds(wavp, n_phr):
    """split the audio at its (n_phr-1) longest silences -> [(t0,t1)] per phrase, or None"""
    x, sr = wav_read(wavp); hop = int(sr * .01)
    e = np.array([np.sqrt(np.mean(x[i:i + hop * 2] ** 2)) for i in range(0, len(x) - hop, hop)])
    sil = e < max(.012, e.max() * .04); gaps = []; i = 0
    while i < len(sil):
        if sil[i]:
            j = i
            while j < len(sil) and sil[j]: j += 1
            if i > 3 and j < len(sil) - 3 and j - i >= 9: gaps.append((j - i, i * .01, j * .01))
            i = j
        else: i += 1
    if len(gaps) < n_phr - 1: return None
    cuts = sorted(sorted(gaps, reverse=True)[: n_phr - 1], key=lambda g: g[1]); out = []; t = 0.0
    for _, a, b in cuts: out.append((t, a)); t = b
    out.append((t, len(x) / sr)); return out
def build(ep_path, out="build/episode.json", voice_dir="build/voice"):
    ep = json.load(open(ep_path, encoding="utf-8"))
    segs = [{"kind": "hook", **ep["hook"]}] + [{"kind": "item", "item": i, "say": it["say"], "cap": it.get("cap")} for i, it in enumerate(ep["items"])] + [{"kind": "outro", **ep["outro"]}]
    t = 0.3
    for i, s in enumerate(segs):
        say = s["say"].split(); cap = (s.get("cap") or s["say"]).split()
        assert len(say) == len(cap), f"say/cap word count differs in segment {i}"
        wavp = os.path.join(voice_dir, f"{i:02d}.wav"); have = os.path.exists(wavp)
        # phrases = runs of words ending in punctuation
        phr = [[]]
        for k, w in enumerate(say):
            phr[-1].append(k)
            if w[-1] in ".!?:,;" and k < len(say) - 1: phr.append([])
        wl = [spoken_len(w) + 1.5 for w in say]
        if have:
            x, sr = wav_read(wavp); vdur = len(x) / sr; bounds = phrase_bounds(wavp, len(phr))
        else:
            vdur = sum(wl) / CPS + .3 * (len(phr) - 1); bounds = None
        if not bounds:
            tot = sum(wl) + 4.5 * (len(phr) - 1); c = 0; bounds = []
            for p in phr: d = sum(wl[k] for k in p) / tot * vdur; bounds.append((c, c + d)); c += d + 4.5 / tot * vdur
        words = []
        for p, (a, b) in zip(phr, bounds):
            tot = sum(wl[k] for k in p); c = a
            for k in p:
                d = wl[k] / tot * (b - a); words.append({"w": cap[k], "t0": round(t + c, 3), "t1": round(t + c + d, 3)}); c += d
        s.update(voice=wavp if have else None, vstart=round(t, 3), vdur=round(vdur, 3), words=words)
        tail = {"hook": .25, "item": .3, "outro": 1.5}[s["kind"]]
        if s["kind"] == "item" and ep["items"][s["item"]]["rank"] == 1: tail = 1.1
        s["start"] = 0.0 if i == 0 else segs[i - 1]["end"]
        s["end"] = round(t + vdur + tail, 3)
        t = s["end"] + 0.22          # the picture leads the voice by 0.22 s
    ep["segments"] = segs; ep["duration"] = segs[-1]["end"]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(ep, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("duration", ep["duration"], "| voice:", "real" if segs[0]["voice"] else "estimated")
    return ep
if __name__ == "__main__": build(sys.argv[1])
