# Portfolio improvement loop

One verified change per round. Numbers are phone tier (390x844, iPhone UA) draw calls unless noted.
Gate per round: no console errors except resume.pdf 404; deep link, Back restore and back-to-hall pass at 390x844, 1366x768, 1440x900; all 14 stops reachable; live routes 200 after the Pages build.

## Backlog (top = next)
- [ ] Reduced motion: the OS setting is read once at load (a mid-session change needs a reload). Launchboard has no prefers-reduced-motion rule.
- [ ] Resume link: add resume.pdf ONLY when Jash hands over the approved file.

- [ ] Launchboard All launches window: 17 of 19 bars too narrow for their titles on phones (List tab shows them in full). Tried labels under narrow bars (worker K): rejected in review, read busier and still clipped at the screen edge. Needs a design call, not a patch.

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

### Round 11 (2026-10-11): all seven decks on phones (worker D, reviewed and merged)
- Audit: every slide and step of every deck at 390x844 and 360x740, driven by tap and swipe. 199 defects before (104 at 390, 95 at 360). Most: the Back to the hall pill covered headlines (6 decks); also right-question last-slide button ran off screen (226 to 393 on 390), russia chart labels collided, houthis map labels overlapped or left the canvas (one cut at x -142) and 6.5 px captions, Next landed 74 px past the plate heading, agents-internet swipe did nothing (pointer cancelled by the pan), pakistan-india India label cut and 28x24 source buttons.
- Change: 9 files in decks/, phone-only CSS plus two phone-only JS branches (houthis label placement and Next realign after scroll settles; agents-internet swipe on touch events). No wording, data, tokens, fonts or colours changed.
- After: 0 defects on every deck at both sizes (one documented exception: inline footnote markers ~25x41 hit area). Desktop 1440 layout fingerprint identical on 14 of 14 checked slides.
- Reviewed before/after pairs for over-engineering, right-question, houthis, russia. Gate PASS; sub-page sweep clean (a one-off 9.7 s local load on houthis re-timed at 0.25-0.33 s x4).

### Round 12 (2026-10-11): desktop transit hitch re-measured on a quiet box, no change made
- Quiet box (no other browsers): 8 full desktop tours at 1440x900. Frames over 50 ms per tour: 0, 3, 15, 22, 0, 26, 14, 9 of about 3,700 frames (under 0.7%). The two early transits that worker A suspected were clean in 6 of 7 runs (worst 32-47 ms); one run had 180-220 ms render stalls there, consistent with first-use shader compiles, but it did not repeat.
- Mirror off vs on (3 paired tours): 12, 9, 8 vs 26, 14, 9 over-50 frames. A weak trend, inside run-to-run noise. Not enough evidence to change code.
- Verdict: closed as measured. If it is ever reported by a real visitor, the next test is a one-frame reflector warm-up behind the veil (compile the clipped program variants before the first transit).
- Watch item: once per page sweep, one random page load takes about 9.6 s (houthis locally, russia live) and re-times at 0.25-0.42 s x4. Likely an external request (fonts/CDN) stalling; not reproducible on demand.

### Round 13 (2026-10-11): Fieldfold, Workbench, Jev on phones (worker I, reviewed and merged)
- Before: landscape 844x390 broken on fieldfold (heading, text, buttons overlapped) and workbench (page 874 px wide, Reset cut off); controls below the fold at 360x740; 6/7/14 tap targets under 40 px; hall pill covered footer text, Run, the jev lesson heading and footnote; text down to 7 px; a visible stage seam on workbench phones.
- Change: one <style id=phone-fixes> block per page (+80 lines), no inline blobs touched. Touch-landscape grid for fieldfold and workbench; short-phone compression so all controls show (workbench stage about 184 px at 360x740, chosen over hidden controls).
- After: 0 short tap targets on fieldfold and workbench (jev: one 21 px checkbox with a 44 px label); drag and every button work by touch; load time unchanged; desktop 1440 and 1366 pixel-identical.
- Still open: decorative caps labels at 7-9 px; the shared hall pill covers bottom-left content on scrolling world pages in the first view (fix belongs in the shared pill).

### Round 14 (2026-10-11): Perpetua and Round & Round on phones (worker H, reviewed, one fix of mine, merged)
- Perpetua before: 7 phone tap targets under 40 px; the hall pill hid the start of every toast (123x19); landscape pill on "No last turn."; text down to 6 px; 27 px inspect hotspots (1 of 8 edge probes hit).
- Round & Round before: landscape pill covered "Look a little closer" so a tap left the page; at 375x667 the console covered the stage and Find one marble with no scroll; See this part grew the page from 740 to 1920 px tall at 360 wide; 9-12 short tap targets; text down to 7 px.
- Change: one <style id=phone-fixes> block per page (+31, +41 lines). My review fix: the worker moved the orbit hint to the top of the stage, where it crossed the machine; hidden on phones instead (no free spot; touch users drag by default).
- After: 0 short tap targets; toast clear of the pill; page height stays put; touch orbit, pinch, scrub, step, speed, inspect all work. Desktop geometry and frozen-frame pixels identical.
- Still open: inspect panel covers most of the machine on phones (needs a camera offset in the app script); some labels 9-11 px.

### Round 15 (2026-10-11): Launchboard source fixes, rebuilt and redeployed (worker J, reviewed and merged)
- Source: outputs/launchboard commit 3b66336 (local repo). typecheck clean, 231/231 tests, NDA gate OK, before and after.
- Fixed: launch titles in full on phones (Today 4/6 -> 6/6, Launches 6 weeks 3/6 -> 6/6, quarter 4/6 -> 6/6, client 0/2 -> 2/2); timelines and the revenue chart open on today / the latest week with an edge-fade scroll cue (new ScrollRegion component replaces TimelineScroller); section nav is one scrollable row that centres the active tab (replaces the two-row wrap); ?note=restricted is cleared on role change.
- Deploy: launchboard/ replaced with the new out/; phone-fixes.css and its 194 links removed (the build now carries the rules; keeping the old file would have re-applied the wrap). Diff vs old export: no other post-export patches existed.
- Verified: 60 page-and-role loads with 0 console errors and 0 failed requests; desktop 1440 PNGs byte-identical on 6 pages; gate PASS; Launches tab shows the active tab in view.

### Round 16 (2026-10-11): Launchboard tap areas (worker K, partly merged)
- Fixed: Pipeline forecast company links (18 px), Automations rule links (23 px) and the campaign Linked launch link (18 px) now have 40 px tap areas via the existing phone padding/negative-margin rule (tap-pad class); page heights unchanged. Re-measured 468 page loads: only 2 links inside running sentences remain short.
- Rejected in review: labels printed under narrow All-launches bars (source commit 1b7a1a8); reverted in source commit 99864fd before export.
- Checks: typecheck clean, 231/231 tests, NDA gate OK; gate PASS; Launchboard sweep clean.
