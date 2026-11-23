"""Sound design synthesized from scratch (numpy): music bed, ambience, whooshes, impacts, risers, bells, ticks.
Reads build/episode.json, mixes in the voice wavs when they exist, writes build/audio.wav (48 kHz stereo)."""
import json, numpy as np, wave, os
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly
SR = 48000
rs = np.random.RandomState(7)
ep = json.load(open("build/episode.json", encoding="utf-8"))
DUR = ep["duration"] + 0.6; N = int(DUR * SR)
bus = {k: np.zeros((N, 2)) for k in ("music", "fx", "amb", "voice", "send")}

def tt(d): return np.arange(int(d * SR)) / SR
def filt(x, kind, f, order=2): return sosfilt(butter(order, np.array(f) / (SR / 2), kind, output="sos"), x, axis=0)
def place(b, sig, t, gain=1.0, pan=0.0, send=0.0):
    i = int(t * SR)
    if i >= N or i < 0: return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4; sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1) * 1.414
    sig = sig[: N - i] * gain
    bus[b][i:i + len(sig)] += sig
    if send: bus["send"][i:i + len(sig)] += sig * send
def noise(d): return rs.randn(int(d * SR))
def midi(n): return 440 * 2 ** ((n - 69) / 12)

# ---------- instruments ----------
def kick(g=1.0):
    t = tt(.32); f = 46 + 95 * np.exp(-t * 38); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 11) + .25 * filt(noise(.32), "high", 3000) * np.exp(-t * 300)) * g
def hat(d=.05): t = tt(d); return filt(noise(d), "high", 7000) * np.exp(-t / d * 5) * .5
def clap():
    t = tt(.22); e = sum(np.exp(-np.clip(t - o, 0, None) * 55) * (t >= o) for o in (0, .012, .026)) / 2
    return filt(noise(.22), "band", [900, 3200]) * e
def pluck(f, d=.5, bright=1.0):
    t = tt(d); x = sum(np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (5 + 4.5 * k / bright)) for k in range(1, 8))
    return x * np.minimum(1, t * 400) * .35
def pad(freqs, d):
    t = tt(d); L = np.zeros_like(t); R = np.zeros_like(t)
    for f in freqs:
        for det, pan in ((-.006, -.7), (0, 0), (.007, .7)):
            ph = rs.rand() * 6.28; x = sum(np.sin(2 * np.pi * f * (1 + det) * k * t + ph * k) / k for k in range(1, 7))
            L += x * (1 - pan) / 2; R += x * (1 + pan) / 2
    e = np.minimum(1, t / 1.1) * np.minimum(1, (d - t) / 1.2)
    lfo = .75 + .25 * np.sin(2 * np.pi * .23 * t)
    return filt(np.stack([L, R], 1), "low", 1100) * (e * lfo)[:, None] * .05
def bass(f, d):
    t = tt(d); return np.tanh(1.6 * np.sin(2 * np.pi * f * t)) * np.minimum(1, t * 200) * np.exp(-t * 3.2) * .5
def bell(f, d=1.4, idx=3.0):
    t = tt(d); return np.sin(2 * np.pi * f * t + idx * np.exp(-t * 4) * np.sin(2 * np.pi * f * 3.51 * t)) * np.exp(-t * 3.2) * .4
def tick(f): t = tt(.018); return np.sin(2 * np.pi * f * t) * np.exp(-t * 260) * .5
def whoosh(d=.75, lo=250, hi=5000, rev=False):
    n = noise(d); t = tt(d) / d; out = np.zeros_like(n); cs = np.geomspace(lo, hi, 9)
    pos = np.sin(t * np.pi) ** 1.3 if not rev else t ** 2          # centre-frequency trajectory 0..1
    for k, c in enumerate(cs):
        out += filt(n, "band", [c * .75, c * 1.33]) * np.exp(-((pos * 8 - k) ** 2) / 1.6)
    e = np.sin(t * np.pi) ** 2 if not rev else t ** 2.5 * (t < .985)
    pan = np.linspace(-.8, .8, len(n)); a = (pan + 1) * np.pi / 4
    return np.stack([out * e * np.cos(a), out * e * np.sin(a)], 1) * 1.6
def impact(big=1.0):
    d = 1.6 * big; t = tt(d); f = 34 + 85 * np.exp(-t * 7); sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (3.2 / big))
    th = filt(noise(d), "low", 420) * np.exp(-t * 9) * 1.4 + filt(noise(d), "band", [1500, 6000]) * np.exp(-t * 40) * .25
    return np.tanh((sub + th) * 1.4) * .8
def riser(d):
    t = tt(d) / d; n = whoosh(d, 300, 9000, rev=True); f = 180 * 2 ** (t * 3.2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * t ** 3 * .12 * (t < .985)
    return n * .9 + tone[:, None]
def pop(f=520): t = tt(.09); return np.sin(2 * np.pi * f * (1 + 1.5 * np.exp(-t * 60)) * t) * np.exp(-t * 45) * .5

# ---------- music bed: D minor, 100 BPM, builds with the countdown ----------
BPM = 100; beat = 60 / BPM; bar = 4 * beat
prog = [[38, 57, 62, 65, 69], [34, 58, 62, 65, 70], [41, 57, 60, 65, 69], [36, 55, 60, 64, 67]]  # Dm Bb F C (root, voicing)
segs = ep["segments"]; items = ep["items"]
t_first = segs[1]["start"]; t_top3 = next(s["start"] for s in segs if s["kind"] == "item" and items[s["item"]]["rank"] == 3)
t_one = segs[-2]["start"]; t_out = segs[-1]["start"]
def level(t):  # 0 intro, 1 countdown, 2 top-3, 3 number one, 4 outro
    return 4 if t >= t_out else 3 if t >= t_one + .6 else 2 if t >= t_top3 else 1 if t >= t_first else 0
nb = int(DUR / bar) + 1
for b in range(nb):
    t0 = b * bar; ch = prog[(b // 2) % 4]; lv = level(t0 + .1)
    if b % 2 == 0: place("music", pad([midi(n) for n in ch[1:]], bar * 2 + 1.2), t0, 1.0 + .25 * (lv >= 2), send=.5)
    for s16 in range(16):
        ts = t0 + s16 * beat / 4; lv = level(ts)
        if lv in (1, 2, 3):
            if s16 % 4 == 0: place("music", kick(), ts, .55 if lv == 1 else .7)
            if s16 % 4 == 2: place("music", hat(), ts, .16 + .08 * (lv >= 2), pan=.3)
            if lv >= 2 and s16 % 2 == 1: place("music", hat(.03), ts, .09, pan=-.4)
            if lv >= 2 and s16 in (4, 12): place("music", clap(), ts, .32, send=.5)
            if s16 in (0, 3, 6, 8, 11, 14): place("music", bass(midi(ch[0]), beat * .7), ts, .5)
        if lv >= 1 and lv < 4:
            pat = [0, 2, 3, 1, 2, 3, 0, 2, 3, 1, 2, 3, 0, 3, 2, 1][s16]; n = ch[1 + pat] + (12 if (lv >= 2 and s16 % 4 == 1) else 0)
            place("music", pluck(midi(n), .45, 1.0 + .5 * (lv >= 2)), ts, .2 + .07 * lv, pan=np.sin(s16 * 1.7) * .6, send=.6)
        elif lv == 0 and s16 % 4 == 0:
            place("music", pluck(midi(ch[1 + (s16 // 4) % 4] + 12), .9, .8), ts, .22, pan=np.sin(s16) * .5, send=.9)

# ---------- ambience: high-altitude wind ----------
w = np.stack([noise(DUR), noise(DUR)], 1)[:N]; tN = np.arange(N) / SR
wind = filt(w, "band", [180, 900]) * (.5 + .5 * np.sin(2 * np.pi * .11 * tN + 1))[:, None] + filt(w, "band", [900, 2600]) * (.3 + .3 * np.sin(2 * np.pi * .07 * tN))[:, None] * .5
bus["amb"] += wind * .05

# ---------- sound effects on the picture's cue points ----------
penta = [62, 65, 67, 69, 72, 74, 77, 79, 81, 86]  # D minor pentatonic, climbs as the rank improves
place("fx", riser(max(1.2, t_first - .15)), 0, .35, send=.3)
for k in range(3): place("fx", impact(.55), .12 + k * .16 + .1, .5, send=.3)
for k in range(len(items)): place("fx", bell(midi(penta[k] + 12), .5), 1.0 + k * .22, .16, pan=np.sin(k) * .7, send=.8)
for i, s in enumerate(segs):
    if i == 0: continue
    st = s["start"]
    place("fx", whoosh(.8), st + .02, .55, send=.35)
    if s["kind"] == "item":
        it = items[s["item"]]; top = it["rank"] == 1; k = s["item"]
        place("fx", pop(700), st + .08, .35)
        place("fx", bell(midi(penta[k]), 1.6), st + .12, .34, send=.9)
        place("fx", bell(midi(penta[k] + 7), 1.2), st + .2, .14, pan=.4, send=.9)
        if top:
            place("fx", riser(1.5), st - .95, .6, send=.4)
            for n in (50, 57, 62, 65, 69, 74): place("fx", bell(midi(n + 12), 3.0, 1.5), st + .6, .2, pan=(n % 5 - 2) / 3, send=1.0)
        place("fx", impact(1.5 if top else 1.0), st + .58, 1.0 if top else .7, send=.5)
        nw = next((w_ for w_ in s["words"] if any(c.isdigit() for c in w_["w"])), None)
        n0 = (nw["t0"] - .25) if nw else st + 1.2
        for q in range(16): place("fx", tick(1800 + q * 130), n0 + .05 + .95 * (1 - (1 - q / 16) ** 2.2), .16, pan=.25)
        place("fx", bell(midi(penta[k] + 12), .9), n0 + 1.0, .22, send=.8)
        fw = next((j for j, w_ in enumerate(s["words"]) if w_["w"][-1] == ","), None)
        if fw is not None and fw + 1 < len(s["words"]): place("fx", pop(430), s["words"][fw + 1]["t0"], .3, pan=-.2)
    else:
        for q, k in enumerate(reversed(range(len(items)))): place("fx", pop(500 + q * 60), st + .9 + q * .07, .22, pan=np.sin(q) * .6)
        place("fx", impact(1.2), st + .5, .6, send=.5)
        place("fx", whoosh(1.6, 4000, 200)[::-1], ep["duration"] - 1.5, .3, send=.4)

for t0, t1 in ep.get("timers", []):      # quiz countdowns: clock ticks, then a rising answer chime
    n = int(round((t1 - t0) / .5))
    for q in range(n): place("fx", tick(1500 if q % 2 else 1150), t0 + q * (t1 - t0) / n, .5, pan=-.15 if q % 2 else .15)
    for j, nn in enumerate((74, 79, 86)): place("fx", bell(midi(nn), .9), t1 + .05 + j * .07, .3, send=.8)
# ---------- voice ----------
venv = np.zeros(N)
for s in segs:
    a, b = int(s["vstart"] * SR), int((s["vstart"] + s["vdur"]) * SR); venv[a:b] = 1
    if s.get("voice") and os.path.exists(s["voice"]):
        with wave.open(s["voice"]) as wv:
            x = np.frombuffer(wv.readframes(wv.getnframes()), dtype=np.int16).astype(float) / 32768; sr = wv.getframerate()
        x = resample_poly(x, SR, sr); x = filt(x, "high", 70)
        x = np.tanh(x * 1.5 / (np.abs(x).max() + 1e-9)) / np.tanh(1.5) * .9      # gentle levelling
        place("voice", x, s["vstart"], 1.0, send=.05)
k = int(.12 * SR); duck = np.convolve(venv, np.hanning(k) / np.hanning(k).sum(), "same")

# ---------- reverb + mix + master ----------
ir_t = tt(2.4); ir = np.stack([noise(2.4), noise(2.4)], 1) * np.exp(-ir_t * 2.6)[:, None]; ir = filt(ir, "low", 5200); ir /= np.abs(ir).sum(0).max() * .08
wet = np.stack([fftconvolve(bus["send"][:, c], ir[:, c])[:N] for c in (0, 1)], 1)
music = (bus["music"] + wet * .5) * (1 - .5 * duck)[:, None]
mix = music * .8 + bus["fx"] * (1 - .25 * duck)[:, None] * .9 + bus["amb"] + bus["voice"] * 1.25
fade = np.minimum(1, (DUR - tN) / .8); mix *= np.clip(fade, 0, 1)[:, None]
mix = np.tanh(mix * 1.15); mix /= np.abs(mix).max() / .95
with wave.open("build/audio.wav", "w") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes((mix * 32767).astype(np.int16).tobytes())
print("audio.wav", round(DUR, 2), "s; voice:", "yes" if any(s.get("voice") for s in segs) else "no (music+fx only)")
