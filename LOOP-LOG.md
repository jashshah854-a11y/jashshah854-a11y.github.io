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
