#!/usr/bin/env python3
"""Quiz videos:  python3 build_quiz.py episodes/<id>.json [--stills t1,t2,...] [--keep-voice]
Each question becomes two narration items (question + 3 s countdown, then answer). voice -> timeline -> shapes -> render -> sound -> out/<id>.mp4"""
import subprocess, sys, json, os, glob
ep_path = sys.argv[1]; ep = json.load(open(ep_path, encoding="utf-8")); run = lambda *a: subprocess.check_call(list(a))
os.makedirs("build/voice", exist_ok=True); os.makedirs("out", exist_ok=True)
L = "ABCD"; qs = ep["questions"]; items = []; n = len(qs) * 2
for k, q in enumerate(qs):
    ans = q["options"][q["answer"]]
    items.append({"rank": n - 2 * k, "say": q.get("say", q["q"]), "tail": ep.get("think", 3.0) + .15, "qi": k, "part": "q"})
    items.append({"rank": n - 2 * k - 1, "say": q.get("sayAnswer") or f"{ans}! {q['fact']}", "tail": .45, "qi": k, "part": "a"})
ep["items"] = items; json.dump(ep, open("build/_quiz.json", "w", encoding="utf-8"), ensure_ascii=False)
if "--keep-voice" not in sys.argv:
    for f in glob.glob("build/voice/*.wav"): os.remove(f)
    run("python3", "engine/tts.py", "build/_quiz.json")
run("python3", "engine/timeline.py", "build/_quiz.json")
e = json.load(open("build/episode.json", encoding="utf-8"))
e["timers"] = [[round(s["vstart"] + s["vdur"] + .12, 3), s["end"]] for s in e["segments"] if s["kind"] == "item" and e["items"][s["item"]]["part"] == "q"]
json.dump(e, open("build/episode.json", "w", encoding="utf-8"), ensure_ascii=False)
run("node", "engine/prep_shapes.mjs")
if "--stills" in sys.argv: run("node", "engine/render.mjs", "quiz", "--stills", sys.argv[sys.argv.index("--stills") + 1]); sys.exit()
for f in glob.glob("build/scenes/*.mp4"): os.remove(f)
run("node", "engine/render.mjs", "quiz"); run("python3", "engine/sfx.py")
out = f"out/{ep['id']}.mp4"
run("ffmpeg", "-y", "-loglevel", "error", "-i", "build/video_silent.mp4", "-i", "build/audio.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out + ".tmp.mp4")
os.replace(out + ".tmp.mp4", out); print("DONE", out)
