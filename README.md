# shorts-factory

Automated vertical videos (Shorts / Reels / TikTok): 1080x1920, 30 fps, ~60 s, English, 3D animated ranking
videos with burned-in word-by-word captions, a free offline voice (Kokoro) and sound design synthesized in code.

## One video = one episode file

    npm ci                                   # three, puppeteer-core, world-atlas, topojson-client
    pip install --break-system-packages kokoro-onnx numpy scipy
    python3 build.py episodes/<id>.json --stills 1.5,9,30,58     # check frames first (build/still_*.jpg)
    python3 build.py episodes/<id>.json                          # full build -> out/<id>.mp4 (~15 min)

Needs: `ffmpeg`, Google Chrome at /usr/bin/google-chrome (or set CHROME), Python 3, Node 20+.
Voice model files (~350 MB) download once from GitHub releases into voices/.

## Pipeline

| step | file | what it does |
|---|---|---|
| voice | engine/tts.py | Kokoro v1.0 narration per segment -> build/voice/NN.wav |
| timing | engine/timeline.py | scene + word timings from the real audio (captions follow the voice) |
| map | engine/prep_map.mjs | country outlines around `map.center` from Natural Earth |
| picture | engine/render.mjs + template/ranking-map | Three.js scene filmed frame-by-frame in headless Chrome, one mp4 per scene, concat |
| sound | engine/sfx.py | music bed, wind, whooshes, impacts, risers, bells, ticks - all synthesized with numpy; ducks under the voice |
| mux | build.py | loudness-normalised (-14 LUFS) AAC + video copy |

## Episode spec (see episodes/001-turkey-10-highest-mountains.json)

- `map.center` [lon, lat], `map.highlight` [ISO numeric country ids as strings, e.g. "792" Türkiye, "840" USA],
  optional `map.scale` (world units per degree; 1 for one country, ~0.12 for whole-world topics), optional `map.lakes`.
- `items` (exactly the ranking, worst -> best): `rank, name, sub, value, lat, lon, style, fact, say, cap`.
  `style`: `volcano` | `jagged` | `massif` (3D mountains) or `column` (3D bar: cities, lakes, buildings, anything).
- `say` is what the voice reads, `cap` what the caption shows; same word count. Respell foreign names for the voice
  (`python3 engine/tts.py --phonemes "Soop-hahn"` prints how it will be pronounced). Write numbers as digits.
- `barMin`: left end of the value bar. `voice.speed`: raise (max ~1.25) until the video is 55-62 s.

## Rules for every episode

1. Research every number with web search, 2+ sources; when sources disagree pick one definition and keep it consistent.
2. Hook in the first 2 seconds, countdown 10 -> 1, a question at the end to drive comments.
3. Always look at stills (hook, two middle items, #1, outro) before the full render; fix overlaps/clipping first.
4. Final check: duration 55-65 s, 1080x1920, audio present, loudness about -14 LUFS.
