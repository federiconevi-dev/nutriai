# Graph Report - landing  (2026-10-14)

## Corpus Check
- 42 files · ~59,421 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .toml 1)

## Summary
- 321 nodes · 885 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a858ee3c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editor.js
- drawMotion
- ui.js
- moStag
- drawFrame
- fastExport
- guard.mjs
- build
- aiImage
- blobCover
- clip.ts
- val
- typoKey
- lightLeak

## God Nodes (most connected - your core abstractions)
1. `drawFrame()` - 45 edges
2. `ease()` - 38 edges
3. `val()` - 28 edges
4. `rrect()` - 26 edges
5. `back()` - 24 edges
6. `fxLayer()` - 22 edges
7. `build()` - 20 edges
8. `theme()` - 18 edges
9. `moStag()` - 17 edges
10. `fastExport()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `broll()` --calls--> `chat()`  [EXTRACTED]
  netlify/functions/ai-plan.mjs → netlify/lib/llm.mjs
- `chat()` --calls--> `ollamaChat()`  [EXTRACTED]
  netlify/lib/llm.mjs → netlify/lib/ollama.mjs

## Import Cycles
- None detected.

## Communities (14 total, 3 thin omitted)

### Community 0 - "editor.js"
Cohesion: 0.03
Nodes (66): AI_STYLE, aiCache, aiPending, aiWait, backupChain, bigRect, brollPicks, C (+58 more)

### Community 1 - "drawMotion"
Cohesion: 0.67
Nodes (4): drawMotion(), moBg(), moLaptop(), moRender()

### Community 2 - "ui.js"
Cohesion: 0.10
Nodes (28): app, buildPicker(), CATS, COLS, currentSettings(), direct(), drawTl(), fire() (+20 more)

### Community 3 - "moStag"
Cohesion: 0.28
Nodes (27): gx(), moBars(), moChat(), moCircle(), moCounter(), moDevice(), moFit(), moHeavy() (+19 more)

### Community 4 - "drawFrame"
Cohesion: 0.11
Nodes (58): ANTON(), back(), blay(), blur(), brollMedia(), check(), colorGrade(), coverDraw() (+50 more)

### Community 5 - "fastExport"
Cohesion: 0.11
Nodes (26): audio16k(), brollSeek(), deliver(), detectSpeech(), exportFonts(), fastExport(), frameAt(), finish() (+18 more)

### Community 6 - "guard.mjs"
Cohesion: 0.13
Nodes (21): ALLOWED, config, TOGGLES, config, config, config, FRAMES, THEMES (+13 more)

### Community 7 - "build"
Cohesion: 0.11
Nodes (27): addMotions(), autoMotions(), brollVideo(), build(), clean(), clearMotions(), findCta(), findList() (+19 more)

### Community 8 - "aiImage"
Cohesion: 0.67
Nodes (3): aiFree(), aiImage(), aiSlot()

### Community 9 - "blobCover"
Cohesion: 0.60
Nodes (5): blobCover(), blobOpen(), coralFill(), organic(), screenWithBlobs()

### Community 11 - "val"
Cohesion: 0.16
Nodes (20): accF(), baseF(), bigFont(), bigLayout(), ensureFonts(), famOf(), fontOf(), fontOverride() (+12 more)

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastExport()` connect `fastExport` to `editor.js`, `val`, `drawFrame`, `build`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `editor.js` be split into smaller, more focused modules?**
  _Cohesion score 0.02564102564102564 - nodes in this community are weakly interconnected._
- **Why does `drawFrame()` connect `drawFrame` to `editor.js`, `val`, `fastExport`, `build`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._
- **Why does `ease()` connect `drawFrame` to `editor.js`, `blobCover`, `moStag`, `val`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `drawFrame` be split into smaller, more focused modules?**
  _Cohesion score 0.10707803992740472 - nodes in this community are weakly interconnected._
- **Should `fastExport` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._