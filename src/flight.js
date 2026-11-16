// 簡化的紙飛機飛行模型（單位：公尺、公斤、秒、弧度）
// 狀態：位置、速度 V、航跡角 gamma、航向 psi、機身俯仰 theta、俯仰角速度 q、傾斜 phi
var Flight = (function () {
  var RHO = 1.2, G = 9.8;
  var AERO = {
    dart:   { m: 0.0050, S: 0.010, CLa: 2.6, CD0: 0.060, K: 0.25, trim: 0.075, kp: 1.25, stall: 0.30 },
    glider: { m: 0.0050, S: 0.030, CLa: 3.2, CD0: 0.042, K: 0.12, trim: 0.12, kp: 0.85, stall: 0.28 },
    lock:   { m: 0.0050, S: 0.018, CLa: 3.0, CD0: 0.040, K: 0.15, trim: 0.09, kp: 1.05, stall: 0.28 },
    stunt:  { m: 0.0050, S: 0.020, CLa: 3.0, CD0: 0.050, K: 0.15, trim: 0.15, kp: 0.90, stall: 0.34 }
  };

  // 小朋友能調的旋鈕 → 物理參數
  function setup(planeId, knobs) {
    var a = AERO[planeId];
    var clips = knobs.clips, tail = knobs.tail;
    var m = a.m + clips * 0.0007, trim = a.trim + tail * 0.06 - clips * 0.045;
    // 平衡飛行速度：升力剛好等於重量時的速度（用沒加迴紋針、沒翹尾巴的狀態算）
    var vTrim = Math.sqrt(2 * a.m * G / (RHO * a.S * a.CLa * a.trim));
    return {
      vTrim: vTrim,
      m: m,
      S: a.S, CLa: a.CLa, K: a.K, stall: a.stall,
      CD0: a.CD0 + tail * 0.006,
      trim: trim,
      kp: a.kp * (1 + clips * 0.4),
      bankTarget: knobs.asym * 0.22,
      V0: [0, 3, 5, 7, 9, 11][knobs.power], // 力氣 1~5 → 每秒 3~11 公尺
      g0: knobs.angle * Math.PI / 180,
      h0: 1.3
    };
  }

  function CL(p, al) {
    var s = al < 0 ? -1 : 1, x = Math.abs(al);
    if (x <= p.stall) return p.CLa * al;
    return s * p.CLa * p.stall * Math.max(0.42, 1 - 2.6 * (x - p.stall));
  }

  function simulate(planeId, knobs) {
    var p = setup(planeId, knobs);
    var x = 0, y = p.h0, z = 0, V = p.V0, gam = p.g0, psi = 0, th = p.g0, q = 0, phi = 0;
    var dt = 1 / 600, t = 0, out = [], every = 10; // 每 1/60 秒記錄一次
    var maxAlpha = 0, minV = V, pitchTravel = 0, lastTh = th, stalledAt = -1;
    for (var i = 0; i < 600 * 25; i++) {
      var al = th - gam;
      var qbar = 0.5 * RHO * V * V;
      var cl = CL(p, al);
      var cd = p.CD0 + p.K * cl * cl + 0.9 * Math.pow(Math.sin(al), 2);
      var L = qbar * p.S * cl, D = qbar * p.S * cd, Wt = p.m * G;
      if (i % every === 0) out.push({ t: t, x: x, y: y, z: z, V: V, gam: gam, psi: psi, th: th, phi: phi, al: al, L: L, D: D, W: Wt });
      if (Math.abs(al) > maxAlpha && t > 0.15) maxAlpha = Math.abs(al);
      if (Math.abs(al) > p.stall && stalledAt < 0 && t > 0.15) stalledAt = t;
      // 縱向
      var Vs = Math.max(V, 0.35);
      var dV = -D / p.m - G * Math.sin(gam);
      var dGam = (L * Math.cos(phi) - Wt * Math.cos(gam)) / (p.m * Vs);
      var cg = Math.cos(gam); if (Math.abs(cg) < 0.25) cg = cg < 0 ? -0.25 : 0.25;
      var dPsi = L * Math.sin(phi) / (p.m * Vs * cg);
      // 俯仰：像風向雞，機頭會被拉回「平衡角」；速度越快拉得越用力
      var w2 = p.kp * 42 * Math.max(V * V, 1.5);
      var dq = -w2 * (al - p.trim) - 2 * 0.55 * Math.sqrt(w2) * (q - dGam);
      var dPhi = (p.bankTarget - phi) * 2.2;
      V += dV * dt; gam += dGam * dt; psi += dPsi * dt; q += dq * dt; th += q * dt; phi += dPhi * dt;
      if (V < 0.05) V = 0.05;
      x += V * Math.cos(gam) * Math.cos(psi) * dt;
      z += V * Math.cos(gam) * Math.sin(psi) * dt;
      y += V * Math.sin(gam) * dt;
      pitchTravel += Math.abs(th - lastTh); lastTh = th;
      if (V < minV && t > 0.15) minV = V;
      t += dt;
      if (y <= 0) { y = 0; break; }
    }
    out.push({ t: t, x: x, y: 0, z: z, V: V, gam: gam, psi: psi, th: th, phi: phi, al: th - gam, L: 0, D: 0, W: p.m * G });
    return { pts: out, time: t, dist: Math.hypot(x, z), x: x, z: z, maxAlpha: maxAlpha, stalledAt: stalledAt, params: p, verdict: judge(out, p, t, Math.hypot(x, z), maxAlpha) };
  }

  // 判斷這次飛行最明顯的現象
  function judge(pts, p, time, dist, maxAlpha) {
    var maxTh = -Infinity, ups = 0, prevDir = 0, peakCount = 0, lastPeak = null;
    pts.forEach(function (s) { if (s.th > maxTh) maxTh = s.th; });
    // 數高度的起伏（波浪）
    for (var i = 2; i < pts.length; i++) {
      var dy = pts[i].y - pts[i - 1].y, dir = dy > 0.002 ? 1 : (dy < -0.002 ? -1 : 0);
      if (dir !== 0) {
        if (prevDir === -1 && dir === 1) ups++;
        prevDir = dir;
      }
    }
    var last = pts[pts.length - 1];
    var turn = Math.abs(last.psi) * 180 / Math.PI;
    var looped = maxTh > Math.PI * 0.75;
    var avgSlope = (p.h0) / Math.max(dist, 0.01);
    if (looped) return 'loop';
    if (dist < 1.6 && time < 1.0) return 'drop';
    if (maxAlpha > p.stall + 0.08) return 'stall';
    if (ups >= 2) return 'wave';
    if (turn > 35 || Math.abs(last.z) > 1.2) return 'turn';
    if (p.trim < 0.03 || (avgSlope > 0.5 && pts.some(function (s) { return s.gam < -0.6; }))) return 'dive';
    return 'smooth';
  }

  // 幫一架飛機找出飛最遠的丟法（不轉彎）
  function findBest(planeId) {
    var best = null, tried = 0;
    [1, 2, 3, 4, 5].forEach(function (power) {
      [0, 10, 25, 40].forEach(function (angle) {
        [0, 1, 2].forEach(function (clips) {
          [0, 1, 2, 3].forEach(function (tail) {
            var k = { power: power, angle: angle, clips: clips, tail: tail, asym: 0 };
            var r = simulate(planeId, k); tried++;
            if (r.verdict === 'loop') return; // 翻圈的飛法不算
            if (!best || r.dist > best.dist) best = { dist: r.dist, knobs: k };
          });
        });
      });
    });
    best.tried = tried;
    return best;
  }

  return { simulate: simulate, setup: setup, findBest: findBest };
})();
if (typeof module !== 'undefined') module.exports = Flight;
