// 摺紙引擎：紙張 = 一組凸多邊形，每一步沿摺線切開再繞軸旋轉。
// 座標單位 mm：x 為左右（中線 x=0），y 為長邊（機頭 y=297），z 為疊層高度。
var FoldEngine = (function () {
  var W = 210, H = 297, LAYER = 0.22, EPS = 1e-7;

  function rect() {
    var o = [[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]];
    return [{
      cur: o.map(function (p) { return [p[0], p[1], 0]; }),
      orig: o.map(function (p) { return [p[0], p[1]]; }),
      edges: ['b', 'b', 'b', 'b'], // 邊 i 連接頂點 i 與 i+1；b=紙邊 c=摺痕
      moved: [], tag: null
    }];
  }

  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function side(line, p) {
    var a = line[0], b = line[1];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  }
  function centroid(poly) {
    var x = 0, y = 0, z = 0, n = poly.cur.length;
    poly.cur.forEach(function (p) { x += p[0]; y += p[1]; z += p[2]; });
    return [x / n, y / n, z / n];
  }
  function clone(poly, cur, orig, edges) {
    return { cur: cur, orig: orig, edges: edges, moved: poly.moved.slice(), tag: poly.tag };
  }

  // 用直線把凸多邊形切成兩半（只看 x、y）
  function split(poly, line) {
    var n = poly.cur.length, s = poly.cur.map(function (p) { return side(line, p); });
    var hasPos = s.some(function (v) { return v > 1e-6; }), hasNeg = s.some(function (v) { return v < -1e-6; });
    if (!hasPos || !hasNeg) return [poly];
    function cls(v, sg) { v *= sg; return v > 1e-6 ? 1 : (v < -1e-6 ? -1 : 0); }
    function clip(sg) {
      var c = [], o = [], e = [];
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n, ci = cls(s[i], sg), cj = cls(s[j], sg);
        if (ci >= 0) {
          c.push(poly.cur[i]); o.push(poly.orig[i]);
          e.push(ci === 0 && cj < 0 ? 'c' : poly.edges[i]);
        }
        if ((ci > 0 && cj < 0) || (ci < 0 && cj > 0)) {
          var t = s[i] / (s[i] - s[j]);
          c.push(lerp3(poly.cur[i], poly.cur[j], t)); o.push(lerp2(poly.orig[i], poly.orig[j], t));
          e.push(ci > 0 ? 'c' : poly.edges[i]);
        }
      }
      return c.length >= 3 ? clone(poly, c, o, e) : null;
    }
    return [clip(1), clip(-1)].filter(Boolean);
  }

  function rotatePoint(p, ax, ang) {
    var px = p[0] - ax.p[0], py = p[1] - ax.p[1], pz = p[2] - ax.p[2];
    var k = ax.k, c = Math.cos(ang), s = Math.sin(ang);
    var dot = k[0] * px + k[1] * py + k[2] * pz;
    var cx = k[1] * pz - k[2] * py, cy = k[2] * px - k[0] * pz, cz = k[0] * py - k[1] * px;
    return [
      ax.p[0] + px * c + cx * s + k[0] * dot * (1 - c),
      ax.p[1] + py * c + cy * s + k[1] * dot * (1 - c),
      ax.p[2] + pz * c + cz * s + k[2] * dot * (1 - c)
    ];
  }

  function zRange(polys) {
    var lo = Infinity, hi = -Infinity;
    polys.forEach(function (q) { q.cur.forEach(function (p) { lo = Math.min(lo, p[2]); hi = Math.max(hi, p[2]); }); });
    return [lo, hi];
  }

  function matches(poly, op) {
    if (op.tagFilter && poly.tag !== op.tagFilter) return false;
    if (op.movedFilter && poly.moved.indexOf(op.movedFilter) < 0) return false;
    return true;
  }

  // 把疊層高度重新排成等間距（只在全部攤平時做），同時更新已記錄的旋轉軸高度
  function renormalize(polys, axes) {
    var levels = [];
    polys.forEach(function (q) {
      var z = Math.round(q.cur[0][2] * 1000) / 1000;
      if (levels.indexOf(z) < 0) levels.push(z);
    });
    levels.sort(function (a, b) { return a - b; });
    function map(z) {
      if (z <= levels[0]) return (z - levels[0]);
      for (var i = 0; i < levels.length - 1; i++) {
        if (z <= levels[i + 1]) {
          var t = (z - levels[i]) / (levels[i + 1] - levels[i]);
          return (i + t) * LAYER;
        }
      }
      return (levels.length - 1) * LAYER + (z - levels[levels.length - 1]);
    }
    polys.forEach(function (q) { q.cur.forEach(function (p) { p[2] = map(p[2]); }); });
    Object.keys(axes).forEach(function (id) { var a = axes[id]; a.p = [a.p[0], a.p[1], map(a.p[2])]; });
  }

  // 準備一個步驟：切開、選出要動的多邊形、算出旋轉軸
  function prepare(state, step) {
    var polys = state.polys, axes = state.axes;
    var plan = [];
    (step.ops || []).forEach(function (op) {
      if (op.unfold) {
        var ax = axes[op.unfold];
        plan.push({ ax: { p: ax.p.slice(), k: ax.k.slice() }, ang: -op.angle * Math.PI / 180, sel: function (q) { return q.moved.indexOf(op.unfold) >= 0; } });
        return;
      }
      // 切開
      var next = [];
      polys.forEach(function (q) { if (matches(q, op)) next.push.apply(next, split(q, op.line)); else next.push(q); });
      polys = next;
      var refSide = side(op.line, op.move) > 0;
      var movers = polys.filter(function (q) { return matches(q, op) && (side(op.line, centroid(q)) > 0) === refSide; });
      var zr = zRange(polys);
      var h = op.dir === 'mountain' ? zr[0] - LAYER / 2 : zr[1] + LAYER / 2;
      var a = op.line[0], b = op.line[1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      var k = [dx / len, dy / len, 0];
      // 讓移動的那一側先往上（谷摺）或往下（山摺）
      var c = centroid(movers[0] || polys[0]);
      var r = [c[0] - a[0], c[1] - a[1]];
      var crossZ = k[0] * r[1] - k[1] * r[0];
      var wantUp = op.dir !== 'mountain';
      if ((crossZ > 0) !== wantUp) k = [-k[0], -k[1], 0];
      var ax = { p: [a[0], a[1], h], k: k };
      if (op.id) axes[op.id] = { p: ax.p.slice(), k: ax.k.slice() };
      movers.forEach(function (q) {
        if (op.id && !op.crease) q.moved.push(op.id);
        if (op.setTag) q.tag = op.setTag;
      });
      if (op.setTag && op.otherTag) polys.forEach(function (q) { if (movers.indexOf(q) < 0 && q.tag === null) q.tag = op.otherTag; });
      plan.push({ ax: ax, ang: (op.angle || 180) * Math.PI / 180, crease: !!op.crease, set: movers });
    });
    state.polys = polys;
    plan.forEach(function (p) {
      if (p.sel) p.set = polys.filter(p.sel);
    });
    return plan;
  }

  // 執行整個摺法，回傳每一步的起始狀態與動畫計畫
  function build(spec) {
    var state = { polys: rect(), axes: {} };
    var frames = [];
    spec.steps.forEach(function (step) {
      var plan = prepare(state, step);
      var snapshot = state.polys.map(function (q) { return q; });
      var startCur = snapshot.map(function (q) { return q.cur.map(function (v) { return v.slice(); }); });
      frames.push({ polys: snapshot, start: startCur, plan: plan, step: step });
      var end = poseOn(state.polys, startCur, plan, 1);
      state.polys.forEach(function (q, i) { q.cur = end[i].map(function (v) { return v.slice(); }); });
      var flat = plan.length > 0 && plan.every(function (p) { return p.crease || (!p.sel && Math.abs(Math.abs(p.ang) - Math.PI) < 1e-6); });
      if (flat) renormalize(state.polys, state.axes);
    });
    var final = state.polys.map(function (q) { return { cur: q.cur.map(function (v) { return v.slice(); }), orig: q.orig, edges: q.edges, tag: q.tag }; });
    return { frames: frames, final: final };
  }

  function poseOn(polys, startCur, plan, t) {
    return polys.map(function (q, i) {
      var pts = startCur[i];
      plan.forEach(function (p) {
        if (p.set.indexOf(q) < 0) return;
        var ang = p.crease ? p.ang * Math.sin(Math.PI * Math.min(1, t)) * 0.92 : p.ang * t;
        pts = pts.map(function (v) { return rotatePoint(v, p.ax, ang); });
      });
      return pts;
    });
  }

  // 面積加權重心（每一層紙都算）
  function centerOfMass(polys, getPts) {
    var sx = 0, sy = 0, sz = 0, sa = 0;
    polys.forEach(function (q, idx) {
      var pts = getPts ? getPts(q, idx) : q.cur;
      for (var i = 1; i < pts.length - 1; i++) {
        var a = pts[0], b = pts[i], c = pts[i + 1];
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        var cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
        var area = Math.hypot(cx, cy, cz) / 2;
        sx += area * (a[0] + b[0] + c[0]) / 3; sy += area * (a[1] + b[1] + c[1]) / 3; sz += area * (a[2] + b[2] + c[2]) / 3; sa += area;
      }
    });
    return [sx / sa, sy / sa, sz / sa];
  }

  return { build: build, poseOn: poseOn, centerOfMass: centerOfMass, W: W, H: H };
})();
if (typeof module !== 'undefined') module.exports = FoldEngine;
