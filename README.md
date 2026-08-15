# Neutral Hunt 🕵️

Spot the true neutral among the near-greys — a colour drill that trains
your eye to catch subtle temperature casts, the ones that sneak into
"grey" mixes on the palette.

Each grid shows nine chips at similar L\* (50–65): eight carry a Lab
temperature cast (hues ≥ 25° apart), one is a true neutral (C < 0.5).
Tap the neutral; every attempt reveals each chip's cast ("warm +7",
"cool +4", "neutral"). Five grids per round, casts shrinking from
C 10–16 down to C 3.5–6. Scoring: correct = 100, wrong =
`100 · clamp(1 − C/18, 0, 1) · 0.55`; the round is the mean of five.

Run it: `python3 -m http.server 8080` in this folder — zero build, zero deps.

Part of [Art Daily](https://artdaily.sadeali.com/) · more at [sadeali.com](https://sadeali.com/).
