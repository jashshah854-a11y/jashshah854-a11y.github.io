# Portfolio improvement loop

One verified change per round. Numbers are phone tier (390x844, iPhone UA) draw calls unless noted.
Gate per round: no console errors except resume.pdf 404; deep link, Back restore and back-to-hall pass at 390x844, 1366x768, 1440x900; all 14 stops reachable; live routes 200 after the Pages build.

## Backlog (top = next)
- [ ] Vitrine sits at the budget line (100 settled, 102 peak). Next cut: the Perpetua machine is 34 separate meshes in its own vitrine; parts that never move relative to each other can share a draw.
- [ ] Occasional video-decode hitch in desktop transit between worlds.
- [ ] Reduced motion: wheel and swipe do not step stops (bar hint says swipe); OS setting read once at load. Launchboard has no prefers-reduced-motion rule.
- [ ] Resume link: add resume.pdf ONLY when Jash hands over the approved file.

## Rounds

### Round 1 (2026-10-10): static batching now merges non-indexed geometry
- Cause: hall.js static batching skipped any geometry without an index. RoundedBoxGeometry is non-indexed, so every deck and both brass trims on each station drew on their own.
- Change: batch key now carries indexed/non-indexed, so each kind merges with its own kind (mergeGeometries needs all one or the other).
- Phone calls, before -> after: vitrine 152 -> 129, hall 70 -> 61, decks 71 -> 61, end 104 -> 88, worlds ~34 -> ~33. No stop got worse. Screenshots identical.
- Gate: PASS at all three sizes. Commit 83cfee0.

### Round 2 (2026-10-10): the nine drive shafts draw as three instanced meshes
- Note: the 20-minute wakeup after round 1 never fired; round 2 ran four hours late, by hand.
- Cause: each shaft was 4 meshes (body, keys, 2 collars), kept apart because it spins and hides on its own: 36 draws on wide views.
- Change: hall.js builds one InstancedMesh each for bodies, keys and collars; the spin driver writes the matrices, a hidden shaft collapses to zero scale.
- Phone calls, before -> after: vitrine 129 -> 100, hall 61 -> 50, end 88 -> 62. World close-ups 33 -> 36 (the instanced shafts are never culled; still far under budget).
- Gate: PASS at all three sizes; shafts look the same in the hall shot. Commit 4899a17.

### Round 3 (2026-10-10): phones fetch 1024 px picture copies
- Cause: phones downloaded every gallery picture at full size (1440 to 1672 px, up to 390 KB) and then shrank it to 1024 px on a canvas. 6.3 MB in the first 15 s on a phone.
- Change: m/ holds 1024 px copies (q82, progressive) of the 30 pictures the gallery uses, same paths under m/. portal.js loads the copy on the phone tier and falls back to the full picture if a copy is missing.
- Phone, 4G throttle (9 Mbps, 60 ms): first 15 s download 6274 KB -> 3431 KB. Veil 6078 ms (live, before) -> 3158 ms (local, after; live re-measure below).
- Gate: PASS at all three sizes. Phone picture stays sharp in the Fieldfold shot.
- Live after: first 15 s 3282 KB, veil 4288 ms on 4G (first cold run). Commit a936fbc.
- Note: regenerate m/ when a gallery picture changes (outputs/portfolio/loop/small.py).

### Round 4 (2026-10-11): boot modules preload in parallel
- Cause: main.js was found only at the end of the body, and three.core.js only after three.module.js arrived: a three-hop chain before the first frame.
- Change: modulepreload links for main.js, three.module/core, gsap and lenis, placed AFTER the import map (placed before it, a cached second visit resolved "three" before the map existed and the page never booted; caught by the gate, never pushed).
- Phone, 4G throttle, cold cache, median of 5: veil 2527 -> 2235 ms. Live median before this round was 2447 ms, so the phone first-content target (3 s) is met; item closed.
- Gate: PASS at all three sizes; all 14 stops reachable.

### Round 5 (2026-10-11): landscape phone layout (worker B, reviewed and merged)
- Before (844x390): the decks-wing card ran 189 px above the screen and covered Contact (95x44) and Worlds (84x44); Cyberpunk card covered the header; hall copy overlapped both arrows (28x12); Worlds and Contact panels had no Close in landscape.
- Change: one universe.css block for (orientation:landscape) and (max-height:500px): tighter header, card as a compact right column above the arrows, seven decks behind the existing toggle, panels get the existing sheet head with Close. Existing tokens only.
- After: zero overlaps and zero off-screen overlays at all 14 stops at 844x390 and 740x360; portrait overlay rects identical before/after.
- Gate: PASS at all three sizes. Reviewed screenshots: decks wing, hall, Worlds panel.

### Round 6 (2026-10-11): keyboard and reduced-motion tour (worker C, reviewed and merged)
- Audit: reduced motion already cuts between stills with zero idle renders; skip link first; dialogs open with Enter, close with Escape, focus returns.
- Fixed: Left/Right arrows did nothing (copy says "the arrows"); Home/End did nothing in reduced motion; focus fell to BODY when an end arrow disabled itself; the stop live region sat inside a display:none bar on desktop so it was never announced.
- Verified independently: Right, Right, Left, End, Home walk vitrine, hall, vitrine, end, start in both normal and reduced motion.
- Gate: PASS at all three sizes.
