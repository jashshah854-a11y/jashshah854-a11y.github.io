# Portfolio improvement loop

One verified change per round. Numbers are phone tier (390x844, iPhone UA) draw calls unless noted.
Gate per round: no console errors except resume.pdf 404; deep link, Back restore and back-to-hall pass at 390x844, 1366x768, 1440x900; all 14 stops reachable; live routes 200 after the Pages build.

## Backlog (top = next)
- [ ] Vitrine stop still over budget (129 calls). Biggest remaining block: the 9 drive shafts are 4 draws each (body, keys, 2 collars) because they spin and hide one by one. Collars can join the spinning group (a round collar looks the same turning), then body+collar share brass.
- [ ] Phone first content: veil lifts at ~6.5 s locally (target 3 s or less).
- [ ] Occasional video-decode hitch in desktop transit between worlds.
- [ ] Landscape phone layout (never designed).
- [ ] Reduced-motion and keyboard paths through the tour.
- [ ] Image weight: oversized stills and posters.
- [ ] Resume link: add resume.pdf ONLY when Jash hands over the approved file.

## Rounds

### Round 1 (2026-10-10): static batching now merges non-indexed geometry
- Cause: hall.js static batching skipped any geometry without an index. RoundedBoxGeometry is non-indexed, so every deck and both brass trims on each station drew on their own.
- Change: batch key now carries indexed/non-indexed, so each kind merges with its own kind (mergeGeometries needs all one or the other).
- Phone calls, before -> after: vitrine 152 -> 129, hall 70 -> 61, decks 71 -> 61, end 104 -> 88, worlds ~34 -> ~33. No stop got worse. Screenshots identical.
- Gate: PASS at all three sizes.
