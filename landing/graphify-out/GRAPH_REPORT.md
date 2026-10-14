# Graph Report - landing  (2026-10-14)

## Corpus Check
- 12 files · ~39,323 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .toml 1)

## Summary
- 261 nodes · 682 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e10271ee`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editor.js
- drawFrame
- ui.js
- followHead
- ease
- fastExport
- guard.mjs
- build
- loadAiArt
- screenTrans
- clip.ts
- finish
- typoKey
- cutFx

## God Nodes (most connected - your core abstractions)
1. `drawFrame()` - 45 edges
2. `ease()` - 31 edges
3. `val()` - 30 edges
4. `fxLayer()` - 18 edges
5. `theme()` - 18 edges
6. `rrect()` - 17 edges
7. `fastExport()` - 17 edges
8. `build()` - 16 edges
9. `blur()` - 16 edges
10. `back()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `broll()` --calls--> `chat()`  [EXTRACTED]
  landing/netlify/functions/ai-plan.mjs → landing/netlify/lib/llm.mjs
- `chat()` --calls--> `ollamaChat()`  [EXTRACTED]
  landing/netlify/lib/llm.mjs → landing/netlify/lib/ollama.mjs

## Import Cycles
- None detected.

## Communities (14 total, 3 thin omitted)

### Community 0 - "editor.js"
Cohesion: 0.04
Nodes (45): AI_STYLE, aiCache, aiPending, aiWait, backupChain, bigRect, brollPicks, C (+37 more)

### Community 1 - "drawFrame"
Cohesion: 0.11
Nodes (45): accF(), baseF(), blay(), brollMedia(), capShade(), colorGrade(), drawCaption(), drawChecklist() (+37 more)

### Community 2 - "ui.js"
Cohesion: 0.11
Nodes (28): app, buildPicker(), CATS, COLS, currentSettings(), direct(), drawTl(), fire() (+20 more)

### Community 3 - "followHead"
Cohesion: 0.67
Nodes (3): followHead(), loadSeg(), updateMask()

### Community 4 - "ease"
Cohesion: 0.13
Nodes (36): ANTON(), back(), bigFont(), bigLayout(), blur(), check(), coverDraw(), creamBg() (+28 more)

### Community 5 - "fastExport"
Cohesion: 0.12
Nodes (25): audio16k(), brollSeek(), deliver(), detectSpeech(), ensureFonts(), exportFonts(), famOf(), fastExport() (+17 more)

### Community 6 - "guard.mjs"
Cohesion: 0.16
Nodes (16): ALLOWED, config, TOGGLES, config, config, broll(), config, config (+8 more)

### Community 7 - "build"
Cohesion: 0.20
Nodes (15): build(), clean(), drawHookCard(), findCta(), findList(), findOverlays(), findScreens(), fixWords() (+7 more)

### Community 8 - "loadAiArt"
Cohesion: 0.29
Nodes (7): aiFree(), aiImage(), aiSlot(), backupImage(), brollVideo(), loadAiArt(), planPrompts()

### Community 9 - "screenTrans"
Cohesion: 0.43
Nodes (7): blobCover(), blobOpen(), coralFill(), organic(), screenTrans(), screenWithBlobs(), sfx()

### Community 14 - "cutFx"
Cohesion: 0.40
Nodes (5): cutFx(), glitch(), lightLeak(), rgba(), warmLeak()

## Knowledge Gaps
- **1 isolated node(s):** `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 75 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `drawFrame()` connect `drawFrame` to `editor.js`, `followHead`, `ease`, `fastExport`, `build`, `screenTrans`, `finish`, `cutFx`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `editor.js` be split into smaller, more focused modules?**
  _Cohesion score 0.038461538461538464 - nodes in this community are weakly interconnected._
- **Why does `fastExport()` connect `fastExport` to `editor.js`, `drawFrame`, `followHead`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Should `drawFrame` be split into smaller, more focused modules?**
  _Cohesion score 0.10808080808080808 - nodes in this community are weakly interconnected._
- **Why does `getAsr()` connect `fastExport` to `editor.js`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1053763440860215 - nodes in this community are weakly interconnected._