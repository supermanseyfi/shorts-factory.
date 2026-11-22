#!/usr/bin/env python3
"""One command per video:  python3 build.py episodes/<id>.json [--stills t1,t2,...] [--keep-voice] [--resume]
voice (Kokoro) -> timeline -> map -> 3D render (headless Chrome) -> coded sound design -> final mp4 in out/"""
import subprocess, sys, json, os, glob
ep_path = sys.argv[1]; ep = json.load(open(ep_path, encoding="utf-8")); run = lambda *a: subprocess.check_call(list(a))
os.makedirs("build/voice", exist_ok=True); os.makedirs("out", exist_ok=True)
if "--keep-voice" not in sys.argv and "--resume" not in sys.argv:
    for f in glob.glob("build/voice/*.wav"): os.remove(f)
    run("python3", "engine/tts.py", ep_path)
run("python3", "engine/timeline.py", ep_path)
run("node", "engine/prep_map.mjs", ep_path)
if "--resume" not in sys.argv and "--stills" not in sys.argv:
    for f in glob.glob("build/scenes/*.mp4"): os.remove(f)
if "--stills" in sys.argv:
    run("node", "engine/render.mjs", ep["template"], "--stills", sys.argv[sys.argv.index("--stills") + 1]); sys.exit()
run("node", "engine/render.mjs", ep["template"], *(["--resume"] if "--resume" in sys.argv else []))
run("python3", "engine/sfx.py")
out = f"out/{ep['id']}.mp4"
run("ffmpeg", "-y", "-loglevel", "error", "-i", "build/video_silent.mp4", "-i", "build/audio.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out + ".tmp.mp4")
os.replace(out + ".tmp.mp4", out); print("DONE", out)
