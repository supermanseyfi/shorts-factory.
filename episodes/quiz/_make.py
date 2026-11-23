"""Helper to write quiz episode files compactly:  python3 episodes/quiz/_make.py  (edit the SETS list, re-run)."""
import json, sys
V = {"name": "af_heart", "speed": 1.15}
RANKS = lambda n: [[f"{n}/{n}", "GEOGRAPHY GENIUS"], [f"{n-2}-{n-1}", "WORLD EXPLORER"], [f"0-{n-3}", "TIME TO TRAVEL"]]
def ep(id, series, title, hook, qs, outro="How many did you get? Comment your score!", sub=None):
    Q = []
    for q in qs:
        d = dict(q); d.setdefault("kind", "choice")
        if d["kind"] == "tf": d["options"] = ["True", "False"]
        Q.append(d)
    n = len(Q)
    e = {"id": id, "template": "quiz", "lang": "en-US", "voice": V, "series": series, "title": title, "hook": {"say": hook}, "outro": {"say": outro},
         "outroLines": ["HOW MANY DID YOU GET?", "COMMENT YOUR SCORE"], "ranks": RANKS(n), "questions": Q}
    if sub: e["sub"] = sub
    json.dump(e, open(f"episodes/quiz/{id}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
def load(path):
    for s in json.load(open(path, encoding="utf-8")): ep(**s)
if __name__ == "__main__": load(sys.argv[1])
