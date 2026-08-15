# Neutral Hunt 🕵️

Spot the true neutral among the near-greys — a colour drill that trains
your eye to catch subtle temperature casts, the ones that sneak into
"grey" mixes on the palette.

Each grid shows nine chips at similar L\* (50–65): eight carry a Lab
temperature cast (hues ≥ 25° apart), one is a true neutral (C < 0.5).
Tap the neutral; every attempt reveals each chip's cast ("warm +7",
"cool +4", "neutral" — violet and magenta casts are named rather than
called warm/cool, since their temperature is context-dependent). The
reveal shows the pick's score and lingers longer on a wrong pick
(2.6 s vs 1.2 s); tap anywhere on the revealed grid to advance early.
Five grids per round, casts shrinking from C 10–16 down to C 3.5–6.
Scoring: correct = 100, wrong = `100 · clamp(1 − C/Cmax, 0, 1) · 0.55`
where `Cmax` is the strongest cast on that grid (rounded per grid); the
round is the mean of five, with the per-grid breakdown shown at round
end. Grading each miss against its own grid keeps the credit honest —
the casts shrink as the round goes on, so a fixed yardstick would pay
more for missing the hard grids than the easy ones. Tapping at random
lands near 19/100; the neutral is the only route to 100.

Run it: `python3 -m http.server 8080` in this folder — zero build, zero deps.

Part of [Art Daily](https://artdaily.sadeali.com/) · more at [sadeali.com](https://sadeali.com/).
