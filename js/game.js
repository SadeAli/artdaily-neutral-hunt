/* ============================================================
   game.js — Neutral Hunt. Nine near-grey chips at similar L*,
   eight carrying a subtle Lab temperature cast, one true
   neutral (C < 0.5) — tap the neutral. Chips are generated in
   CIELAB and converted to sRGB, so the drill holds exact
   ground truth for scoring. DOM drill, no canvas: chip fills
   are absolute sRGB and must NOT follow the theme; all other
   inks are CSS variables, so no repaint pass is needed.
   ============================================================ */
(function () {
  'use strict';

  var SLUG = 'neutral-hunt';
  var ITEMS_PER_ROUND = 5;
  var CHIP_COUNT = 9;      /* 3x3 — eight casts + one neutral */
  var MIN_HUE_GAP = 25;    /* degrees between any two cast hues */
  var REVEAL_MS = 1400;

  /* ---- pure scoring + colour math (no DOM, unit-testable) ---- */

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Correct pick = 100. A wrong pick is judged by how neutral it
     still was — credit fades to zero at chroma 18 — then haircut
     to 55% because it wasn't the neutral. */
  function scoreChoice(isNeutral, chosenChroma) {
    if (isNeutral) return 100;
    return 100 * clamp01(1 - chosenChroma / 18) * 0.55;
  }

  function roundScore(scores) {
    if (!scores.length) return 0;
    var sum = 0;
    for (var i = 0; i < scores.length; i++) sum += scores[i];
    return sum / scores.length;
  }

  /* Casts shrink across the round: C 10–16 on grid 1 down to
     C 3.5–6 on grid 5. */
  function chromaRange(itemIdx) {
    var t = itemIdx / (ITEMS_PER_ROUND - 1);
    return { lo: lerp(10, 3.5, t), hi: lerp(16, 6, t) };
  }

  /* Hue sector → temperature word. Warm covers red→orange→yellow,
     h in [-45°, 135°); everything else reads cool. */
  function castLabel(hueDeg, chroma) {
    if (chroma < 0.5) return 'neutral';
    var h = ((hueDeg % 360) + 360) % 360;
    var warm = h < 135 || h >= 315;
    return (warm ? 'warm +' : 'cool +') + Math.round(chroma);
  }

  /* CIELAB (D65) → sRGB [0–255], gamut-clamped. Near-greys at
     L* 50–65 with C ≤ 16 sit comfortably inside the gamut. */
  function lab2rgb(L, a, b) {
    var fy = (L + 16) / 116;
    var fx = fy + a / 500;
    var fz = fy - b / 200;
    var e = 216 / 24389, k = 24389 / 27;
    function finv(t) { var t3 = t * t * t; return t3 > e ? t3 : (116 * t - 16) / k; }
    var X = finv(fx) * 0.95047;
    var Y = (L > k * e) ? fy * fy * fy : L / k;
    var Z = finv(fz) * 1.08883;
    var rl = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    var gl = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    var bl = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    function gam(c) {
      c = clamp01(c);
      return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    }
    return [Math.round(gam(rl) * 255), Math.round(gam(gl) * 255), Math.round(gam(bl) * 255)];
  }

  /* ---- generation ---- */

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  /* n hues on the circle with every pair — including the wrap —
     at least minGap degrees apart: hand out the mandatory gaps,
     then split the leftover arc randomly. */
  function pickHues(n, minGap) {
    var slack = 360 - n * minGap;
    var weights = [], sum = 0, i;
    for (i = 0; i < n; i++) { weights.push(Math.random()); sum += weights[i]; }
    if (!sum) sum = 1;
    var hues = [], acc = Math.random() * 360;
    for (i = 0; i < n; i++) {
      hues.push(acc % 360);
      acc += minGap + slack * (weights[i] / sum);
    }
    return hues;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function makeItem(itemIdx) {
    /* one shared value so the neutral can't be found by lightness;
       ±1 L* jitter keeps the sheet from looking machine-flat */
    var baseL = rand(51, 64);
    var range = chromaRange(itemIdx);
    var hues = pickHues(CHIP_COUNT - 1, MIN_HUE_GAP);
    var chips = [], i;
    for (i = 0; i < CHIP_COUNT - 1; i++) {
      var C = rand(range.lo, range.hi);
      var hRad = hues[i] * Math.PI / 180;
      chips.push({
        L: baseL + rand(-1, 1),
        a: C * Math.cos(hRad),
        b: C * Math.sin(hRad),
        chroma: C,
        hue: hues[i],
        neutral: false,
      });
    }
    chips.push({ L: baseL + rand(-1, 1), a: 0, b: 0, chroma: 0, hue: 0, neutral: true });
    return shuffle(chips);
  }

  /* ---- chrome ---- */

  var grid = document.getElementById('chipGrid');
  var hint = document.getElementById('hint');
  var toast = document.getElementById('toast');
  var hudRound = document.getElementById('hudRound');
  var hudScore = document.getElementById('hudScore');
  var hudBest = document.getElementById('hudBest');

  ArtDaily.init({ slug: SLUG });

  /* ---- round state ---- */
  var round = 0, itemIdx = 0, scores = [], chips = [];
  var playing = false, revealed = false, pickedIdx = -1, revealTimer = null;

  /* render() rebuilds the grid from state, so it is safe to call
     at any moment — including from the theme hook mid-reveal. */
  function render() {
    grid.innerHTML = '';
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      var rgb = lab2rgb(chip.L, chip.a, chip.b);
      btn.style.background = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
      btn.dataset.idx = String(i);
      if (revealed) {
        btn.disabled = true;
        var label = castLabel(chip.hue, chip.chroma);
        if (chip.neutral) btn.className += ' is-neutral';
        if (i === pickedIdx) btn.className += ' is-picked';
        var pill = document.createElement('span');
        pill.className = 'chip-label';
        pill.textContent = label;
        btn.appendChild(pill);
        btn.setAttribute('aria-label', 'chip ' + (i + 1) + ': ' + label + (i === pickedIdx ? ' — your pick' : ''));
      } else {
        btn.setAttribute('aria-label', 'grey chip ' + (i + 1) + ' of ' + chips.length);
      }
      grid.appendChild(btn);
    }
  }

  function startItem() {
    chips = makeItem(itemIdx);
    revealed = false;
    pickedIdx = -1;
    render();
    hint.textContent = 'grid ' + (itemIdx + 1) + ' of ' + ITEMS_PER_ROUND + ' — tap the true neutral.';
  }

  function newRound() {
    clearTimeout(revealTimer);
    /* If all five picks are in but the final reveal's timer hadn't
       fired yet, the round is complete — report it before resetting,
       so "new round" mid-reveal never swallows a finished round.
       finishRound() flips playing to false, so this cannot double-
       report: the timer path and this flush are mutually exclusive. */
    if (playing && scores.length >= ITEMS_PER_ROUND) finishRound();
    round += 1;
    itemIdx = 0;
    scores = [];
    playing = true;
    hudRound.textContent = String(round);
    hudScore.textContent = '–';
    startItem();
  }

  /* ---- input → reveal → score ---- */

  function pick(idx) {
    var chip = chips[idx];
    if (!chip) return;
    pickedIdx = idx;
    revealed = true;
    scores.push(scoreChoice(chip.neutral, chip.chroma));
    render();
    hint.textContent = chip.neutral
      ? 'yes — that is the true neutral.'
      : 'that grey leans ' + castLabel(chip.hue, chip.chroma) + ' — the ringed chip is the neutral.';
    revealTimer = setTimeout(nextItem, REVEAL_MS);
  }

  function nextItem() {
    itemIdx += 1;
    if (itemIdx >= ITEMS_PER_ROUND) { finishRound(); return; }
    startItem();
  }

  /* click covers touch, mouse and Enter/Space on the buttons */
  grid.addEventListener('click', function (ev) {
    if (!playing || revealed) return;
    var el = ev.target;
    while (el && el !== grid && !(el.dataset && el.dataset.idx)) el = el.parentNode;
    if (!el || el === grid) return;
    pick(parseInt(el.dataset.idx, 10));
  });

  function finishRound() {
    playing = false;
    var res = ArtDaily.report(roundScore(scores));
    hudScore.textContent = String(res.score);
    hudBest.textContent = res.best === null ? '–' : String(res.best);
    hint.textContent = 'round done — press “new round” to hunt again.';
    showToast((res.isNewBest ? 'new best! ' : 'score ') + res.score + ' / 100', res.isNewBest);
  }

  var toastTimer = null;
  function showToast(msg, celebrate) {
    toast.innerHTML = '';
    var s = document.createElement('span');
    s.className = celebrate ? 'toast-accent' : '';
    s.textContent = msg;
    toast.appendChild(s);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2200);
  }

  /* ---- chrome wiring ---- */
  document.getElementById('btnRound').addEventListener('click', newRound);

  var btnHow = document.getElementById('btnHow');
  var howTo = document.getElementById('howTo');
  btnHow.addEventListener('click', function () {
    howTo.hidden = !howTo.hidden;
    btnHow.setAttribute('aria-expanded', String(!howTo.hidden));
  });

  /* Chip fills are ground truth and ignore the theme; re-render so
     rings and pills restyle instantly under the new CSS variables.
     (No canvas → no fitCanvas/DPR pass and no resize handler; the
     grid is fluid CSS.) */
  ArtDaily.onTheme(render);

  /* ---- boot ---- */
  var best = ArtDaily.best();
  hudBest.textContent = best === null ? '–' : String(best);
  newRound();
})();
