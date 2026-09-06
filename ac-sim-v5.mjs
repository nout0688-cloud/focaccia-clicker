// Симуляция TapSentinel v5.1 (точный порт формул) — калибровка
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAP_CAP = 360;

function rhythmScore(taps) {
  if (taps.length < 10) return 0;
  const ivs = [];
  for (let i = 1; i < taps.length; i++) ivs.push(taps[i].t - taps[i - 1].t);
  const mean = ivs.reduce((a, b) => a + b, 0) / ivs.length;
  const sd = Math.sqrt(ivs.reduce((a, b) => a + (b - mean) ** 2, 0) / ivs.length);
  const cv = sd / mean;
  const sorted = [...ivs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const tol = Math.max(8, median * 0.15);
  const clusterFrac = ivs.filter((iv) => Math.abs(iv - median) <= tol).length / ivs.length;
  const hasPause = ivs.some((iv) => iv > 2500);
  const subSize = Math.max(5, Math.min(10, Math.floor(ivs.length / 4)));
  const subMeans = [];
  for (let s = 0; s + subSize <= ivs.length; s += subSize) {
    const sub = ivs.slice(s, s + subSize);
    subMeans.push(sub.reduce((a, b) => a + b, 0) / sub.length);
  }
  let noiseStructure = 0;
  if (subMeans.length >= 2 && cv > 0.0001) {
    const smMean = subMeans.reduce((a, b) => a + b, 0) / subMeans.length;
    const smSd = Math.sqrt(subMeans.reduce((a, b) => a + (b - smMean) ** 2, 0) / subMeans.length);
    const ratio = smSd / smMean / cv;
    noiseStructure = Math.max(0, Math.min(100, ((0.50 - ratio) / (0.50 - 0.32)) * 100));
  }
  const speedScore = mean >= 125 ? 0 : mean >= 100 ? 25 : mean >= 70 ? 45 : mean >= 55 ? 60 : mean >= 45 ? 75 : mean >= 35 ? 85 : mean >= 25 ? 92 : 100;
  const regularityScore = cv >= 0.25 ? 0 : cv >= 0.18 ? 20 : cv >= 0.12 ? 40 : cv >= 0.08 ? 60 : cv >= 0.05 ? 80 : 100;
  const clusterScore = clusterFrac < 0.55 ? 0 : clusterFrac < 0.70 ? 30 : clusterFrac < 0.80 ? 55 : clusterFrac < 0.90 ? 75 : 100;
  const pauseScore = hasPause ? 0 : 20;
  return Math.round(0.30 * speedScore + 0.20 * regularityScore + 0.15 * clusterScore + 0.25 * noiseStructure + 0.10 * pauseScore);
}

function coordScore(taps) {
  if (taps.length < 60) return 0;
  const xs = taps.map((t) => t.x);
  const ys = taps.map((t) => t.y);
  const close = (i, j) => Math.abs(xs[i] - xs[j]) <= 8 && Math.abs(ys[i] - ys[j]) <= 8;
  let rep1 = 0, rep2 = 0;
  for (let i = 1; i < taps.length; i++) {
    if (close(i, i - 1)) rep1++;
    for (let k = 2; k <= 5 && i - k >= 0; k++) {
      if (close(i, i - k)) { rep2++; break; }
    }
  }
  const frac1 = rep1 / (taps.length - 1);
  const frac2 = rep2 / (taps.length - 1);
  const patternFraction = Math.max(frac1, frac2); // AAAA и ABAB оба ловятся
  const repeatScore = patternFraction > 0.90 ? 100 : patternFraction > 0.75 ? 70 : patternFraction > 0.55 ? 40 : 0;
  const steps = [];
  for (let i = 1; i < taps.length; i++) steps.push(Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  const stMean = steps.reduce((a, b) => a + b, 0) / steps.length;
  const stVar = steps.reduce((a, b) => a + (b - stMean) ** 2, 0) / steps.length;
  const movementScore = stVar < 4 && taps.length > 100 ? 80 : 0;
  const dirs = new Set();
  let flips = 0, lastSign = 0;
  for (let i = 1; i < taps.length; i++) {
    const dx = xs[i] - xs[i - 1], dy = ys[i] - ys[i - 1];
    if (Math.hypot(dx, dy) < 0.5) continue;
    dirs.add(Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4))) % 8);
    const s = Math.sign(dx);
    if (s !== 0) { if (lastSign !== 0 && s !== lastSign) flips++; lastSign = s; }
  }
  const directionScore = (dirs.size <= 2 && steps.length > 20) || (flips > 60 && stMean < 6) ? 70 : 0;
  const bbox = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
  const pathScore = stMean < 4 && bbox > 15 ? 60 : 0;
  return Math.round(0.35 * repeatScore + 0.25 * movementScore + 0.20 * directionScore + 0.20 * pathScore);
}

function behaviourScore(state, taps) {
  let b = 0;
  const now = Date.now();
  const syntheticRate = state.syntheticTaps.filter((ts) => now - ts < 60000).length;
  if (syntheticRate >= 20) b = 100;
  else if (syntheticRate >= 8) b += 60;
  if (state.bLongSession) b += 10;
  if (state.bFastStreak) b += 10;
  if (taps.length >= 300) {
    const span = taps[taps.length - 1].wall - taps[0].wall;
    if (span > 8 * 60 * 1000) b += 10;
  }
  return Math.min(100, b);
}

function humanScore(taps, platform) {
  if (taps.length < 40) return 0;
  const ivs = [];
  for (let i = 1; i < taps.length; i++) ivs.push(taps[i].t - taps[i - 1].t);
  const mean = ivs.reduce((a, b) => a + b, 0) / ivs.length;
  const sd = Math.sqrt(ivs.reduce((a, b) => a + (b - mean) ** 2, 0) / ivs.length);
  const cv = sd / mean;
  const subSize = Math.max(10, Math.min(25, Math.floor(ivs.length / 8)));
  const subMeans = [];
  for (let s = 0; s + subSize <= ivs.length; s += subSize) {
    const sub = ivs.slice(s, s + subSize);
    subMeans.push(sub.reduce((a, b) => a + b, 0) / sub.length);
  }
  let tempoDrift = 30;
  if (subMeans.length >= 2) {
    const smMean = subMeans.reduce((a, b) => a + b, 0) / subMeans.length;
    const smSd = Math.sqrt(subMeans.reduce((a, b) => a + (b - smMean) ** 2, 0) / subMeans.length);
    tempoDrift = Math.min(100, (smMean > 0 ? smSd / smMean : 0) * 250);
  }
  const intervalVariation = Math.min(100, cv * 400);
  const pauses = ivs.filter((iv) => iv > 800);
  const pauseNaturalness = pauses.length === 0 ? 0 : pauses.length === 1 ? 60 : Math.min(100, 40 + pauses.length * 10);
  const xs = taps.map((t) => t.x);
  const ys = taps.map((t) => t.y);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const stdX = Math.sqrt(xs.reduce((a, b) => a + (b - mx) ** 2, 0) / xs.length);
  const stdY = Math.sqrt(ys.reduce((a, b) => a + (b - my) ** 2, 0) / ys.length);
  const pathVariation = platform === 'ios' || platform === 'android' ? Math.min(100, (stdX + stdY) * 4) : 50;
  const span = taps[taps.length - 1].wall - taps[0].wall;
  const sessionVariation = span > 15 * 60000 ? 100 : span > 8 * 60000 ? 60 : 20;
  return Math.round(0.30 * tempoDrift + 0.20 * intervalVariation + 0.15 * pauseNaturalness + 0.20 * pathVariation + 0.15 * sessionVariation);
}

// ==== Потоки ====
const r = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 1.5;

function humanStream(n, base) {
  const out = [];
  let pt = 0, wall = 0, x = 105, y = 210, rate = base;
  let anchorX = 0, anchorY = 0;
  for (let i = 0; i < n; i++) {
    rate += gauss() * base * 0.18 + (i > n * 0.6 ? base * 0.04 : 0);
    rate = Math.max(base * 0.5, Math.min(base * 2.2, rate));
    let pause = 0;
    if (Math.random() < 0.04) pause = r(400, 1200);
    pt += Math.max(45, rate + gauss() * rate * 0.15 + pause);
    wall += Math.max(45, rate + pause);
    anchorX += gauss() * 3; anchorY += gauss() * 3;
    x = 105 + anchorX + gauss() * 8;
    y = 210 + anchorY + gauss() * 8;
    if (Math.random() < 0.1) { x += gauss() * 25; y += gauss() * 20; }
    out.push({ t: pt, wall, x, y });
  }
  return out;
}

function userBotStream(n, interval, jitter, drift) {
  const out = [];
  let pt = 0, wall = 0, x = 105, y = 210, phase = Math.random() * 6;
  for (let i = 0; i < n; i++) {
    const iv = Math.max(20, interval + r(-jitter, jitter));
    pt += iv; wall += iv;
    phase += 0.25;
    x += Math.sin(phase) * drift + r(-1, 1);
    y += Math.cos(phase) * drift + r(-1, 1);
    out.push({ t: pt, wall, x, y });
  }
  return out;
}

function perfectBotStream(n) {
  const out = [];
  let pt = 0, wall = 0, x = 105, y = 210;
  for (let i = 0; i < n; i++) {
    pt += 100; wall += 100;
    x = 105 + Math.sin(pt / 250) * 3;
    y = 210 + Math.cos(pt / 250) * 3;
    out.push({ t: pt, wall, x, y });
  }
  return out;
}

// ==== Триггер-прогон ====
function runTrigger(stream, platform, label, maxTaps = 3000) {
  const taps = stream.slice(0, maxTaps);
  let suspicion = 0;
  const recent = [];
  let boost = 0;
  let triggeredAt = -1, triggerTap = -1;
  const t0 = taps[0]?.t ?? 0;
  const state = { syntheticTaps: [], bLongSession: false, bFastStreak: false };
  let dbg = { R: 0, C: 0, B: 0, H: 0, ev: 0, n: 0 };

  for (let i = 10; i < taps.length; i++) {
    const t10 = taps.slice(Math.max(0, i - 10), i);
    const t40 = taps.slice(Math.max(0, i - 40), i);
    const t100 = taps.slice(Math.max(0, i - 100), i);
    const t300 = taps.slice(Math.max(0, i - 300), i);

    let rSum = 0, wSum = 0;
    const scales = [[0.15, t10, 10], [0.30, t40, 40], [0.30, t100, 100], [0.25, t300, 300]];
    for (const [w, tp, need] of scales) {
      if (tp.length >= need) { rSum += w * rhythmScore(tp); wSum += w; }
    }
    const R = wSum > 0 ? rSum / wSum : 0;
    const C = coordScore(t300);
    const B = behaviourScore(state, t300);
    const H40 = humanScore(t40, platform);
    const H100 = t100.length >= 100 ? humanScore(t100, platform) : 0;
    const H300 = t300.length >= 300 ? humanScore(t300, platform) : 0;
    const H = 0.20 * H40 + 0.35 * H100 + 0.45 * H300;

    if (t10.length >= 10) {
      const iv10 = [];
      for (let k = 1; k < t10.length; k++) iv10.push(t10[k].t - t10[k - 1].t);
      const m10 = iv10.reduce((a, b) => a + b, 0) / iv10.length;
      if (m10 < 45) boost = Math.min(25, boost + 12);
    }

    const humanMitigation = Math.min(25, 0.35 * H);
    const evidence = clamp(0.50 * R + 0.25 * C + 0.25 * B - humanMitigation + boost, 0, 100);
    suspicion = suspicion * 0.90 + evidence * 0.10;
    dbg.R += R; dbg.C += C; dbg.B += B; dbg.H += H; dbg.ev += evidence; dbg.n++;
    recent.push(evidence);
    if (recent.length > 5) recent.shift();
    boost *= 0.75;

    const enoughHistory = recent.length >= 5;
    const strongRatio = recent.filter((v) => v >= 12).length / recent.length;
    const veryStrongRatio = recent.filter((v) => v >= 20).length / recent.length;
    const indep = (R >= 40 ? 1 : 0) + (C >= 45 ? 1 : 0) + (B >= 45 ? 1 : 0);
    if (
      enoughHistory && suspicion >= 16 && strongRatio >= 0.60 &&
      veryStrongRatio >= 0.35 && indep >= 2
    ) {
      triggeredAt = taps[i].t - t0;
      triggerTap = i + 1;
      break;
    }
  }
  const dbgAvg = `R=${(dbg.R / dbg.n).toFixed(0)} C=${(dbg.C / dbg.n).toFixed(0)} B=${(dbg.B / dbg.n).toFixed(0)} H=${(dbg.H / dbg.n).toFixed(0)} evidence=${(dbg.ev / dbg.n).toFixed(0)}`;
  console.log(`${label}: ${triggeredAt >= 0 ? `TRIGGER через ${(triggeredAt / 1000).toFixed(0)}с / ${triggerTap} тапов` : 'нет триггера'}  [${dbgAvg}]`);
}

const state = {};
console.log('=== TapSentinel v5.1 ===');
runTrigger(humanStream(3000, 330), 'ios', 'человек 3/с (10 мин)');
runTrigger(humanStream(3000, 200), 'ios', 'человек 5/с');
runTrigger(humanStream(3000, 145), 'ios', 'человек 7/с');
runTrigger(humanStream(3000, 110), 'ios', 'человек 9/с');
console.log('---');
runTrigger(userBotStream(3000, 125, 35, 2.5), 'android', 'ЭКСПЛОЙТ юзера 8/с (движущаяся точка)');
runTrigger(userBotStream(3000, 200, 60, 3), 'android', 'джиттер-бот 5/с');
runTrigger(userBotStream(3000, 330, 90, 4), 'android', 'медленный джиттер-бот 3/с');
console.log('---');
runTrigger(perfectBotStream(3000), 'android', 'идеальный бот 10/с');
runTrigger(userBotStream(3000, 100, 25, 0), 'android', 'фикс-точка + джиттер 10/с');
