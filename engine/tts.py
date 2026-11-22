"""Free offline narration with Kokoro v1.0 (kokoro-onnx; any word is pronounced via espeak phonemes).
Writes build/voice/NN.wav per segment. Model files come from GitHub releases (reachable from this workspace).
Voices (English): af_heart (default, best), af_bella, af_nicole, am_michael, am_fenrir, am_puck, bf_emma, bm_george ...
Check a respelling without listening:  python3 engine/tts.py --phonemes "Soop-hahn" """
import json, sys, os, subprocess, wave, re, numpy as np
REL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
O = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
T = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
def words(n):
    if n < 20: return O[n]
    if n < 100: return T[n // 10] + ("-" + O[n % 10] if n % 10 else "")
    if n < 1000: return O[n // 100] + " hundred" + (" " + words(n % 100) if n % 100 else "")
    for v, name in ((10**9, "billion"), (10**6, "million"), (1000, "thousand")):
        if n >= v: return words(n // v) + " " + name + (" " + words(n % v) if n % v else "")
def spell_numbers(t): return re.sub(r"\d[\d,]*", lambda m: words(int(m.group().replace(",", ""))), t)
def ensure_model():
    os.makedirs("voices", exist_ok=True)
    for f in FILES:
        if not os.path.exists("voices/" + f): subprocess.check_call(["curl", "-sfL", "-o", "voices/" + f, REL + f])
def main(ep_path, out="build/voice"):
    from kokoro_onnx import Kokoro
    ensure_model(); ep = json.load(open(ep_path, encoding="utf-8")); v = ep.get("voice", {})
    k = Kokoro("voices/" + FILES[0], "voices/" + FILES[1])
    texts = [ep["hook"]["say"]] + [it["say"] for it in ep["items"]] + [ep["outro"]["say"]]
    os.makedirs(out, exist_ok=True); total = 0
    for i, text in enumerate(texts):
        x, sr = k.create(spell_numbers(text), voice=v.get("name", "af_heart"), speed=v.get("speed", 1.0), lang=v.get("lang", "en-us"))
        x = np.asarray(x, dtype=np.float32).flatten(); idx = np.where(np.abs(x) > .01)[0]
        x = x[max(0, idx[0] - int(.02 * sr)): idx[-1] + int(.08 * sr)]; x = x / (np.abs(x).max() + 1e-9) * .9
        with wave.open(f"{out}/{i:02d}.wav", "w") as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes((x * 32767).astype(np.int16).tobytes())
        total += len(x) / sr
    print(f"voice: {len(texts)} segments, {total:.1f}s of speech")
if __name__ == "__main__":
    if sys.argv[1] == "--phonemes":
        from kokoro_onnx.tokenizer import Tokenizer; print(Tokenizer().phonemize(sys.argv[2], "en-us"))
    else: main(sys.argv[1])
