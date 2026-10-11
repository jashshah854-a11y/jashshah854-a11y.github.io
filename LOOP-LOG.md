# Portfolio improvement loop

One verified change per round. Numbers are phone tier (390x844, iPhone UA) draw calls unless noted.
Gate per round: no console errors except resume.pdf 404; deep link, Back restore and back-to-hall pass at 390x844, 1366x768, 1440x900; all 14 stops reachable; live routes 200 after the Pages build.

## Backlog (top = next)
- [ ] Desktop transit hitch: NOT video (worker A, 5 paired tours: video off hitched as much as on; 156 play/pause flips line up with hitches at chance; video uploads ~0.2 ms). Stalls are 40-120 ms renderer.render() calls under a busy box. Lead: the first transit (Start to vitrine) hitches in most runs, where hall.startLoading() begins image uploads (17-18 ms texImage2D seen). Re-measure on a QUIET box before changing anything. Scripts: pf/loop-tools/out-a/measure.cjs.
- [ ] Reduced motion: the OS setting is read once at load (a mid-session change needs a reload). Launchboard has no prefers-reduced-motion rule.
- [ ] Resume link: add resume.pdf ONLY when Jash hands over the approved file.

- [ ] Launchboard source: launchboard/ is a static export of outputs/launchboard (Next.js 15 + Tailwind v4). phone-fixes.css rules PORTED to the source app/globals.css (outputs/launchboard commit c0afb9f, local repo), so a rebuild keeps them. Owner-level source fixes: launch-bar titles truncate on phones (list view or two-line bar), scroll containers have no scroll cue and open at the left edge (latest data off screen), nav wrap is a stand-in for a phone menu, ?note=restricted sticks after switching roles.

- [ ] Cyberpunk page (owned by the Corner Block chat, report only): "How I made it" link is 105x20 on phones; in landscape 844x390 the hero video is 718 px tall.

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

### Round 7 (2026-10-11): phone vitrine under budget (worker F, reviewed and merged)
- Method: hid each of the 96 drawn objects in turn and diffed the frame, so every cut rests on a measured pixel effect.
- Changes: Perpetua crank built into the flywheel group on phones (same origin, same theta: verified in perpetua.js), 3 fewer; the two vitrine lamps merged (all tiers), 1 fewer; phone-only per-frame cull of single-sided planes seen from behind (portal planes, Singular picture wall: FrontSide, so exact) and of floor reflection strips under 1 px.
- Phone calls, before -> after: vitrine 100/103 -> 89/89, hall peak 100 -> 89, start 61 -> 58, end 62 -> 55. No stop worse. Every phone stop now under 100 at peak.
- Pixel diff in reduced-motion stills: within the noise floor on phone and desktop.
- Gate: PASS at all three sizes; keyboard walk passes in both motion modes.

### Round 8 (2026-10-11): Launchboard demo on phones (worker E, reviewed and merged)
- Audit: 12 pages x 3 roles x 2 phone sizes = 72 loads. Section nav scrolled sideways with 3 of 7 tabs off screen; revenue chart labels rendered at 9.5 px; 252 text runs under 12 px; 346 tap targets under 40 px.
- Change: launchboard/phone-fixes.css, one max-width:640px block, linked from all 194 exported pages. Nav wraps to two rows; tap areas grow with padding cancelled by negative margin (no layout shift); 11.5 px labels to 12 px; chart min-width 620 -> 800 so labels render 12 px+.
- After: small text 252 -> 0, short targets 346 -> 0, pages with nav off screen 59 -> 0. Desktop 1440 screenshots byte-identical.
- Gate: PASS; sub-page sweep clean.

### Round 9 (2026-10-11): MGMTIO demo on phones (worker G, reviewed and merged)
- Audit at 390x844, 360x740, 844x390, both tabs, both themes: no overflow, no small text, no errors; tap targets under 40 px (Open budgets 33 px, landscape Search/Feedback/theme 34-35 px, action buttons 33 px); the sample-data note lived only in the closed drawer, so phones never saw it.
- Change: mgmtio/index.html, touch-scoped tap sizes and the existing sample-data sentence repeated under the content up to 1180 px, using the page source tokens (--space-5, --text-xs, --fg-5).
- Desktop 1440: zero differing pixels in all four tab/theme states.

### Round 10 (2026-10-11): reduced motion, wheel and swipe step stills
- Cause: with reduced motion there is no scroll camera, so the copy's "Scroll to step back" and "swipe" did nothing.
- Change: main.js, still mode only: one wheel gesture (quiet 500 ms ends it, so trackpad inertia is one gesture) or one swipe over 48 px steps one still. Ignored inside dialogs, the Worlds and Contact sheets, and the stop bar.
- Verified: desktop reduced, two wheel bursts and one tick up walk vitrine, hall, vitrine; phone reduced, swipe up, up, down walk vitrine, hall, vitrine. Normal mode: gate PASS, keyboard walk unchanged, all 14 stops and draw calls unchanged.
