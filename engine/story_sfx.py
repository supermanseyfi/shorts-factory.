"""Sound for story videos, synthesized with numpy: narration + sea wash, gull cries, a ferry horn and a soft drone.
Reads build/episode.json and build/voice/NN.wav, writes build/audio.wav (48 kHz stereo)."""
import json, numpy as np, wave, os
from scipy.signal import butter, sosfilt, resample_poly
SR = 48000; rs = np.random.RandomState(11)
ep = json.load(open("build/episode.json", encoding="utf-8")); DUR = ep["duration"] + .6; N = int(DUR * SR)
mix = np.zeros((N, 2)); t = np.arange(N) / SR
def filt(x, kind, f, order=2): return sosfilt(butter(order, np.array(f) / (SR / 2), kind, output="sos"), x, axis=0)
def place(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    a = (pan + 1) * np.pi / 4; st = np.stack([sig * np.cos(a), sig * np.sin(a)], 1) * 1.414 * gain; st = st[: N - i]; mix[i:i + len(st)] += st
# sea: band-limited noise with slow swells
for ch, seed in ((0, 1), (1, 2)):
    n = np.random.RandomState(seed).randn(N); sea = filt(n, "bandpass", [180, 2400]); swell = .55 + .45 * np.sin(2 * np.pi * (.13 + .02 * ch) * t + ch) * np.sin(2 * np.pi * .047 * t + 1)
    mix[:, ch] += sea * swell * .035 + filt(n, "lowpass", 160) * .05
# soft drone (D minor), slow tremolo
for f, g in ((73.42, .05), (146.83, .035), (220.0, .022), (293.66, .016), (349.23, .012)):
    for ch in (0, 1): mix[:, ch] += np.sin(2 * np.pi * f * (1 + .0015 * ch) * t + ch) * g * (.7 + .3 * np.sin(2 * np.pi * .09 * t + f))
def gull(d=.38, f0=2300):
    x = np.arange(int(d * SR)) / SR; f = f0 * (1 + .35 * np.sin(np.pi * x / d)) * (1 - .25 * x / d); ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + .5 * np.sin(2 * ph) + .25 * np.sin(3 * ph)) * np.sin(np.pi * x / d) ** 1.5; return y * (1 + .3 * np.sin(2 * np.pi * 38 * x))
def horn(d=2.6):
    x = np.arange(int(d * SR)) / SR; y = sum(np.sin(2 * np.pi * f * x) * g for f, g in ((138, 1), (207, .6), (276, .35), (414, .15)))
    env = np.minimum(1, x / .15) * np.minimum(1, (d - x) / .5); return filt(y * env, "lowpass", 900)
segs = ep["segments"]; quiet = {3, 4}                      # no gulls at night / in the legend's dark scenes
for i, s in enumerate(segs):
    if i in quiet: continue
    k = s["start"] + .4
    while k < s["end"] - .5:
        f0 = 1900 + rs.rand() * 900; pan = rs.rand() * 1.6 - .8; g = .02 + rs.rand() * .035
        for j in range(1 + rs.randint(3)): place(gull(.28 + rs.rand() * .2, f0 * (1 - .04 * j)), k + j * .42, g, pan)
        k += 1.6 + rs.rand() * 2.6
place(horn(), segs[1]["start"] + 1.2, .05, -.4); place(horn(2.2), segs[-2]["start"] + .8, .06, .4); place(horn(1.2), segs[-2]["start"] + 3.6, .04, .4)
# night bell-ish tone for the lighthouse scene, low thud when the snake appears
x = np.arange(int(1.2 * SR)) / SR; place(np.sin(2 * np.pi * 55 * x) * np.exp(-x * 4) , segs[4]["end"] - 1.5, .5)
mix = np.clip(mix, -1, 1) * 1.0
fade = np.minimum(1, t / .4) * np.minimum(1, (DUR - t) / .8); mix *= fade[:, None]
for i, s in enumerate(segs):
    if not s.get("voice") or not os.path.exists(s["voice"]): continue
    with wave.open(s["voice"]) as w: v = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768; vsr = w.getframerate()
    v = resample_poly(v, SR, vsr); j = int(s["vstart"] * SR); v = v[: N - j]; mix[j:j + len(v)] += np.stack([v, v], 1) * .85
mix = np.clip(mix, -1, 1)
with wave.open("build/audio.wav", "w") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("audio.wav", round(DUR, 2), "s")
