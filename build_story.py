#!/usr/bin/env python3
"""Story videos (hand-built 3D scene templates):  python3 build_story.py episodes/<id>.json [--stills t1,t2,...] [--keep-voice]
voice (Kokoro) -> timeline -> 3D render -> ambience/sound -> out/<id>.mp4"""
import subprocess, sys, json, os, glob
ep_path = sys.argv[1]; ep = json.load(open(ep_path, encoding="utf-8")); run = lambda *a: subprocess.check_call(list(a))
os.makedirs("build/voice", exist_ok=True); os.makedirs("out", exist_ok=True)
if "--keep-voice" not in sys.argv:
    for f in glob.glob("build/voice/*.wav"): os.remove(f)
    run("python3", "engine/tts.py", ep_path)
run("python3", "engine/timeline.py", ep_path)
if "--stills" in sys.argv:
    run("node", "engine/render.mjs", ep["template"], "--stills", sys.argv[sys.argv.index("--stills") + 1]); sys.exit()
for f in glob.glob("build/scenes/*.mp4"): os.remove(f)
run("node", "engine/render.mjs", ep["template"])
run("python3", "engine/story_sfx.py")
out = f"out/{ep['id']}.mp4"
run("ffmpeg", "-y", "-loglevel", "error", "-i", "build/video_silent.mp4", "-i", "build/audio.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out + ".tmp.mp4")
os.replace(out + ".tmp.mp4", out); print("DONE", out)
