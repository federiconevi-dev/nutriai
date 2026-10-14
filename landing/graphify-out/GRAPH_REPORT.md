# Graph Report - landing  (2026-10-14)

## Corpus Check
- 42 files · ~60,114 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .toml 1)

## Summary
- 328 nodes · 906 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e0039d83`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editor.js
- finish
- ui.js
- rrect
- drawFrame
- fastExport
- guard.mjs
- build
- on
- blobCover
- clip.ts
- theme
- playSfx
- typoKey

## God Nodes (most connected - your core abstractions)
1. `drawFrame()` - 45 edges
2. `ease()` - 38 edges
3. `val()` - 28 edges
4. `rrect()` - 26 edges
5. `back()` - 25 edges
6. `build()` - 22 edges
7. `fxLayer()` - 22 edges
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

## Communities (14 total, 4 thin omitted)

### Community 0 - "editor.js"
Cohesion: 0.03
Nodes (56): AI_STYLE, aiCache, aiPending, aiWait, backupChain, bigRect, brollPicks, C (+48 more)

### Community 2 - "ui.js"
Cohesion: 0.09
Nodes (31): app, buildPicker(), CATS, COLS, currentSettings(), direct(), drawTl(), fire() (+23 more)

### Community 3 - "rrect"
Cohesion: 0.28
Nodes (29): gx(), moBars(), moChat(), moCircle(), moCounter(), moDevice(), moFit(), moHeavy() (+21 more)

### Community 4 - "drawFrame"
Cohesion: 0.07
Nodes (61): accF(), back(), baseF(), blay(), brollMedia(), brollSeek(), capShade(), ctaScreen() (+53 more)

### Community 5 - "fastExport"
Cohesion: 0.14
Nodes (22): audio16k(), deliver(), detectSpeech(), ensureFonts(), exportFonts(), famOf(), fastExport(), frameAt() (+14 more)

### Community 6 - "guard.mjs"
Cohesion: 0.13
Nodes (21): ALLOWED, config, TOGGLES, config, config, config, FRAMES, THEMES (+13 more)

### Community 7 - "build"
Cohesion: 0.13
Nodes (22): addMotions(), autoMotions(), build(), clean(), clearMotions(), drawHookCard(), findCta(), findList() (+14 more)

### Community 8 - "on"
Cohesion: 0.25
Nodes (8): aiFree(), aiImage(), aiSlot(), brollVideo(), fxTop(), loadAiArt(), on(), planPrompts()

### Community 9 - "blobCover"
Cohesion: 0.60
Nodes (5): blobCover(), blobOpen(), coralFill(), organic(), screenWithBlobs()

### Community 11 - "theme"
Cohesion: 0.12
Nodes (34): ANTON(), bigFont(), bigLayout(), blur(), check(), colorGrade(), coverDraw(), creamBg() (+26 more)

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastExport()` connect `fastExport` to `editor.js`, `on`, `drawFrame`, `playSfx`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `editor.js` be split into smaller, more focused modules?**
  _Cohesion score 0.02857142857142857 - nodes in this community are weakly interconnected._
- **Why does `drawFrame()` connect `drawFrame` to `editor.js`, `finish`, `rrect`, `fastExport`, `build`, `on`, `theme`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0944741532976827 - nodes in this community are weakly interconnected._
- **Why does `ease()` connect `drawFrame` to `editor.js`, `rrect`, `build`, `blobCover`, `theme`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `drawFrame` be split into smaller, more focused modules?**
  _Cohesion score 0.07431693989071038 - nodes in this community are weakly interconnected._
- **Should `fastExport` be split into smaller, more focused modules?**
  _Cohesion score 0.14492753623188406 - nodes in this community are weakly interconnected._