# Portfolio improvement loop

One verified change per round. Numbers are phone tier (390x844, iPhone UA) draw calls unless noted.
Gate per round: no console errors; deep link, Back restore and back-to-hall pass at 390x844, 1366x768, 1440x900; all 14 stops reachable; live routes 200 after the Pages build.

## Backlog (top = next)
- [ ] Reduced motion: the OS setting is read once at load (a mid-session change needs a reload). Launchboard has no prefers-reduced-motion rule.
- [x] Resume link: resume.pdf added 2026-10-11 (Resume B, Oct 2; public copy without phone, HubSpot or "AI-assisted"; source pf/resume-work).

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

### Round 17 (2026-10-11): the hall pill is a round arrow on phones
- Decision (Jash asked the loop to decide by his taste): on phones the worded Back to the hall pill (137x44) became a 44x44 round arrow; same reasoning as his earlier call for light arrows over a heavy bottom bar. Desktop keeps the label. The label stays in the DOM at font-size 0, so screen readers still hear it.
- Before -> after, elements the pill covered in the first view across 13 pages: 390x844 4 -> 1, 360x740 2 -> 1. The one left on agents-internet is the headline box edge, not text (checked in a screenshot).
- Jev: its note line (also used for the 3D-unavailable message, so it stays visible) starts 34 px in on phones to clear the arrow.
- Gate PASS; sub-page sweep clean.

### Round 18 (2026-10-11): desktop command bar (borrowed from hancore.dev, built in the site's own tokens)
- Change: press : or / on desktop to open a jump bar; type to filter worlds, decks, Worlds and Contact; Enter goes there (universe/command.js, wired through ui.js and a goStop action in main.js). The Worlds sheet carries a one-line "Press : to jump anywhere" hint. Hidden on touch and coarse pointers, so phones are unchanged.
- Verified: cmd-verify PASS in motion and reduced motion (open, filter, click, Enter, Escape, hint, hidden on phone); keyboard walk across all 14 stops unchanged; gate PASS twice on the new Node test server (serve.cjs, replaces python http.server, which dropped connections under Launchboard load).
- Next: Greybeard item 1, one plain sentence on the first screen saying what Jash does.

### Round 19 (2026-10-11): the home says what Jash does (Greybeard item 1)
- Before: the first screen, the last stop and the share description never said what Jash does ("You are inside a machine." then "Drag to turn it.").
- Change: one line, "Growth marketer who builds working tools, not just reports.", under the headline and under "Built by Jash Shah", in the site serif italic (24 px, 20 px on phones, balanced wrap). Meta, og and twitter descriptions now lead with what he does. Line picked by an Opus counsel pass against the runner-up "builds marketing apps, research decks and 3D machines with AI" (a list, and "with AI" has no proof on screen).
- Verified: screenshots at 390, 360, 844 landscape, 1366 and the end stop; gate PASS; live HTML carries the line (commit 56cdd6d).

### Round 20 (2026-10-11): CDN failure fallback (Greybeard item 2)
- Before: if three.js failed to load, the visitor waited 25 s, then saw "Assembling the machine" above a list with no email and no decks; noscript had no LinkedIn, email or decks.
- Change: the module script's error event shows the plain list at once; the hung-fetch backstop is 15 s (was 25); a new "dead" veil state hides the stale text and bar (the no-WebGL path keeps "fail" and is untouched); plain list and noscript now carry 8 worlds, LinkedIn, Email and the 7 decks, scrollable on short screens; if the module lands after the backstop, main.js takes the list back down.
- After (fallback-verify.cjs, CDN blocked): list shown in 445 ms on phone and 293 ms on desktop, no stale text, 17 links, last deck reachable; noscript 17 links.
- Test tool: gate.cjs now ignores only ERR_ABORTED on Next.js _rsc prefetches (the gate leaves Launchboard while it prefetches; the files serve 200 local and live; the pushed state failed the same way, so not caused by this change). Real 4xx/5xx still fail.
- Next: Greybeard item 3, og image and description on every sub-page.

### Round 21 (2026-10-11): share previews on 13 sub-pages (Greybeard item 3)
- Before: 13 of 15 sub-pages had no og or twitter tags (a shared link showed no image or title); fieldfold, workbench and jev had no meta description.
- Change: og + twitter tags (title, description, url, 1200x630 image, alt) on perpetua, round-and-round, fieldfold, workbench, jev, mgmtio and the 7 decks, following the cyberpunk page's pattern. Images are crops of existing stills and deck covers in media/share/ (13 files, 1.4 MB; MGMTIO top-anchored so its header shows). Descriptions reuse each page's own; the three missing ones use the world line from data.js. Script: loop-tools/og.py (skips any page that already has og tags).
- Not touched: cyberpunk and corner-block (owned by the other chat), launchboard (its head comes from the Next.js source; do it there).
- Verified: all 13 image URLs 200; sub-page sweep 34/34 ok locally; gate PASS.
- Next: launchboard share tags in source; then Greybeard item 4, generate #plain and noscript from data.js with --check.

### Round 22 (2026-10-11): one source for the plain-link lists (Greybeard item 4)
- Before: the world list lived in three places (data.js, #plain, noscript) and had already drifted once (noscript lacked LinkedIn until round 20).
- Change: tools/plain-links.mjs writes both lists in index.html from universe/data.js (WORLDS with a page, LINKEDIN, EMAIL, DECKS; Perpetua first because it stands in the vitrine). `--check` exits 1 when index.html is out of date.
- Verified: first run byte-identical to the hand-written lists (proves the generator matches); drift test (Email removed from noscript) -> --check exit 1, rewrite restores byte-identical.
- Rule from now on: after editing data.js, run `node tools/plain-links.mjs`; run `--check` before each push.
- Next: launchboard share tags in source (needs an export, the heavy job); then item 5, one vendored three.js r186.

### Round 23 (2026-10-11): a 404 page (Greybeard item 7)
- Before: a wrong URL showed GitHub's generic 404, with no way back into the site.
- Change: 404.html in the home's own layout and tokens (links /universe/universe.css, same fonts, pills): "This part of / the machine is missing." with Back to the start, Go to the hall (/#hall) and Email. noindex. Absolute paths, because Pages serves it at any depth.
- Verified: /no/such/page returns 404 with the page at 390 and 1366, Instrument Serif, night background, 0 px overflow, no console errors; Go to the hall lands on The hall. Test server serve.cjs now serves 404.html the way Pages does.
- Next: launchboard share tags in source (export is the heavy job; wait for a quiet laptop); item 5 vendored three.js; item 6 shorter desktop veil.

### Round 24 (2026-10-11): the home serves three.js from the site (Greybeard item 5, part 1)
- Before: the home loaded the non-minified three r186 (module + core, about 418 KB on the wire), gsap and lenis from jsdelivr. A blocked or slow jsdelivr meant no site.
- Change: vendor/ holds the exact pinned files (three@0.186.1, gsap@3.15.0, lenis@1.3.26) from npm, each minified on its own with esbuild (no bundling, so import paths and license headers stay as published). Only the addons the site imports, plus their own imports, are copied (12 files). Import map and modulepreload links point at ./vendor/. Script: loop-tools/vendor.cjs.
- After, live, phone on 4G, cold cache: three.core.js done at 584 ms (was 907); veil median 2143 ms (was 2374). three on the wire about 196 KB (was 418 KB). No third-party request left on the home except Google Fonts.
- Verified: gate PASS local and live; phone draw calls max 89; keyboard walk both motion modes; command bar 33/33; fallback test (now blocks /vendor/) PASS. Lesson: import map values must start with ./ or /; a bare "vendor/..." is ignored and the page never boots.

### Round 25 (2026-10-11): the 7 decks share the same files
- Change: deck import maps (and the pakistan-india gsap script) point at ../../vendor/; gsap's dist/gsap.min.js added as published. A visitor now downloads three once for the home and every deck.
- Verified: decks-verify.cjs, each deck stepped through 14 slides: 0 errors, 0 failed requests, 0 CDN requests (live before: 2 to 9 CDN requests per deck); cover renders identical to live; late-slide 3D scenes render in all 7.
- Next: the 4 world pages (fieldfold, workbench, jev, round-and-round) still embed three r170 as a string, about 300 KB each on the wire. Swap to the shared r186 one page at a time.

### Round 26 (2026-10-11): the 4 world pages share the site's three.js (Greybeard item 5, done)
- Before: fieldfold, workbench, jev and round-and-round each embedded three r170 (plus OrbitControls and RoomEnvironment) as a JSON string turned into a blob: URL. Each page was about 1.5 MB of HTML, about 300 KB on the wire, and nothing was shared between pages or with the home.
- Change: loop-tools/worldswap.cjs finds the three, OrbitControls and RoomEnvironment literals by content and replaces each whole blob(...) call with the vendored r186 file's URL; a one-line import map points the bare 'three' inside the addons at that same file, so each page keeps a single THREE instance. Added modulepreload for three.module.js and three.core.js. THREE.PCFSoftShadowMap -> THREE.PCFShadowMap (r186 removed the soft map and already fell back to PCFShadowMap; naming it directly keeps the same look and drops the warning). Page HTML: 1525/1497/1583/1531 KB -> 32/36/123/70 KB.
- Verified against live r170: console clean on all 4 at desktop and phone (the r170 PMREM "sigmaRadians" warning is gone too); screenshots before and after a canvas drag match live (mean pixel difference 0.25 to 0.64 of 255; round-and-round 2.0 because its marbles never stop); every main control clicked on all 4 with no errors (workbench by id: a run cycle moves the arm on both); gate PASS; sub-page sweep 34/34.
- Next: Greybeard item 6, shorter desktop veil (measure first).

### Round 27 (2026-10-11): the desktop veil (Greybeard item 6): cap unchanged, the first screen reads from 0.14 s
- Measured first (veil-probe.cjs, fresh browser per run = cold shader cache, RTX 3050, 1366x768): veil lifts at 4.9 to 5.5 s. Phases: module 0.22 s, scene build to 1.41 s (most of it is shader compile, profiled: three's first-use program check waits on the driver), compile 0.6 s, warm-up draws 2.9 s over 45 pieces (mirror 0.5, one group 0.4, overhead 0.3, video prewarm 0.25, two meshes 0.2 each, ~40 small ones 0.4 total). After the reveal: 0 to 2 frames over 50 ms in 6 s. The 9 s cap does not bind here; it only binds on slower GPUs, which the loop cannot test.
- Tried: renderer.debug.checkShaderErrors=false -> median 4.83 s vs 4.97 s, inside run noise (4.9 to 5.5): the compile cost only moves. Reverted.
- Decision (Opus counsel agreed): keep VEIL_MS. Lowering it would swap a visible wait for freezes on slow GPUs that cannot be measured.
- Change instead (CSS only): while the veil is up, the headline and "Growth marketer who builds working tools, not just reports." sit above it from the first paint; the drag hint waits for the machine; the text keeps its layer 0.9 s into the veil's 0.8 s fade so it never slips behind. On screens up to 760 px tall the loading line and bar move to the upper part (they overlapped the headline at 360x640, 375x667 and both landscape phones). Failed and no-WebGL states keep the old behaviour (headline hidden; the plain list stays on top).
- After (who-early.cjs, cold): the line is readable at 138 ms desktop (was 6957), 156 ms phone (was 3212), 130 ms at 360x740 (was 2884); never hidden from first paint through the fade. Overlap check at 6 sizes: none. Gate PASS, command bar 33/33, keyboard walk both motion modes, fallback PASS (headline hidden after its fade).
- Later, if ever: fewer distinct materials (shader programs) would cut the real cost. Value 3, effort 4, risk 3.

### Round 28 (2026-10-11): Launchboard share card
- Before: every Launchboard page (194) shared as a bare link: title and description only, no image.
- Change (source, outputs/launchboard commit d3f68a0): app/layout.tsx metadata gets metadataBase, openGraph and twitter (summary_large_image) with public/og.jpg, a 1200x630 top crop of the Today view (fictional Northbeam data, "Demo · synthetic data" badge in frame). The image path carries the basePath by hand because Next does not add it to metadata URLs. Child pages set only a title, so all 194 inherit the card.
- Checks: typecheck clean, 231/231 tests, NDA gate OK. Export compared with the deployed copy: JS chunks identical; all 194 pages have identical visible bodies once head and the RSC payload are set aside (the payload embeds the metadata, so it differs by design); only new file og.jpg; build id renamed. Gate PASS; Launchboard pages in the sweep ok.
- Loop tooling lesson: git add on a large export floods LF/CRLF warnings; filter them (`2>&1 | grep -v "LF will"`) so real errors stay visible.

### Round 29 (2026-10-11): the loop checks itself (tooling only, no site change)
- Why: every round re-ran the same five checks by hand, and two shipped features (share cards, plain lists) had no guard against regressing.
- Added to pf/loop-tools: share-check.cjs (every public page keeps title, description, og + twitter card, absolute image that serves an image; plain HTTP), link-check.cjs (every same-site href/src/poster on 17 pages returns 200; external origins listed, not fetched), and check-all.cjs, which runs plain-links --check, share, links, the home gate, the sub-page sweep, the CDN fallback and every deck slide in sequence (one browser at a time) and exits 1 on any failure. Pre-push from now on: `node check-all.cjs && git push`.
- Each checker was mutation-tested, because a checker that only passes proves nothing: share-check caught a removed og:image and a 404 image; link-check caught a renamed link; check-all with Email removed from noscript failed exactly plain-links and fallback, exit 1. A false positive found on the way (data-src="1" read as src) was fixed in the matcher.
- Live baseline: share 18 pages / 15 images PASS; links 72 same-site URLs PASS; check-all PASS locally in about 5 minutes.

### Round 30 (2026-10-11): keyboard focus no longer gets lost (accessibility, first pass)
- Measured: axe-core 4.11.4 (already on disk, no new dependency) on 18 pages x 2 sizes: 26 of 36 loads clean; failing rules: color-contrast (59 elements, 5 pages), aria-prohibited-attr (home #pins), aria-hidden-focus (pakistan-india #panel). axe flagged the panel only on phone, so a new focus-check.cjs presses Tab 60 times per page and counts stops a sighted keyboard user cannot see.
- Real bugs it found (live): pakistan-india desktop: 52 of 59 Tab stops landed inside the closed, off-screen Sources panel; perpetua: the hidden part panel's close button took a stop each cycle; cyberpunk: the late hall pill was tabbable while invisible.
- Fix: closed Sources panel and hidden part panel are inert (toggled with their open state); the shared hallpill.js takes the late pill out of the Tab order and the accessibility tree until it shows; home #pins gets role="group" so its label is valid. No visual change.
- After: focus-check 0 lost stops on all 17 pages; axe: only color-contrast left; Perpetua inspect opens, its close button is reachable when open and the panel goes inert on close; the cyberpunk pill is tabbable once scrolled into view. Checker fix on the way: a skip link that slides in on focus is judged after its 300 ms transition (it was a false positive).
- check-all now runs 8 checks, including focus. Next: color contrast (59 elements), with design review per page.

### Round 31 (2026-10-11): text contrast, near-misses
- Measured (contrast.cjs: axe color-contrast with colors, ratio and size per element): four tokens sat just under WCAG AA 4.5:1 for normal text: fieldfold --accent 4.45, round-and-round --muted 4.24, houthis-saudi-pipeline --red 4.32, workbench --muted 3.87.
- Change: each token darkened along its own hue just enough to reach 4.6:1 (small margin): #ad4a29 -> #a94828 (lightness 42.0 -> 41.0%), #746c62 -> #6e665d (42.0 -> 39.8%), #c8321c -> #c0301b (44.7 -> 42.9%), #756d61 -> #686156 (42.0 -> 37.4%). One line per page; no new colors.
- After: those four pages have no contrast failures at desktop or phone. check-all PASS (8 checks).
- Left on purpose for separate rounds: workbench --orange on beige (3.2 to 3.7; reaching 4.5 needs lightness 47.8 -> 38.2%, a visible change to the page's signature colour, so it needs a text-only variant and screenshots), and russia-free-hand's phone table (rows at 1.6 to 3.3 look like a "not yet revealed" dimmed state; check intent before touching).

### Round 32 (2026-10-11): text contrast, the last two real cases
- russia-free-hand --red #e2493d -> #e45348 (lightened along its hue, 56.3 -> 58.7%): the phone timeline dates go 4.34 -> 4.65 on the dark desk; the dark-on-red primary button gains contrast too.
- workbench: --orange stays #c75b2d for fills, borders, the logo mark and the focus ring; a darker shade of the same orange, --orange-ink #9f4924, carries small text (eyebrow, mechanic label, instruction tag, selected job) and pressed buttons. Before: 3.21 / 3.69 on the beiges, white on pressed orange 4.23. After: 4.62 / 5.30, white 6.08. Screenshots against live: same page, labels a touch deeper.
- After: axe color-contrast left only on russia-free-hand's readout rows (12 elements), which are dimmed on purpose until the reader steps to them (.readout tr opacity .38 until .on, lit by the slide's stepper on phone and desktop). Kept as designed: lighting them would change how the deck reveals its numbers.
- Accessibility pass totals (rounds 30 to 32): axe failures 63 elements / 3 rules -> 12 intentional; lost keyboard stops 0 on all 17 pages (pakistan-india was 52 of 59). check-all PASS.

### Round 33 (2026-10-11): Round & Round inspect on phones shows the part it explains
- Before (live, rr-inspect.cjs): opening "Look a little closer" put the card over the machine: 77% of the canvas covered at 390x844, 89% at 360x740, so each part was hidden behind its own explanation (open since round 14).
- Decision: Opus counsel picked a bottom sheet with the intro stepping aside; done in CSS only (the app's camera code lives in escaped module strings, and the stage height is a fixed clamp, so moving it costs no WebGL resize).
- Change (phone-fixes block, max-width 700px, only while #inspector is open): the card docks to the bottom over the motion bar (max 45svh, scrolls inside); the intro text is removed from the flow so the stage rises under the header; the pressed "Look a little closer" stays as the way back; the motion bar, hall pill and "Find one marble" hide (and leave the Tab order) until the card closes.
- After: canvas covered 8% at 390x844, 12% at 360x740; the four numbered parts sit in full view above the card. Flow test: tabs switch parts, See this part and Check the motion work (its result shows inside the card), closing restores the intro, motion bar and pill; no errors. Desktop pixel-identical in the static area. check-all PASS.

### Round 34 (2026-10-11): phones skip the full-size Singular stills
- Discovery pass (new weight.cjs: phone on 4G, cold, every page): LCP is under 1 s on all 16 pages (worst cyberpunk 956 ms); the waste is bytes. Home on a phone pulls 2.65 MB of media; deck covers ship at 1672 px where a phone needs ~780 px (150 to 375 KB each); cyberpunk's gallery ships 1600 px for ~700 px (that page belongs to the Corner Block chat, left alone).
- Home: 3 of 26 files skipped the 1024 px phone copies under m/: the Singular wall's three stills (415 KB). hall.js loaded them itself and shrank them on the device.
- Change: the phone-copy rule now lives once, as phoneCopy(url) exported from portal.js, used by the portals and by the Singular wall (which falls back to the full picture if a copy is missing, like the portals).
- After (home-imgs.cjs): full-size files on a phone 3 -> 0; Singular stills 415 -> 283 KB; home phone media 2650 -> 2512 KB. Singular stop screenshot identical to live; phone draw calls max 89; check-all PASS.
- Unreferenced stills noted, not deleted (visitors never fetch them; the diorama ones belong to the Corner Block chat): media/diorama-*.jpg, n8n.jpg, squeeze.jpg, posting.jpg.
- Loop rule from this round: any script with a regex is written with the Write tool; sed and inline node -e halve backslashes on this box (third time this session).

### Round 35 (2026-10-11): deck covers are not oversized (measured; no site change; one tool corrected)
- Hypothesis from round 34's discovery pass: deck covers ship at 1672 px where a phone "needs ~780 px", 150 to 375 KB of waste per deck.
- Checked before changing (cover-scale.cjs): the covers use object-fit: cover, so on a tall phone they are scaled by height and cropped. Source pixels per screen pixel on a 3x iPhone: 0.37 to 1.6 (houthis 0.37, agents 0.81, posting 0.77, over-engineering 0.88: already below 1). A smaller phone copy would have made the covers blurrier.
- Decision: no srcset, no smaller copies. The cyberpunk gallery measures 1.6 to 1.7 at 2x, also fine.
- Tool fix: weight.cjs compared image width with box width and ignored object-fit; it now reports source px per screen px (object-fit aware) and flags only above 2. Re-run: the one flag left is pakistan-india at 2.39 on a 2x phone (1.59 on a 3x iPhone), not worth a second file.
- Lesson for the loop: a "waste" number is a hypothesis; check it against how the pixels are actually drawn before cutting.

### Round 36 (2026-10-11): robots.txt and a sitemap
- Before: /robots.txt and /sitemap.xml returned 404; search engines could find sub-pages only by following links.
- Change: robots.txt allows everything and names the sitemap (noindex pages are not blocked on purpose: a crawler that cannot fetch a page never sees its noindex). tools/sitemap.mjs writes sitemap.xml with the 18 public pages (home, 10 worlds and tools incl. corner-block and its story, 7 decks) and refuses any page marked noindex (tested: adding noindex to jev made it exit 1). No lastmod on purpose: a git date would go stale with every page commit and keep the check red.
- Loop: check-all gains "sitemap current, no noindex" (9 checks); link-check now also requires robots.txt and every sitemap URL to return 200 (73 same-site URLs). check-all PASS.
- Note: gate and sweep ran at about twice their usual time (175 s vs 90 s) with three other chats busy; timings in this round are not comparable.

### Round 37 (2026-10-11): the mirror's shaders compile in parallel behind the veil (cold desktop veil -28%)
- Before (veil-probe, 3 cold runs, 1366x768): median veil 4686 ms; phases: scene build 1.35 s, boot compile 0.6 s, warm draws 2.4 s. 50 GL programs.
- Found (programs.cjs, prog-keys.cjs): 19 of the 50 programs are exact copies of others that differ only in output colour space and tone mapping. three.js builds those for anything drawn into a render target, here the floor mirror. Boot's compileAsync only built the screen variants, so every hall piece linked its mirror variants synchronously on its warm draw, one at a time.
- Change: hall.compileAll() runs the boot compileAsync for the screen and, with the mirror's render target bound, for the mirror too. Everything compiles in parallel (KHR_parallel_shader_compile). Phones have no mirror, so their path is unchanged.
- First attempt hid the floor and Perpetua during the mirror compile; it built 6 programs nothing ever uses (56 vs 50). Reason: r186 compile() walks every mesh in the root it is given, hidden or not, and visibility is ignored. Fix: compile the mirror pass only on the roots the mirror draws (each hall piece except the floor, plus Perpetua's stand-in).
- After: exactly the same 50 programs as live (prog-diff: zero added, zero missing), so the rendered pixels come from identical shaders. Median veil 3374 ms (3019, 3374, 3474), worst frame after the veil 33 ms, 0 long frames. A 27-stop walk (journey-progs.cjs) compiles no program after the veil, live and local alike. check-all PASS.
- New tools: programs.cjs (census), prog-map.cjs (program to materials), prog-keys.cjs (cache-key dump and nearest-sibling diff), prog-diff.cjs (two dumps), journey-progs.cjs (programs and long frames per stop), who-uses.cjs.
- Lesson for the loop: before cutting programs, diff their cache keys. The "too many programs" problem was really "programs compiled serially"; the count did not need to move.

### Round 38 (2026-10-11): shader error checks stay on (measured; no site change)
- Live after round 37: median veil 3552 ms over 3 cold runs (3097, 3552, 3948), 50 programs, none compiled during a 27-stop walk, 0 long frames.
- Profile (boot-profile.cjs): of 2.9 s sampled to the veil, 0.8 s is self time in three.js's program error check. That check makes synchronous GL queries, and each one waits for its program's link.
- Tried: renderer.debug.checkShaderErrors = false (with ?glcheck to turn it back on). Median veil 3250 ms over 5 runs, inside the 3019 to 3474 ms spread of round 37. The worst frame after the veil rose from 33 to 50 ms in all 5 runs, and 2 runs gained a long frame. The link wait moved past the veil; it did not go away. Reverted.
- Lesson for the loop: main-thread time in a synchronous GL query is GPU work showing up on the CPU. Removing the query moves the wait. Only less GPU work (fewer or cheaper programs) removes it.
- Next lever, if wanted: merge screen-variant programs that differ by one material flag (prog-keys.cjs lists them). Each merge saves two programs (screen and mirror) but changes how a material renders, so each one needs a before and after screenshot at its stop.

### Round 39 (2026-10-12): the environment map's room shaders link during the scene build (about 60 ms)
- Found (boot-inclusive.cjs, inclusive CPU time to the veil): PMREMGenerator.fromScene(RoomEnvironment) takes 0.5 to 0.9 s, more than buildPerpetua (0.2 to 0.3 s) and buildHall (0.2 s). In a bare page (pmrem-time.cjs): cold 650 to 843 ms, warm 3 ms. So it is all first-use shader cost (5 programs), not rendering.
- Change: the room's materials compile right after the renderer is made, with a render target bound (so the keys match PMREM's), and fromScene runs after buildPerpetua and buildHall, so the links overlap that CPU work. Same 50 programs (prog-diff: zero added, zero missing).
- Measured with interleaved A/B (the edit toggled between single cold runs, so both sides share the machine's load; 4 other chats were busy): 12 pairs, 10 faster. The last 7 pairs were all faster, median -63 ms. Plain medians of separate batches had suggested -440 ms; that was load drift, not the change.
- Tried and reverted: linking PMREM's own two shaders (GGX filter, background box) early through its private r186 fields. fromScene went from 557 to 506 ms, inside noise, not worth coupling to three's internals. Most of the remaining cost is ANGLE building each shader's D3D code at its first draw, which no GL compile call reaches.
- check-all PASS. New tools: boot-inclusive.cjs, pmrem-time.cjs (uses a temporary tmp-pmrem.html at the server root; never commit it).
- Lesson for the loop: on a shared, busy machine, compare by interleaved pairs, never by medians of separate batches. And precompiling only helps the GL link, not ANGLE's first-draw work; the real lever left is fewer programs.

### Round 40 (2026-10-13): the opening headline reads on the cream wall
- Why this round: Jash expected the loop to keep improving how the site looks. Rounds 37 to 39 were speed work with "no visual change" as a rule, so nothing on screen moved. The loop now targets visible quality, with the speed numbers as a guardrail.
- Found (tour.cjs: every stop at 1440x900 and 390x844 from live; copy-contrast.cjs: text against the real pixels behind it, shadows ignored): the opening frame is the only light scene, and its copy failed everywhere. Headline 2.31:1 on desktop and 1.37:1 on phones (bar 3:1); the two lines under it 1.88 to 2.38:1 (bar 4.5:1). Every dark stop passed.
- Tried on live by injected CSS before editing: A, the same full-width gradient made deeper and taller; B, a dark patch anchored bottom-left. A passed at both sizes. B failed on phones, where the copy spans the width.
- Change: body[data-mode=inside] #shade-bottom now runs rgba(20,30,26) .8 at the bottom, .55 at 30%, 0 at 58% (was .5 to 0 at 42%). It is the machine's own green-black, so it reads as the floor falling into shadow, not a box.
- After: desktop headline 5.6:1, lines 6.33 and 5.94:1; phone headline 3.42:1, lines 5.17 and 5.33:1. No other stop changed. check-all PASS.
- Left on purpose: the Fieldfold caption measures 4.12:1 with its shadow ignored. Its 75% shadow makes it read cleanly in the screenshot, so recoloring every caption would change correct work.
- New tools: tour.cjs (a screenshot per stop), copy-contrast.cjs (EXTRA_CSS tries a change on live, SHOT_DIR keeps the frames; rows of buttons are skipped).
- Lesson for the loop: a "no visual change" checklist item keeps a loop from improving the look. Measure what the visitor sees (text against real pixels), and try candidates on live by injection before editing.

### Round 41 (2026-10-13): Dead End Shop's projector beam ends on the picture
- Found (tour.cjs frames, then beam on and off on the same page): a pale dome lay over the Dead End Shop artwork and showed as a ghost disc in the overview. It was the projector beam: a round cone with an 8.1-unit radius aimed at a 15.2 by 8.55 screen, so it overshot the picture by about 4 units above and below. The overshoot over the dark wall read as a solid dome.
- Tried first, on live by runtime patch: fading the cone's edges by viewing angle (two strengths). The outline stayed; the shape, not the edges, was the fault.
- Change: the beam is an open pyramid from the lens to just inside the picture's four corners (97%), with the same texture, colour, additive blend and opacity. Same 50 programs (prog-diff zero), nothing compiled after the veil, check-all PASS.
- Tested and rejected: raising the opacity so the beam shows as a shaft (0.18, 0.3). From the front the beam overlaps the picture, so a stronger beam only lays haze over the art. Kept at 0.085; the projector and its spinning reels still say "film".
- Measurement lesson: the portal is a slideshow, so comparing art brightness between two shots compared two different pictures. Judge such changes on regions the art does not cover, or pause and shoot within 250 ms.
- New tools: beam-try.cjs and beam-opacity.cjs (runtime material and geometry trials on a live page); tour.cjs gains STOPS=.

### Round 42 (2026-10-13): the hall headline no longer fights the lit skyline
- Queue check: the round 41 beam on phones (390x844, live) is clean, with no dome.
- Found: at the hall stop, "One machine. Many worlds inside it." sits on the foreground skyline's lit windows (desktop and phone). Contrast passed (7.0 to 7.6:1), so the fault was clutter. copy-contrast.cjs now also reports "busy", the brightness spread (0 to 255) of the background under the text: 25.9 on desktop and 23.1 on phone under the headline.
- Tried on live by injected CSS: A, the hall's bottom shade deeper and taller (.88 at the bottom, .62 at 26%, 0 at 52%); B, the old shade plus a soft bottom-left darkening. A: busy 13.6 on desktop and 11.6 on phone, contrast 11.2 and 12.3:1. B: 14.7 and 18.7; it left phones busy because the copy spans the width there.
- Change: body[data-mode=hall] #shade-bottom uses A, in the hall's own near-black rgba(15,14,11). The vitrines, labels and lights above stay as they were.
- Verify: contrast sweep with shadows passes at every stop at both sizes (hall headline busy 13.5 desktop, 11.1 phone); 27-stop walk: 50 programs, 0 long frames; check-all PASS.
- Next queue: (1) the overview stop (s25): the back of the Singular wall reads as a black slab on the left; (2) a fresh tour of every stop at both sizes for the next weakest frame.

### Round 43 (2026-10-13): Singular hangs on a marble gallery wall
- Found: from the overview, the back of the Singular wall read as a black slab. From the front, its 24 dark posters sank into the near-black panel (#1a1915, matte).
- Static batching had baked the panel into world space, so trials matched it by colour and vertex count. trial.cjs (new) runs a JS snippet on a live page and shoots chosen stops.
- Tried on live: A, the decks' enamel (#1b2924): almost the same as before. B, the pillars' marble (#d6d0c0): the posters read as framed art and the back reads as a pale partition. An Opus counsel picked B: it shows the work, repeats the hall's own cream (pillars, columns), and A "does nothing". Its risks: raw edges, posters overhanging the right edge, a glow hot enough to wash out the centre.
- Change: the panel uses M.marble; a 0.4 brass edge (M.brass, 0.9 deep) frames it; columns are spaced 4.7 apart instead of 5.0, so the outer frames stay inside the edge (they overhung by up to 0.37); the wall glow is 0.15 instead of 0.22. Everything is an existing hall material.
- Verify: same 50 programs (prog-diff zero); 27-stop walk 0 long frames; phone draw calls at Singular settle at 46 (max 49), under the 100 budget; check-all PASS.
- Next queue: (1) a fresh tour of every stop at both sizes for the next weakest frame.

### Round 44 (2026-10-13): on phones the central pole no longer splits the transit frames
- Fresh tour (every stop, 1440x900 and 390x844, contact sheets): desktop clean. On phones, at all seven in-between (link) stops, the hall's central brass pole ran straight down the middle of the frame, between the camera and the two vitrines.
- Cause: a portrait phone may pull the camera back up to 2.3x (pscale) to fit both vitrines; for link stops that carries it past the rotunda's centre, so the pole sits on the line of sight. The decks stop already caps pscale at 1 for the same reason.
- Tried on live (runtime edits to the journey frames): A, cap link pscale at 1.0, and B, at 1.4. Both removed the pole but cropped both vitrines at the frame edges around an empty middle. Hiding the pole alone is not possible cheaply: it is part of the overhead mechanism's single merged mesh. D, shift the camera 6 units sideways: the pole landed on the right vitrine. E, 12 units: the pole moved to the frame edge and both vitrines sat clear.
- Change: layout.js "between" placements take an optional side offset (toward the second vitrine); every link stop gets a portrait override standing 16 to the side (12 left the pole clipping two vitrines once the portrait weight of 0.92 applied). Desktop and landscape do not use the override (desktop link frames differ from before only by animation, 1.7 to 3.2 levels mean).
- After (local, 390x844): the pole is out of all five checked link frames, both vitrines are whole, and the overhead gear ring still crowns the shot.
- Verify: same 50 programs (prog-diff zero); 27-stop walk 0 long frames; phone draw calls peak 88 (the long-standing 89 ceiling); check-all PASS.
- Next queue: (1) phone floor: pale grey rectangles under vitrines (the phone stand-in reflections) read as patches on the floor; (2) a fresh tour after that.

### Round 45 (2026-10-13): phone floor reflections read as reflections, not tiles
- Found (round 44 queue): on phones the floor showed pale, hard-edged grey rectangles. They are the phone tier's stand-in mirror (ground.js buildVitrineMirror): each screen is copied below a see-through floor as a flat rectangle in one tint, faded only gently by depth (exp(-depth/26)), so it reads as a tile lying on the floor.
- Candidates, shot locally (the stand-in is one merged mesh with baked vertex colours, so it cannot be retinted on a live page): A, the screen copies at 40% strength: the rectangles stay readable, only dimmer. B, each screen copy fades from its edge nearest the floor (screens over 3 units, the Singular wall over 5): the rectangles become a faint glow along the floor line, and the pillars' reflections are untouched.
- Change: B. part() takes an optional fadeLen.
- Verify: same 50 programs (prog-diff zero); 27-stop walk 0 long frames; phone draw calls peak 88; check-all PASS.
- Next queue: (1) a fresh tour of every stop at both sizes.

### Round 46 (2026-10-13): the name mark wears the same pill as Contact and Worlds
- Fresh tour (every stop, both sizes; an Opus counsel ranked the weakest frames). Top pick: on phone link frames the "Jash Shah" mark sat bare on the bright overhead gears, while Contact and Worlds beside it had dark pills; on desktop s05 it sat on lit towers. The header read as two styles.
- Cause: the mark's pill was scaled by --paper, so it only appeared while the light cyclorama of the first beat was behind it.
- Measure: copy-contrast now takes SEL (any element; its text and icon strokes are hidden for the background shot). Live, mark vs background: phone s10 4.01:1 and s16 4.25:1 (both under the 4.5 bar), s14 6.34, desktop s05 8.17.
- Tried on live (injected CSS): A, the ghost-dark pill exactly (.55 fill, .35 rim): s10 4.44, s14 8.59, s16 7.05, desktop s05 8.64, busy behind the mark on s05 42.2 to 24. B, a lighter .4 fill: similar numbers, but the mark then looks unlike its two neighbours. s10 sits right at the bar in both (animation noise of about 0.4 between runs).
- Change: A. The pill floor is .55; --paper still deepens it to .6 over paper.
- Verify: same 50 programs (prog-diff zero); 27-stop walk 0 long frames; check-all PASS. Live after deploy (81069e3): phone s14 7.48, s16 7.01, desktop s05 7.62 (busy 42 to 24). s10 4.38: the brightest gear tooth sits right under the pill, the same tooth behind Contact and Worlds. A stronger fill on the name alone would break the match, so it stays.
- Next queue: (1) desktop s08 decks: empty top 40%, small vitrines, the seventh cut off at the edge; (2) phone s24: the Singular wall reads small.

### Round 47 (2026-10-13): the decks stop looks along the row of cases
- Found (round 46 queue): at the decks stop the camera stood square on from across the rotunda (112 out). The seven small cases sat in a thin band, the top 40% of the frame was empty on desktop (45% on phones), and the seventh case sat under the copy.
- Tried on live (runtime camera moves): A and B, the same camera raised 8 or 16 and tilted down: the row climbed a little but the empty band only moved to the floor. D, square on and closer (78): bigger cases, still the empty top, and both end cases cropped. C, stand off the row's left end (42 out, 37 to the side, 8 up) and look along it: the near cases are large, the row and its gear linkage recede across the frame, and the hall's light shafts fill the top. Phone only, C raised 12 or 22 (E, F): the row rose but the screens turned away from the camera and the light shafts ended in mid-air. Kept plain C on both.
- Change: C. layout.js "slot" camera positions take an optional side offset; the decks stop uses it.
- Found in verify: one shader first compiled at the decks stop (51 programs after the walk). The new camera is the first whose floor mirror sees Perpetua's two lamp discs (named with a new which-prog.cjs and prog-keys STOP=n). The mirror now skips them, as it already skips Perpetua for its stand-in: back to the same 50 programs.
- Verify: same 50 programs at the veil and after the whole walk (prog-diff zero); check-all PASS; phone draw calls peak 88 (decks stop 64 to 60). Long frames: the machine was loaded (CPU 68%, other chats busy), so the walk ran interleaved with the live site under the same load: new code 9 and 3, live 33 and 27, all at the first stops this change does not touch.
- Flight check: new travel.cjs shot the flights in and out at 25/50/75%; the camera passes close to the end cases without cutting through.
- Next queue: (1) phone s24: the Singular wall reads small; (2) then a fresh tour.

### Round 48 (2026-10-13): on phones the Singular wall fills the frame width
- Found (round 47 queue): on a phone the Singular wall was a small panel mid-frame, about half the frame width, with the top third empty. A portrait phone pulls the camera back (up to 2.3x) to keep a set width in frame, and the wall (29 wide) is already the widest piece in the hall.
- Tried on live (runtime pull-back caps): A, 1.4x: the wall spans the frame with a small margin, all 24 posters whole and larger. B, 1.2x: larger again, but the left column of posters is cut off at the edge.
- Change: A. The Singular stop caps the phone pull-back at 1.4 (as the decks and vitrine stops already cap theirs). Desktop and landscape are unchanged.
- Verify: same 50 programs (prog-diff zero, 50 after the whole walk); check-all PASS; phone draw calls peak 88 (Singular 46 to 44). Long frames, with the machine loaded by other chats: new code 26, live site 24 in the same run, all at stops 0 to 5; this change only moves the phone camera at stop 24.
- Next queue: (1) a fresh tour of every stop at both sizes.

### Round 49 (2026-10-13): the decks wing's link bars no longer cross through the gears
- Found (Jash, from the round 47 frame): the bars joining the seven small cases crossed in an X through every gear.
- Cause: each bar ran from a case's "right" edge to the next case's "left" edge, but a case's right vector points back toward the previous case on this row. So every bar started on the far side of its own case and ended on the far side of the next one, and neighbouring bars crossed at each gear. The two end axles (the shafts to the next stations) had the same flip.
- Change: hall.js picks each bar end as the case edge that faces the neighbouring case; the end axles take the outer edges. Each pair of cases now has a short coupling bar across the gap; the gears stand clear.
- Verify: same 50 programs (also after the whole walk); 27-stop walk 3 long frames; check-all PASS.
- Also this round, not shipped: the start stutter Jash reported. Measured: a quiet machine shows 7 to 13 frames over 40 ms in the first 6 s after the veil; with another chat's headless browser on the GPU it reaches 60 to 100. Blocking the videos or the pictures each roughly halves it. Tried decoding pictures before upload and uploading one per frame: worse (13 to 17 against 7 to 13, both served locally), reverted. On a settled page, uploading 8 pictures (as <img> or as ImageBitmap) gives no slow frames at all, so uploads alone are not it. Next: a Chrome trace with GPU events over the first 6 s.
- Storyboard (Claude Design canvas, private): the journey now, and the Cyberpunk City case holding a small model of the real block instead of a flat picture (desktop and phone).
- Next queue: (1) the start stutter, traced; (2) the city model in the Cyberpunk case, from the Corner Block phone set, loaded only near that stop.

### Round 50 (2026-10-13): the stutter at the start, traced and fixed
- Found (Jash: "lagging at the start, then smooth"): a Chrome trace of the first 6 s after the veil (new trace-start.cjs) shows each picture's load handler blocking the main thread for 43 to 55 ms, because Chrome decodes the JPEG inside the upload: 23 decodes, about 536 ms of decoding inside 814 ms of load handlers, all in the first second. Round 49's frame counts were taken while another chat's headless browser held the GPU at 43%, which hid this.
- Rejected: round 49's img.decode() plus one upload per frame (worse in that noisy run, reverted); ImageBitmap vs <img> uploads on a settled page (no slow frames either way, so the cost is the decode, not the upload).
- Change: portal.js loadPicture() decodes with createImageBitmap (three's ImageBitmapLoader, flipped at decode) on Chromium and Firefox; Safari keeps the <img> path (older versions ignore imageOrientation and would hang pictures upside down). The Singular wall's posters use it too; hall.js's unused TextureLoader is gone.
- Numbers, quiet machine, old vs new both served locally, 4 interleaved runs: main-thread tasks over 50 ms in the first 6 s 2 to 10 (sum 120 to 592 ms) down to 0 to 1; frames over 40 ms 6 to 8 down to 2 to 5; jank 349 to 466 ms down to 183 to 298 ms. Pictures checked upright (Cyberpunk screen, Singular wall).
- Verify: same 50 programs; 27-stop walk 1 long frame; phone draw calls peak 84; check-all PASS.
- Next queue: (1) the one 130 to 156 ms GPU frame as the veil lifts (SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass at +20 ms, in old and new alike); (2) the city model in the Cyberpunk case.

### Round 51 (2026-10-13): a smaller hitch as the veil lifts
- Found (round 50 queue): one 100 to 150 ms frame as the veil lifts, in a GPU-process paint (SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass).
- Tried on live (start-jank.cjs, worst frame in the first 1.2 to 3 s, interleaved): no veil fade, no shades, no text shadows: no change. Holding the veil until two frames in a row ran under 30 ms (an injected script): no change, so the cost is the veil lifting, not the scene's first frames. A veil at 99.5% opacity until it lifts: worst frame 98 to 129 ms down to 67 to 94 (mean 111 to 77). Fully opaque, the veil hides the 3D canvas, the compositor skips drawing it, and its first composite lands on the frame the veil lifts.
- Change: #veil:not(.done){opacity:.995}. Nothing shows through: 0.5% of the canvas under the night colour.
- Verify: same 50 programs; 27-stop walk 2 long frames; check-all PASS.
- Next queue: (1) the Cyberpunk case holds the real block instead of a flat picture: a view-dependent impostor built from the 36 turntable renders already on the site (cyberpunk/spin), the frame chosen by the camera's angle to the case and the dark ground keyed out; about 1 to 2.5 MB, loaded only near that stop. Rejected for now: the Corner Block models themselves (105 files, about 60 MB even in the light set; 8 to 10 MB for a few key pieces).

### Round 52 (2026-10-13): the Cyberpunk City case holds the block itself
- Asked for (Jash): "show an actual city, a small diorama". Storyboarded first (the Claude Design canvas, round 49).
- Source: the 36 turntable renders of the real model already on the site (cyberpunk/spin, 10 degrees apart). Rejected: the Corner Block models themselves (105 files, about 60 MB even in the light set).
- Built (atlas-build.cjs): each render cropped to the block, its dark ground keyed out by a flood fill from the frame edge through dark or dark-blue pixels (a luminance-only key left the lighter navy at the frame centre), packed 6 x 6 into one webp with alpha: 2592 x 2520, 1.37 MB; a phone copy at 2/3 size, 1728 x 1680, 688 KB (exempt from the 1024 px phone cap: at 1024 each render would be 170 px wide).
- Change: hall.js cityModel() replaces that case's screen, frame, halo and floor reflection with one plane that turns to face the camera and shows the render taken from that side, blending between neighbours, so moving past the case moves round the block. Direction measured, not guessed: from one render to the next the plinth's front slides 17 to 24 px left, so later renders are the camera further right. Loaded after the opening (with the other pictures), one draw call; the six flat Cyberpunk pictures no longer load.
- Tried on live first (an injected impostor): sized 10.5 then 12 wide; the merged glow and backing slab of the old screen could not be hidden at runtime, so the final look was judged locally.
- Verify: 52 programs at the veil and after the whole walk (2 new: the city's shader and its mirror variant; one existing pair changed one flag); new baseline saved (old kept as prog-keys-base-50.json); 27-stop walk 0 long frames; phone draw calls peak 85 (the Cyberpunk stop 38 to 35); check-all PASS.
- Next queue: (1) phones frame every world case from far back (the default pull-back), so the city and the screens read small: try capping it for world stops; (2) the same idea for the other worlds that are objects (Round & Round, Robot Workbench, Fieldfold, Dead End Shop), once there are renders to build from.

### Round 53 (2026-10-13): on phones every world case is framed close enough to read
- Found (round 52 queue): a portrait phone pulled every world camera back up to 2.3x (the default pscale), so each case sat as a small box mid-frame: the new city model and every screen read small.
- Tried on live (runtime cap on every world frame without its own cap): A, 1.4x: the case spans the frame width with a small margin, the city and the screens about 1.4x larger, the Launchboard screen readable. B, 1.15x: larger again, but the case's edges are cut off.
- Change: A. slot() defaults pscale to 1.4 (the decks stop keeps 1.0, Singular already had 1.4). Desktop and landscape unchanged.
- Verify: same 52 programs; 27-stop walk 0 long frames; check-all PASS. Spot checks: Cyberpunk, Launchboard, Round & Round, Robot Workbench, Dead End Shop on a phone.
- Next queue: (1) on phones the case now sits low with the top third of the frame empty: aim the portrait camera a little lower at world stops so the case rises above the card; (2) objects for the other worlds once there are renders to build from.

### Round 55 (2026-10-13): the Cyberpunk City case holds a real 3D block on its floor
- Asked for (Jash): "why can't the city be placed on the plane of the box?" The round 52 picture turned to face the camera and floated; this is the block itself, standing on the case floor.
- Built in Blender 5.2, headless, never on the site (tools in loop/city3d): cb-export.cjs pulls the core block (900 meshes, 1.69M triangles) out of the live Corner Block page as one GLB, standard attributes only (a custom one-element attribute broke Blender's importer); bl-slim.py drops see-through decals and the people, decimates to 138k triangles, deletes the undersides, unwraps one atlas (facades get more texels than the plinth and the street) and bakes albedo, light and neon separately on the GPU (about 4 min); combine.py grades them offline into one lit texture. city-pack.cjs packs the mesh: 16-bit positions padded to four (three 16-bit values cost Direct3D a conversion on every draw: 500 ms frames), 16-bit UVs, no normals (it draws unlit): 3.2 MB.
- Change: hall.js cityModel() draws the block with one unlit material. It starts as an empty triangle, so its program compiles behind the veil, and swaps in when the mesh and texture both arrive. The turntable atlas (cyber-spin, 2 MB) is deleted.
- Tried: texture 4096 vs 2048: same look on desktop, but 4096 cost 150 to 1270 ms frames on upload: 2048 for every screen (425 KB). Grade: dark (the city's own albedo is mostly near black), bright (washed out), and a purple ambient with stronger neon (kept: nearest to the Corner Block palette).
- Verify: 52 programs (the impostor's pair swapped for an unlit pair); phone draw calls peak 85, Cyberpunk stop 34; check-all PASS. The 27-stop walk shows 1 long frame at stop 1 in every run, with the mesh fetch switched off too; the live site shows 2 there today, so it is not this change.
- Next queue: (1) the block reads small and side-on from the world camera: frame the Cyberpunk stop a little higher so it looks down onto the streets, as the old picture did; (2) phone camera aim at world stops (parked round 54 trials, loop/r54); (3) the dragon, as a separate small mesh circling the block.

### Round 56 (2026-10-13): the Cyberpunk stop looks down onto the block's streets
- Found (round 55 queue): from the eye-level world camera the new 3D block read as a small wall of facades, and on phones it sat on the card's top edge.
- Tried on live (frame-try.cjs moves a stop's camera at runtime): A, 8 up and 6 closer, aim 1.5 lower: the whole case in frame, the block a little larger. B, 14 up and 10 closer, aim 2.5 lower: the streets and the plaza read from above, and on phones the block clears the card. Kept B, then eased it back (d 28 to 32) so the case's top bar stays inside the desktop frame.
- Change: slot('cyber', {d:32, up:19, lookUp:-2.7}). Other worlds unchanged.
- Verify: same 52 programs as round 55 (that dump is now the baseline; round 52's is kept as prog-keys-base-r52.json); 27-stop walk 1 long frame at stop 1 (in the live site too, see round 55); check-all PASS.
- Next queue: (1) the dragon, as a small separate mesh circling the block; (2) phone camera aim at the other world stops (parked round 54 trials, loop/r54).

### Round 57 (2026-10-13): the dragon circles the Cyberpunk block
- Found (round 56 queue): the card promises "watch the dragon circle", and the case had no dragon since the picture gave way to the 3D block.
- Source: the Corner Block page's own dragon (dragon160-hologram, 91k triangles, modelled straight; its shader bends the body along a flight path and glows red to gold at the rim). dragon-export.cjs saved its geometry and shaders; bl-dragon.py decimated it in Blender to 9k triangles and packed position, normal and its region flags (belly, gold, mane, ridge): 160 KB.
- Change: hall.js ports the shader: the path texture becomes an oval above the roofs (48 x 30 in the block's units, so it stays inside the case), body length and girth become uniforms, and the eye, tooth and gum branches are left out (two pixels at this size). Driven by the hall clock; a bounding sphere around the oval, so it is culled only when the oval is off screen. Like the city, it starts as an empty triangle so the program compiles behind the veil. Also removed a stale round 52 comment about the turntable picture.
- Tried on live (dragon-try.cjs): A, its own size (length 32, girth 1.55) high above the roofs: a pale spark on phones. B, length 46, girth 2.3, a little lower and faster: reads as a dragon at both sizes. Kept B.
- Verify: 54 programs at the veil and after the whole walk (2 new: the dragon's shader and its mirror variant; new baseline saved); 27-stop walk 0 long frames; phone draw calls peak 85, Cyberpunk stop 35; check-all PASS twice, one earlier run failed one check I did not capture (next round: run k-flaky.cjs if it recurs).
- Next queue: (1) phone camera aim at the other world stops (parked round 54 trials, loop/r54); (2) objects for the other worlds that are objects (Round & Round, Robot Workbench, Fieldfold, Dead End Shop), the same Blender route as the city.

### Round 58 (2026-10-13): on phones each world case rises clear of its card
- Found (round 57 queue, re-shot after rounds 55 to 57): at seven world stops (Launchboard, MGMTIO, Round & Round, Fieldfold, Robot Workbench, Jev, Dead End Shop) a phone showed the case mid-frame with its deck and gears under the card and the top third of the frame empty.
- Tried on live (aim-try.cjs lowers the aim of listed stops at runtime): 2.5 lower: the screen, deck and gears all sit above the card. 4 lower: the case rises further and a bare white pedestal pole shows between gears and card. Kept 2.5.
- Change: slot() gives every world a portrait keyframe aiming 2.5 lower (main.js blends it in on portrait only, as it does for the links). pAim:0 keeps the aim where a stop has its own framing: decks, Cyberpunk (round 56), Singular.
- Verify: same 54 programs; 27-stop walk 0 long frames; check-all PASS; desktop Launchboard frame matches live (mean pixel difference 2.6 of 255, the screen's cycling picture).
- Next queue: (1) objects for the other worlds that are objects (Round & Round, Robot Workbench, Fieldfold, Dead End Shop), the same Blender route as the city; (2) otherwise a fresh tour at both sizes.

### Round 59 (2026-10-13): the Round & Round case holds the marble lift itself
- Asked: an Opus counsel on whether the other object worlds should follow the city. Verdict: yes for Round & Round, Robot Workbench and Fieldfold (physical builds sit in the case as objects; software and video stay on screens), in that order, the screen removed rather than kept behind the object; the risk is phone cost, so bake to static meshes and load near the case.
- Built: world-export.cjs patches the page's inline app module on the way in so it exposes its scene, then exports the machine (102 meshes, 89k triangles) as a GLB. bl-slim.py (now clearing parents first: their transforms were left out of the joined mesh, which came out shifted; sky and sun colours now settable) decimated it to 60k, 44k after the undersides, and baked it under a warm studio light (its page's own sun, fff1d8, on a cream sky). city-pack.cjs now merges vertices that were split only by normals: the city's mesh shrinks 3.2 to 2.9 MB with the same triangles.
- Change: hall.js turns the city's code into modelStation(), driven by a MODELS table (file and scale per world); the dragon moves to cityDragon(). Round & Round gets the machine (2.0 MB mesh, 0.4 MB texture), the screen gone.
- Tried: scale 2.0 (about 60% of the case width) vs 2.5 (13.3 of 17 wide, 7 of 9 deep, 7.3 of 11 tall): 2.5 reads as the case's piece. Kept 2.5.
- Verify: same 54 programs; 27-stop walk 0 long frames; phone draw calls peak 85, Round & Round stop 34; check-all PASS. The Cyberpunk stop is unchanged after the refactor (shot).
- Note: the Round & Round and Cyberpunk screen pictures still sit in data.js and media but no longer load in the hall; leave them until a check shows nothing else uses them.
- Next queue: (1) Robot Workbench the same way; (2) Fieldfold, half-folded and still; (3) the machine's mesh is 3 vertices per triangle (smart UV splits every curved face): unwrap before decimating to cut its 2 MB.
