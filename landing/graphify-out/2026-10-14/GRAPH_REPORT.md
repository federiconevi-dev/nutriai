# Graph Report - landing  (2026-10-14)

## Corpus Check
- 42 files · ~56,225 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .toml 1)

## Summary
- 310 nodes · 817 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ab722da1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- editor.js
- drawFrame
- ui.js
- ease
- theme
- fastExport
- guard.mjs
- build
- loadAiArt
- sfx
- clip.ts
- addMotions
- finish
- typoKey

## God Nodes (most connected - your core abstractions)
1. `drawFrame()` - 45 edges
2. `ease()` - 38 edges
3. `val()` - 28 edges
4. `back()` - 25 edges
5. `rrect()` - 22 edges
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

## Communities (14 total, 4 thin omitted)

### Community 0 - "editor.js"
Cohesion: 0.03
Nodes (57): AI_STYLE, aiCache, aiPending, aiWait, backupChain, bigRect, brollPicks, C (+49 more)

### Community 1 - "drawFrame"
Cohesion: 0.12
Nodes (30): baseF(), blay(), brollMedia(), brollSeek(), drawFrame(), drawGallery(), drawPerson(), drawPhoto() (+22 more)

### Community 2 - "ui.js"
Cohesion: 0.10
Nodes (28): app, buildPicker(), CATS, COLS, currentSettings(), direct(), drawTl(), fire() (+20 more)

### Community 3 - "ease"
Cohesion: 0.13
Nodes (42): accF(), back(), capShade(), ctaScreen(), drawCaption(), drawChecklist(), drawCounter(), drawEmoji() (+34 more)

### Community 4 - "theme"
Cohesion: 0.11
Nodes (32): ANTON(), bigFont(), bigLayout(), blur(), check(), colorGrade(), coverDraw(), creamBg() (+24 more)

### Community 5 - "fastExport"
Cohesion: 0.14
Nodes (22): audio16k(), deliver(), detectSpeech(), ensureFonts(), exportFonts(), famOf(), fastExport(), frameAt() (+14 more)

### Community 6 - "guard.mjs"
Cohesion: 0.13
Nodes (21): ALLOWED, config, TOGGLES, config, config, config, FRAMES, THEMES (+13 more)

### Community 7 - "build"
Cohesion: 0.14
Nodes (22): build(), clean(), clearMotions(), drawHookCard(), findCta(), findList(), findOverlays(), findScreens() (+14 more)

### Community 8 - "loadAiArt"
Cohesion: 0.29
Nodes (7): aiFree(), aiImage(), aiSlot(), backupImage(), brollVideo(), loadAiArt(), planPrompts()

### Community 9 - "sfx"
Cohesion: 0.21
Nodes (12): blobCover(), blobOpen(), coralFill(), drawArrow(), drawSticker(), mgLoad(), organic(), playSfx() (+4 more)

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastExport()` connect `fastExport` to `editor.js`, `drawFrame`, `sfx`, `build`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `editor.js` be split into smaller, more focused modules?**
  _Cohesion score 0.029411764705882353 - nodes in this community are weakly interconnected._
- **Why does `drawFrame()` connect `drawFrame` to `editor.js`, `ease`, `theme`, `fastExport`, `build`, `sfx`, `finish`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `drawFrame` be split into smaller, more focused modules?**
  _Cohesion score 0.12413793103448276 - nodes in this community are weakly interconnected._
- **Why does `ease()` connect `ease` to `editor.js`, `drawFrame`, `theme`, `build`, `sfx`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._
- **Should `ease` be split into smaller, more focused modules?**
  _Cohesion score 0.13472706155632985 - nodes in this community are weakly interconnected._