# Graph Report - landing  (2026-10-14)

## Corpus Check
- 42 files · ~57,048 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .toml 1)

## Summary
- 315 nodes · 841 edges · 16 communities (10 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ef82de2f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editor.js
- fxLayer
- ui.js
- moDevice
- drawFrame
- fastExport
- guard.mjs
- build
- loadAiArt
- blobCover
- clip.ts
- addMotions
- finish
- typoKey
- lightLeak
- playSfx

## God Nodes (most connected - your core abstractions)
1. `drawFrame()` - 45 edges
2. `ease()` - 38 edges
3. `val()` - 28 edges
4. `back()` - 24 edges
5. `rrect()` - 23 edges
6. `fxLayer()` - 22 edges
7. `build()` - 20 edges
8. `theme()` - 18 edges
9. `fastExport()` - 17 edges
10. `blur()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `broll()` --calls--> `chat()`  [EXTRACTED]
  netlify/functions/ai-plan.mjs → netlify/lib/llm.mjs
- `chat()` --calls--> `ollamaChat()`  [EXTRACTED]
  netlify/lib/llm.mjs → netlify/lib/ollama.mjs

## Import Cycles
- None detected.

## Communities (16 total, 6 thin omitted)

### Community 0 - "editor.js"
Cohesion: 0.03
Nodes (58): AI_STYLE, aiCache, aiPending, aiWait, backupChain, bigRect, brollPicks, C (+50 more)

### Community 1 - "fxLayer"
Cohesion: 0.14
Nodes (21): blay(), drawArrow(), drawChecklist(), drawMotion(), drawNotif(), drawPerson(), drawSticker(), easeQ() (+13 more)

### Community 2 - "ui.js"
Cohesion: 0.10
Nodes (28): app, buildPicker(), CATS, COLS, currentSettings(), direct(), drawTl(), fire() (+20 more)

### Community 3 - "moDevice"
Cohesion: 0.28
Nodes (22): gx(), moBars(), moCircle(), moCounter(), moDevice(), moFit(), moHeavy(), moIcon() (+14 more)

### Community 4 - "drawFrame"
Cohesion: 0.09
Nodes (68): accF(), ANTON(), back(), baseF(), bigFont(), bigLayout(), blur(), capShade() (+60 more)

### Community 5 - "fastExport"
Cohesion: 0.13
Nodes (24): audio16k(), brollMedia(), brollSeek(), deliver(), detectSpeech(), ensureFonts(), exportFonts(), famOf() (+16 more)

### Community 6 - "guard.mjs"
Cohesion: 0.13
Nodes (21): ALLOWED, config, TOGGLES, config, config, config, FRAMES, THEMES (+13 more)

### Community 7 - "build"
Cohesion: 0.15
Nodes (20): build(), clean(), clearMotions(), drawKin(), findCta(), findList(), findOverlays(), findScreens() (+12 more)

### Community 8 - "loadAiArt"
Cohesion: 0.29
Nodes (7): aiFree(), aiImage(), aiSlot(), backupImage(), brollVideo(), loadAiArt(), planPrompts()

### Community 9 - "blobCover"
Cohesion: 0.60
Nodes (5): blobCover(), blobOpen(), coralFill(), organic(), screenWithBlobs()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastExport()` connect `fastExport` to `editor.js`, `fxLayer`, `drawFrame`, `build`, `playSfx`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `editor.js` be split into smaller, more focused modules?**
  _Cohesion score 0.028985507246376812 - nodes in this community are weakly interconnected._
- **Why does `drawFrame()` connect `drawFrame` to `editor.js`, `fxLayer`, `fastExport`, `build`, `finish`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `fxLayer` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `ease()` connect `drawFrame` to `editor.js`, `fxLayer`, `moDevice`, `build`, `blobCover`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._
- **Should `drawFrame` be split into smaller, more focused modules?**
  _Cohesion score 0.08516242317822652 - nodes in this community are weakly interconnected._