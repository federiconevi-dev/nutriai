# Graph Report - landing  (2026-10-12)

## Corpus Check
- 11 files · ~36,241 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .toml 1)

## Summary
- 242 nodes · 630 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `20d58522`
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
1. `drawFrame()` - 44 edges
2. `ease()` - 30 edges
3. `val()` - 29 edges
4. `theme()` - 18 edges
5. `fxLayer()` - 17 edges
6. `build()` - 16 edges
7. `blur()` - 16 edges
8. `rrect()` - 15 edges
9. `fastExport()` - 15 edges
10. `back()` - 14 edges

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
Nodes (47): AI_STYLE, aiCache, aiPending, aiWait, backupChain, bigRect, brollPicks, C (+39 more)

### Community 1 - "drawFrame"
Cohesion: 0.15
Nodes (33): accF(), baseF(), blay(), brollMedia(), colorGrade(), cutFx(), drawCounter(), drawFrame() (+25 more)

### Community 2 - "ui.js"
Cohesion: 0.11
Nodes (28): app, buildPicker(), CATS, COLS, currentSettings(), direct(), drawTl(), fire() (+20 more)

### Community 3 - "ease"
Cohesion: 0.17
Nodes (25): back(), blur(), check(), creamBg(), ctaScreen(), drawCaption(), drawEmoji(), drawGallery() (+17 more)

### Community 4 - "theme"
Cohesion: 0.14
Nodes (25): ANTON(), bigFont(), bigLayout(), coverDraw(), drawBig(), drawBigSmall(), drawBlackout(), drawFrameTitle() (+17 more)

### Community 5 - "fastExport"
Cohesion: 0.16
Nodes (18): audio16k(), brollSeek(), deliver(), detectSpeech(), ensureFonts(), exportFonts(), famOf(), fastExport() (+10 more)

### Community 6 - "llm.mjs"
Cohesion: 0.20
Nodes (9): ALLOWED, config, TOGGLES, config, broll(), config, config, chat() (+1 more)

### Community 7 - "build"
Cohesion: 0.25
Nodes (11): build(), clean(), findCta(), findList(), findOverlays(), findScreens(), fixWords(), norm() (+3 more)

### Community 8 - "loadAiArt"
Cohesion: 0.22
Nodes (9): aiFree(), aiImage(), aiSlot(), backupImage(), brollVideo(), loadAiArt(), pickBroll(), planPrompts() (+1 more)

### Community 9 - "screenTrans"
Cohesion: 0.31
Nodes (9): blobCover(), blobOpen(), coralFill(), organic(), playSfx(), screenTrans(), screenWithBlobs(), sfx() (+1 more)

## Knowledge Gaps
- **1 isolated node(s):** `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 72 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastExport()` connect `fastExport` to `editor.js`, `drawFrame`, `loadAiArt`, `screenTrans`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `editor.js` be split into smaller, more focused modules?**
  _Cohesion score 0.037037037037037035 - nodes in this community are weakly interconnected._
- **Why does `drawFrame()` connect `drawFrame` to `editor.js`, `ease`, `theme`, `fastExport`, `build`, `screenTrans`, `finish`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `drawFrame` be split into smaller, more focused modules?**
  _Cohesion score 0.14962121212121213 - nodes in this community are weakly interconnected._
- **Why does `getAsr()` connect `fastExport` to `editor.js`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1053763440860215 - nodes in this community are weakly interconnected._