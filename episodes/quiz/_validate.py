"""Checks a quiz batch file:  python3 episodes/quiz/_validate.py episodes/quiz/_batch_xx.json   (prints problems; 'OK n sets' when clean)"""
import json, sys, re
W = json.load(open("node_modules/world-atlas/countries-50m.json")); U = json.load(open("node_modules/us-atlas/states-10m.json"))
C = {str(int(g["id"])) for g in W["objects"]["countries"]["geometries"] if g.get("id")}; S = {str(int(g["id"])) for g in U["objects"]["states"]["geometries"]}
sets = json.load(open(sys.argv[1], encoding="utf-8")); bad = []; seen = set(); ids = set()
for s in sets:
    i = s.get("id", "?"); e = lambda m: bad.append(f"{i}: {m}")
    for k in ("id", "series", "title", "hook", "qs"):
        if k not in s: e(f"missing {k}")
    if i in ids: e("duplicate id")
    ids.add(i)
    if len(s.get("title", [])) != 3 or any(len(t) > 14 for t in s.get("title", [])): e("title must be 3 lines of <=14 chars")
    if len(s.get("hook", "").split()) > 22: e("hook longer than 22 words")
    if len(s.get("qs", [])) != 5: e("needs exactly 5 questions")
    for n, q in enumerate(s.get("qs", [])):
        f = lambda m: e(f"q{n+1} {m}"); kind = q.get("kind", "choice")
        for k in ("q", "answer", "fact", "sayAnswer", "src"):
            if k not in q: f(f"missing {k}")
        if len(q.get("q", "")) > 78: f("question longer than 78 chars")
        if len(q.get("fact", "")) > 84: f("fact longer than 84 chars")
        if kind == "tf":
            if q.get("answer") not in (0, 1): f("tf answer must be 0 (true) or 1 (false)")
            if not re.match(r"(True|False)!", q.get("sayAnswer", "")) or (q.get("sayAnswer", "").startswith("True") != (q.get("answer") == 0)): f("sayAnswer must start with True!/False! matching answer")
        else:
            o = q.get("options", [])
            if kind == "duel":
                if not 2 <= len(o) <= 3: f("duel needs 2-3 options")
                v = q.get("values", [])
                if len(v) != len(o): f("values must match options")
                elif q.get("answer") != max(range(len(v)), key=lambda j: v[j]): f("answer is not the largest value")
                if len((q.get("visual") or {}).get("ids", [])) != len(o): f("visual.ids must match options")
                if "unit" not in q: f("missing unit")
            elif len(o) != 4: f("choice needs 4 options")
            if any(len(x) > 22 for x in o): f("option longer than 22 chars")
            if len(set(o)) != len(o): f("duplicate options")
            if not isinstance(q.get("answer"), int) or not 0 <= q.get("answer", -1) < len(o): f("answer index out of range")
        vis = q.get("visual")
        if vis:
            if kind != "duel" and vis.get("type") not in ("emoji", "shapes"): f("visual.type must be emoji or shapes")
            for sid in vis.get("ids", []):
                k, _, code = sid.partition(":")
                if not code.isdigit() or str(int(code)) not in (C if k == "c" else S if k == "s" else set()): f(f"unknown shape id {sid}")
        key = (kind, q.get("q"), tuple(q.get("options", [])), json.dumps(vis, sort_keys=True))
        if key in seen: f("duplicate question")
        seen.add(key)
print("\n".join(bad) if bad else f"OK {len(sets)} sets")
sys.exit(1 if bad else 0)
