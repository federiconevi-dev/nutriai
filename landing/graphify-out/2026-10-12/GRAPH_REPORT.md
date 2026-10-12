# Graph Report - landing  (2026-10-12)

## Corpus Check
- 11 files · ~33,924 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .toml 1)

## Summary
- 235 nodes · 598 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4ab58a2c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editor.js
- drawFrame
- ui.js
- ease
- theme
- fastExport
- llm.mjs
- build
- loadAiArt
- screenTrans
- clip.ts
- ai-image.mjs
- finish
- typoKey

## God Nodes (most connected - your core abstractions)
1. `drawFrame()` - 41 edges
2. `ease()` - 28 edges
3. `val()` - 25 edges
4. `theme()` - 18 edges
5. `build()` - 15 edges
6. `blur()` - 15 edges
7. `fxLayer()` - 15 edges
8. `rrect()` - 14 edges
9. `back()` - 13 edges
10. `drawPhoto()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `broll()` --calls--> `chat()`  [EXTRACTED]
  landing/netlify/functions/ai-plan.mjs → landing/netlify/lib/llm.mjs
- `chat()` --calls--> `ollamaChat()`  [EXTRACTED]
  landing/netlify/lib/llm.mjs → landing/netlify/lib/ollama.mjs

## Import Cycles
- None detected.

## Communities (14 total, 4 thin omitted)

### Community 0 - "editor.js"
Cohesion: 0.04
Nodes (44): AI_STYLE, aiCache, aiPending, aiWait, backupChain, bigRect, brollPicks, C (+36 more)

### Community 1 - "drawFrame"
Cohesion: 0.15
Nodes (31): accF(), baseF(), blay(), brollMedia(), colorGrade(), drawFrame(), drawKin(), drawPerson() (+23 more)

### Community 2 - "ui.js"
Cohesion: 0.11
Nodes (28): app, buildPicker(), CATS, COLS, currentSettings(), direct(), drawTl(), fire() (+20 more)

### Community 3 - "ease"
Cohesion: 0.16
Nodes (26): back(), blur(), check(), creamBg(), ctaScreen(), drawBig(), drawCaption(), drawEmoji() (+18 more)

### Community 4 - "theme"
Cohesion: 0.16
Nodes (24): ANTON(), bigFont(), bigLayout(), coverDraw(), drawBigSmall(), drawBlackout(), drawFrameTitle(), drawScreenArt() (+16 more)

### Community 5 - "fastExport"
Cohesion: 0.17
Nodes (17): audio16k(), brollSeek(), deliver(), detectSpeech(), ensureFonts(), exportFonts(), famOf(), fastExport() (+9 more)

### Community 6 - "llm.mjs"
Cohesion: 0.20
Nodes (9): ALLOWED, config, TOGGLES, config, broll(), config, config, chat() (+1 more)

### Community 7 - "build"
Cohesion: 0.24
Nodes (11): build(), clean(), findCta(), findList(), findOverlays(), findScreens(), fixWords(), norm() (+3 more)

### Community 8 - "loadAiArt"
Cohesion: 0.22
Nodes (9): aiFree(), aiImage(), aiSlot(), backupImage(), brollVideo(), loadAiArt(), pickBroll(), planPrompts() (+1 more)

### Community 9 - "screenTrans"
Cohesion: 0.31
Nodes (9): blobCover(), blobOpen(), coralFill(), organic(), playSfx(), screenTrans(), screenWithBlobs(), sfx() (+1 more)

## Knowledge Gaps
- **1 isolated node(s):** `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 70 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastExport()` connect `fastExport` to `editor.js`, `drawFrame`, `loadAiArt`, `screenTrans`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `editor.js` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Why does `drawFrame()` connect `drawFrame` to `editor.js`, `ease`, `theme`, `fastExport`, `build`, `screenTrans`, `finish`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Should `drawFrame` be split into smaller, more focused modules?**
  _Cohesion score 0.14623655913978495 - nodes in this community are weakly interconnected._
- **Why does `getAsr()` connect `fastExport` to `editor.js`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1053763440860215 - nodes in this community are weakly interconnected._