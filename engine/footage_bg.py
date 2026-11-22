"""Cuts real clips into background frames for the story-footage template.
usage: python3 engine/footage_bg.py shots.json   -> build/bg/NNNNNN.jpg (1080x1920, 30 fps)
shots.json: [{"seg": 0, "from": 0.0, "to": 1.0, "file": "...", "t0": 1.5, "vf": "crop=...,", "grade": "eq=..."}]
"seg" = narration segment index, "from"/"to" = fraction of that segment the shot covers."""
import json, sys, subprocess, os, glob
ep = json.load(open("build/episode.json", encoding="utf-8")); shots = json.load(open(sys.argv[1])); only = set(map(int, sys.argv[2].split(","))) if len(sys.argv) > 2 else None
os.makedirs("build/bg", exist_ok=True); total = round(ep["duration"] * 30)
for sh in shots:
    if only is not None and sh["seg"] not in only: continue
    s = ep["segments"][sh["seg"]]; d = s["end"] - s["start"]; a = s["start"] + d * sh.get("from", 0); b = s["start"] + d * sh.get("to", 1)
    f0 = round(a * 30); f1 = total if sh["seg"] == len(ep["segments"]) - 1 and sh.get("to", 1) == 1 else round(b * 30); n = f1 - f0
    if sh.get("frames"):                                   # ready-made frame sequence (e.g. a 3D shot)
        src = sorted(glob.glob(sh["frames"]))
        for i in range(n): subprocess.check_call(["cp", src[min(i, len(src) - 1)], f"build/bg/{f0 + i:06d}.jpg"])
        continue
    vf = "fps=30," + sh.get("vf", "") + "scale=1080:1920:flags=lanczos,setsar=1" + ("," + sh["grade"] if sh.get("grade") else "")
    subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(sh.get("t0", 0)), "-i", sh["file"], "-vf", vf, "-frames:v", str(n), "-start_number", str(f0), "-q:v", "3", "build/bg/%06d.jpg"])
    got = len([1 for i in range(f0, f1) if os.path.exists(f"build/bg/{i:06d}.jpg")])
    if got < n:                                            # clip ran out: hold its last frame
        last = f"build/bg/{f0 + got - 1:06d}.jpg"
        for i in range(f0 + got, f1): subprocess.check_call(["cp", last, f"build/bg/{i:06d}.jpg"])
    print(f"seg {sh['seg']} frames {f0}-{f1} from {os.path.basename(sh['file'])}" + (" (held last frame)" if got < n else ""))
