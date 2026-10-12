# Graph Report - landing  (2026-10-12)

## Corpus Check
- 11 files · ~37,020 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .toml 1)

## Summary
- 245 nodes · 642 edges · 15 communities (11 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1feeebb6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editor.js
- drawFrame
- ui.js
- rrect
- ease
- fastExport
- llm.mjs
- build
- loadAiArt
- blobCover
- clip.ts
- ai-image.mjs
- finish
- typoKey
- screenTrans

## God Nodes (most connected - your core abstractions)
1. `drawFrame()` - 45 edges
2. `ease()` - 31 edges
3. `val()` - 30 edges
4. `fxLayer()` - 18 edges
5. `theme()` - 18 edges
6. `rrect()` - 17 edges
7. `build()` - 16 edges
8. `blur()` - 16 edges
9. `fastExport()` - 15 edges
10. `back()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `broll()` --calls--> `chat()`  [EXTRACTED]
  landing/netlify/functions/ai-plan.mjs → landing/netlify/lib/llm.mjs
- `chat()` --calls--> `ollamaChat()`  [EXTRACTED]
  landing/netlify/lib/llm.mjs → landing/netlify/lib/ollama.mjs

## Import Cycles
- None detected.

## Communities (15 total, 4 thin omitted)

### Community 0 - "editor.js"
Cohesion: 0.04
Nodes (44): AI_STYLE, aiCache, aiPending, aiWait, backupChain, bigRect, brollPicks, C (+36 more)

### Community 1 - "drawFrame"
Cohesion: 0.14
Nodes (31): accF(), baseF(), blay(), brollMedia(), colorGrade(), drawCounter(), drawFrame(), drawKin() (+23 more)

### Community 2 - "ui.js"
Cohesion: 0.11
Nodes (28): app, buildPicker(), CATS, COLS, currentSettings(), direct(), drawTl(), fire() (+20 more)

### Community 3 - "rrect"
Cohesion: 0.20
Nodes (17): back(), capShade(), drawCaption(), drawChecklist(), drawEmoji(), drawEndCard(), drawGallery(), drawHook() (+9 more)

### Community 4 - "ease"
Cohesion: 0.16
Nodes (30): ANTON(), bigFont(), bigLayout(), blur(), check(), coverDraw(), creamBg(), ctaScreen() (+22 more)

### Community 5 - "fastExport"
Cohesion: 0.14
Nodes (20): audio16k(), brollSeek(), deliver(), detectSpeech(), ensureFonts(), exportFonts(), famOf(), fastExport() (+12 more)

### Community 6 - "llm.mjs"
Cohesion: 0.20
Nodes (9): ALLOWED, config, TOGGLES, config, broll(), config, config, chat() (+1 more)

### Community 7 - "build"
Cohesion: 0.18
Nodes (17): build(), clean(), drawHookCard(), findCta(), findList(), findOverlays(), findScreens(), fixWords() (+9 more)

### Community 8 - "loadAiArt"
Cohesion: 0.29
Nodes (7): aiFree(), aiImage(), aiSlot(), backupImage(), brollVideo(), loadAiArt(), planPrompts()

### Community 9 - "blobCover"
Cohesion: 0.60
Nodes (5): blobCover(), blobOpen(), coralFill(), organic(), screenWithBlobs()

### Community 14 - "screenTrans"
Cohesion: 0.22
Nodes (9): cutFx(), glitch(), lightLeak(), playSfx(), rgba(), screenTrans(), sfx(), sfxExtra() (+1 more)

## Knowledge Gaps
- **1 isolated node(s):** `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 72 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastExport()` connect `fastExport` to `editor.js`, `drawFrame`, `screenTrans`, `build`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `editor.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0392156862745098 - nodes in this community are weakly interconnected._
- **Why does `drawFrame()` connect `drawFrame` to `editor.js`, `rrect`, `ease`, `fastExport`, `build`, `finish`, `screenTrans`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `drawFrame` be split into smaller, more focused modules?**
  _Cohesion score 0.13978494623655913 - nodes in this community are weakly interconnected._
- **Why does `getAsr()` connect `fastExport` to `editor.js`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1053763440860215 - nodes in this community are weakly interconnected._