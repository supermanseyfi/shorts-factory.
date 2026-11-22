#!/usr/bin/env python3
"""Story cut from real clips:  python3 build_footage.py episodes/<id>.json [--keep-voice] [--stills t1,t2] [--only-seg 4]
voice -> timeline -> background frames from episodes/<id>.shots.json -> captions/titles overlay -> sound -> out/<id>.mp4
--only-seg N re-cuts just that narration segment (e.g. after swapping one clip) and reuses the other rendered scenes."""
import subprocess, sys, json, os, glob
ep_path = sys.argv[1]; ep = json.load(open(ep_path, encoding="utf-8")); run = lambda *a: subprocess.check_call(list(a))
arg = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
os.makedirs("build/voice", exist_ok=True); os.makedirs("out", exist_ok=True); only = arg("--only-seg")
if "--keep-voice" not in sys.argv and not only:
    for f in glob.glob("build/voice/*.wav"): os.remove(f)
    run("python3", "engine/tts.py", ep_path)
run("python3", "engine/timeline.py", ep_path)
shots = ep_path.replace(".json", ".shots.json")
if only: run("python3", "engine/footage_bg.py", shots, only)
else:
    for f in glob.glob("build/bg/*.jpg"): os.remove(f)
    run("python3", "engine/footage_bg.py", shots)
if "--stills" in sys.argv: run("node", "engine/render.mjs", ep["template"], "--stills", arg("--stills")); sys.exit()
for f in glob.glob("build/scenes/*.mp4"):
    if not only or f.endswith(f"scene_{int(only):02d}.mp4"): os.remove(f)
run("node", "engine/render.mjs", ep["template"], *(["--resume"] if only else []))
run("python3", "engine/story_sfx.py")
out = f"out/{ep['id']}.mp4"
run("ffmpeg", "-y", "-loglevel", "error", "-i", "build/video_silent.mp4", "-i", "build/audio.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out + ".tmp.mp4")
os.replace(out + ".tmp.mp4", out); print("DONE", out)
