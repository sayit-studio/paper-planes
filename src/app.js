(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const C = Content;
  const PLANES = PlaneSpecs.list.map((s) => s.id);
  const VIS = 3; // 飛行畫面的飛機放大倍數
  const ALPHA = PlaneSpecs.ALPHA * Math.PI / 180;
  const ANGLES = [-15, 0, 10, 25, 40];
  const DEFAULT_KNOBS = { power: 3, angle: 0, clips: 0, tail: 0, asym: 0 };
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 狀態 ----------
  const state = {
    tab: 'fold', plane: 'dart', step: 0, t: 1,
    knobs: Object.assign({}, DEFAULT_KNOBS),
    arrows: false, chase: false, slow: false,
    mission: null, ghosts: [], last: null, done: loadDone(), best: loadBest(), speed: 1, bestNote: ''
  };
  function loadBest() { try { return JSON.parse(localStorage.getItem('ppl-best') || '{}'); } catch (e) { return {}; } }
  function saveBest() { try { localStorage.setItem('ppl-best', JSON.stringify(state.best)); } catch (e) { /* 不能存也沒關係 */ } }
  function loadDone() { try { return JSON.parse(localStorage.getItem('ppl-done') || '[]'); } catch (e) { return []; } }
  function saveDone() { try { localStorage.setItem('ppl-done', JSON.stringify(state.done)); } catch (e) { /* 不能存也沒關係 */ } }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 先把四種飛機都摺好 ----------
  const built = {};
  PlaneSpecs.list.forEach((spec) => {
    const r = FoldEngine.build(spec);
    const openStep = spec.steps.find((s) => s.open);
    const sign = openStep.halfDir === 'valley' ? 1 : -1;
    const f = new THREE.Vector3(0, 1, 0);
    const U = new THREE.Vector3(Math.cos(ALPHA), 0, sign * Math.sin(ALPHA));
    const s = new THREE.Vector3().crossVectors(f, U);
    const cg = FoldEngine.centerOfMass(r.final);
    // 摺紙座標 → 飛機座標（X 往前、Y 往上、Z 往右）
    const basis = new THREE.Matrix4().makeBasis(f, U, s);
    const toLocal = basis.clone().transpose();
    built[spec.id] = { spec: spec, frames: r.frames, final: r.final, cg: cg, toLocal: toLocal, basis: basis };
    built[spec.id].anchors = anchors(built[spec.id]);
  });
  // 部位標籤的位置（摺紙座標）：nose 機頭、wing 左翅膀中間、tip 右翼尖最高點、tail 右翅膀後緣、cg 重心
  function anchors(b) {
    const vs = []; b.final.forEach((q) => q.cur.forEach((v) => vs.push(v)));
    const L = vs.map((v) => new THREE.Vector3(v[0] - b.cg[0], v[1] - b.cg[1], v[2] - b.cg[2]).applyMatrix4(b.toLocal));
    let zmax = 1; L.forEach((p) => { zmax = Math.max(zmax, Math.abs(p.z)); });
    const pick = (ok, score) => { let bi = -1, bs = -Infinity; L.forEach((p, i) => { if (ok(p)) { const sc = score(p); if (sc > bs) { bs = sc; bi = i; } } }); return bi < 0 ? b.cg : vs[bi]; };
    const mean = (ok) => { const m = [0, 0, 0]; let n = 0; L.forEach((p, i) => { if (ok(p)) { m[0] += vs[i][0]; m[1] += vs[i][1]; m[2] += vs[i][2]; n++; } }); return n ? m.map((x) => x / n) : b.cg; };
    // 翅膀：左邊那些多邊形的面積加權中心（不被機頭附近的小碎片拉走）
    const wingC = () => {
      const m = [0, 0, 0]; let A = 0;
      b.final.forEach((q) => {
        const c = q.cur; let qa = 0; const qc = [0, 0, 0];
        for (let i = 1; i < c.length - 1; i++) {
          const u = new THREE.Vector3(c[i][0] - c[0][0], c[i][1] - c[0][1], c[i][2] - c[0][2]), w = new THREE.Vector3(c[i + 1][0] - c[0][0], c[i + 1][1] - c[0][1], c[i + 1][2] - c[0][2]);
          const a = u.cross(w).length() / 2; qa += a;
          for (let k = 0; k < 3; k++) qc[k] += a * (c[0][k] + c[i][k] + c[i + 1][k]) / 3;
        }
        if (!qa) return;
        const lc = new THREE.Vector3(qc[0] / qa - b.cg[0], qc[1] / qa - b.cg[1], qc[2] / qa - b.cg[2]).applyMatrix4(b.toLocal);
        if (lc.z < -0.4 * zmax && Math.abs(lc.y) < 0.3 * zmax) { A += qa; for (let k = 0; k < 3; k++) m[k] += qc[k]; }
      });
      return A ? m.map((x) => x / A) : b.cg;
    };
    let ytop = -Infinity; L.forEach((p) => { if (p.z > 0.6 * zmax) ytop = Math.max(ytop, p.y); });
    // 手捏的位置：機身（龍骨）下方、重心稍前
    let ykeel = 0; L.forEach((p) => { if (Math.abs(p.z) < 0.15 * zmax && Math.abs(p.x - 15) < 80) ykeel = Math.min(ykeel, p.y); });
    const gripL = new THREE.Vector3(15, ykeel * 0.7, 0).applyMatrix4(b.basis);
    const grip = [b.cg[0] + gripL.x, b.cg[1] + gripL.y, b.cg[2] + gripL.z];
    return {
      nose: pick(() => true, (p) => p.x),
      wing: wingC(),
      tip: mean((p) => p.z > 0.6 * zmax && p.y > ytop - 4),
      tail: pick((p) => p.z > 0.35 * zmax && p.z < 0.9 * zmax, (p) => -p.x + p.y * 0.5),
      cg: b.cg, grip: grip
    };
  }

  // ---------- 小圖示：從摺好的飛機正上方看下去 ----------
  function drawIcon(cv, id, w, h) {
    const b = built[id], dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = w || 44; h = h || 32; cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const pts = b.final.map((q) => q.cur.map((v) => {
      const p = new THREE.Vector3(v[0] - b.cg[0], v[1] - b.cg[1], v[2] - b.cg[2]).applyMatrix4(b.toLocal);
      return [p.x, p.z];
    }));
    let mx = 1; pts.forEach((pp) => pp.forEach((p) => { mx = Math.max(mx, Math.abs(p[0]) * 0.72, Math.abs(p[1])); }));
    const sc = (h / 2 - 2) / mx;
    ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = C.planes[id].color; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.6;
    pts.forEach((pp) => { ctx.beginPath(); pp.forEach((p, i) => { const x = p[1] * sc, y = p[0] * sc * 0.72; i ? ctx.lineTo(y, x) : ctx.moveTo(y, x); }); ctx.closePath(); ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); });
  }

  // ---------- three.js ----------
  const canvas = $('#gl'), stage = $('#stage');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // 共用：把多邊形畫成正面、背面兩種顏色的紙
  function makePaper(maxVerts) {
    const mk = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3));
      return g;
    };
    const gF = mk(), gB = mk();
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxVerts * 4 * 3), 3));
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxVerts * 4 * 3), 3));
    const matF = new THREE.MeshLambertMaterial({ color: 0x5aa8e0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const matB = new THREE.MeshLambertMaterial({ color: 0xfbf8ef, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(gF, matF), new THREE.Mesh(gB, matB));
    const edge = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x17324d, transparent: true, opacity: 0.75 }));
    const crease = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x17324d, transparent: true, opacity: 0.28 }));
    group.add(edge, crease);
    function update(polys, ptsList, xf) {
      const pF = gF.attributes.position.array, nF = gF.attributes.normal.array;
      const pB = gB.attributes.position.array, nB = gB.attributes.normal.array;
      const pl = lg.attributes.position.array, pc = cg.attributes.position.array;
      let iv = 0, il = 0, ic = 0;
      const tmp = new THREE.Vector3();
      const P = (v) => { tmp.set(v[0], v[1], v[2]); if (xf) xf(tmp); return [tmp.x, tmp.y, tmp.z]; };
      polys.forEach((q, qi) => {
        const pts = ptsList[qi].map(P);
        for (let i = 1; i < pts.length - 1; i++) {
          const a = pts[0], b = pts[i], c = pts[i + 1];
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          [a, b, c].forEach((p, k) => { pF.set(p, (iv + k) * 3); nF.set([nx, ny, nz], (iv + k) * 3); });
          [a, c, b].forEach((p, k) => { pB.set(p, (iv + k) * 3); nB.set([-nx, -ny, -nz], (iv + k) * 3); });
          iv += 3;
        }
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if (q.edges[i] === 'b') { pl.set(a, il * 3); pl.set(b, il * 3 + 3); il += 2; } else { pc.set(a, ic * 3); pc.set(b, ic * 3 + 3); ic += 2; }
        }
      });
      [gF, gB].forEach((g) => { g.setDrawRange(0, iv); g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.computeBoundingSphere(); });
      lg.setDrawRange(0, il); lg.attributes.position.needsUpdate = true; lg.computeBoundingSphere();
      cg.setDrawRange(0, ic); cg.attributes.position.needsUpdate = true; cg.computeBoundingSphere();
    }
    return { group, update, matF, edge };
  }

  // ===== 摺紙場景（單位 mm）=====
  const foldScene = new THREE.Scene();
  const foldCam = new THREE.PerspectiveCamera(35, 1, 5, 6000);
  foldCam.up.set(0, 0, 1);
  foldScene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a3, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-250, -320, 700); foldScene.add(sun);
  const viewRoot = new THREE.Group(), orientNode = new THREE.Group(), offsetNode = new THREE.Group();
  foldScene.add(viewRoot); viewRoot.add(orientNode); orientNode.add(offsetNode);
  const foldPaper = makePaper(4000);
  offsetNode.add(foldPaper.group);
  const cgDot = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 14), new THREE.MeshBasicMaterial({ color: 0xe0362c }));
  offsetNode.add(cgDot);
  // 切割墊（1 公分格線），讓小朋友感覺紙放在桌上
  const matCanvas = document.createElement('canvas'); matCanvas.width = matCanvas.height = 512;
  const matTex = new THREE.CanvasTexture(matCanvas);
  const cutMat = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), new THREE.MeshBasicMaterial({ map: matTex, transparent: true }));
  cutMat.position.z = -1.5; viewRoot.add(cutMat);
  function paintMat() {
    const ctx = matCanvas.getContext('2d'), dark = isDark();
    ctx.fillStyle = dark ? '#1c3a33' : '#2f7a63'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i <= 46; i++) {
      const p = i * 512 / 46; ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,.38)' : 'rgba(255,255,255,.14)'; ctx.lineWidth = i % 5 === 0 ? 1.4 : 0.8;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(512, p); ctx.stroke();
    }
    matTex.needsUpdate = true;
  }
  const userRot = { yaw: 0, pitch: 0 };

  function finalQuat() {
    const b = built[state.plane];
    const F = new THREE.Vector3(1, -0.45, 0).normalize(), Z = new THREE.Vector3(0, 0, 1);
    const S = new THREE.Vector3().crossVectors(F, Z);
    const world = new THREE.Matrix4().makeBasis(F, Z, S);
    const m = new THREE.Matrix4().multiplyMatrices(world, b.toLocal);
    // 讓機頭稍微往上看一點
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0.45, 0).normalize(), -0.25);
    return new THREE.Quaternion().setFromRotationMatrix(m).premultiply(tilt);
  }
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function renderFold() {
    const b = built[state.plane], frame = b.frames[state.step];
    const t = ease(Math.max(0, Math.min(1, state.t)));
    const pts = FoldEngine.poseOn(frame.polys, frame.start, frame.plan, t);
    foldPaper.update(frame.polys, pts);
    // 中心
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    pts.forEach((pp) => pp.forEach((v) => { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }));
    const isOpen = !!frame.step.open;
    const center = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, isOpen ? (lo[2] + hi[2]) / 2 : 0];
    const target = isOpen ? b.cg : center;
    const k = isOpen ? t : 0;
    offsetNode.position.set(-(center[0] * (1 - k) + target[0] * k), -(center[1] * (1 - k) + target[1] * k), -(center[2] * (1 - k) + target[2] * k));
    const q0 = new THREE.Quaternion();
    orientNode.quaternion.copy(isOpen ? q0.clone().slerp(finalQuat(), t) : q0);
    cutMat.material.opacity = isOpen ? 1 - t : 1;
    cutMat.visible = cutMat.material.opacity > 0.01;
    cgDot.visible = isOpen && state.t >= 1;
    cgDot.position.set(b.cg[0], b.cg[1], b.cg[2]);
    viewRoot.rotation.set(userRot.pitch, 0, userRot.yaw);
    const n = b.frames.length;
    $('#prog i').style.width = (n > 1 ? Math.max(0, (state.step - 1 + Math.min(1, state.t)) / (n - 1)) * 100 : 0) + '%';
  }

  // ===== 飛行場景（單位 m）=====
  const flyScene = new THREE.Scene();
  const flyCam = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
  flyScene.add(new THREE.HemisphereLight(0xffffff, 0x6f8f55, 0.8));
  const sun2 = new THREE.DirectionalLight(0xffffff, 0.6); sun2.position.set(-6, 12, 8); flyScene.add(sun2);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), new THREE.MeshLambertMaterial({ color: 0x8cc46a }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(20, 0, 0); flyScene.add(ground);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(26, 8.4), new THREE.MeshLambertMaterial({ color: 0xa6d385 }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(12, 0.004, 0); flyScene.add(lane);
  function label(text, opts) {
    opts = opts || {};
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = 256; cv.height = 96;
    ctx.font = '700 52px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (opts.bg) { ctx.fillStyle = opts.bg; const w = Math.min(250, ctx.measureText(text).width + 36); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(128 - w / 2, 14, w, 68, 34) : ctx.rect(128 - w / 2, 14, w, 68); ctx.fill(); }
    ctx.lineWidth = 8; ctx.strokeStyle = opts.stroke || 'rgba(30,60,30,.55)'; ctx.strokeText(text, 128, 50);
    ctx.fillStyle = opts.color || '#ffffff'; ctx.fillText(text, 128, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false }));
    sp.scale.set(opts.size || 0.9, (opts.size || 0.9) * 96 / 256, 1);
    return sp;
  }
  for (let d = 1; d <= 24; d++) {
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(d % 5 === 0 ? 0.06 : 0.03, 8.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: d % 5 === 0 ? 0.95 : 0.6 }));
    ln.rotation.x = -Math.PI / 2; ln.position.set(d, 0.008, 0); flyScene.add(ln);
    const lb = label(d % 5 === 0 ? d + ' 公尺' : String(d), { size: d % 5 === 0 ? 1.1 : 0.7 });
    lb.position.set(d, 0.2, -4.6); flyScene.add(lb);
  }
  // 丟飛機的小朋友
  const kid = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xf3b63f }), skin = new THREE.MeshLambertMaterial({ color: 0xf1c7a1 }), pants = new THREE.MeshLambertMaterial({ color: 0x35587a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 16), shirt); body.position.y = 0.88; kid.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), skin); head.position.y = 1.32; kid.add(head);
  [-0.08, 0.08].forEach((z) => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 10), pants); leg.position.set(0, 0.31, z); kid.add(leg); });
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.48, 10), shirt); arm.position.set(0.18, 1.12, 0.12); arm.rotation.z = -1.25; kid.add(arm);
  kid.position.set(-0.32, 0, -0.1); flyScene.add(kid);
  // 小島（任務用）
  const island = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshLambertMaterial({ color: 0x4aa6d8 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.01; island.add(water);
  const sand = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshLambertMaterial({ color: 0xf0d98e }));
  sand.rotation.x = -Math.PI / 2; sand.position.y = 0.02; island.add(sand);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8), new THREE.MeshLambertMaterial({ color: 0x6b4a2a })); pole.position.y = 0.3; island.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshLambertMaterial({ color: 0xe0362c, side: THREE.DoubleSide })); flag.position.set(0.14, 0.5, 0); island.add(flag);
  island.visible = false; flyScene.add(island);
  // 飛機
  const flyPaper = makePaper(4000);
  const planeNode = new THREE.Group(); planeNode.add(flyPaper.group); flyScene.add(planeNode);
  const flyCg = new THREE.Mesh(new THREE.SphereGeometry(0.012 * VIS, 14, 10), new THREE.MeshBasicMaterial({ color: 0xe0362c }));
  planeNode.add(flyCg);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ color: 0x1f3a1a, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; flyScene.add(shadow);
  function buildPlaneInto(paper, id) {
    const b = built[id];
    const sc = 0.001 * VIS;
    paper.update(b.final, b.final.map((q) => q.cur), (v) => { v.set(v.x - b.cg[0], v.y - b.cg[1], v.z - b.cg[2]).applyMatrix4(b.toLocal).multiplyScalar(sc); });
  }
  function buildFlyPlane() { buildPlaneInto(flyPaper, state.plane); }
  // 軌跡
  const MAXP = 1700;
  function makeTrail(color, opacity) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3)); g.setDrawRange(0, 0);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity }));
    line.frustumCulled = false; flyScene.add(line); return line;
  }
  function fillTrail(line, pts, n) {
    const a = line.geometry.attributes.position.array;
    for (let i = 0; i < Math.min(n, MAXP); i++) { a[i * 3] = pts[i].x; a[i * 3 + 1] = pts[i].y; a[i * 3 + 2] = pts[i].z; }
    line.geometry.setDrawRange(0, Math.min(n, MAXP)); line.geometry.attributes.position.needsUpdate = true;
  }
  const trail = makeTrail(0xe0362c, 1);
  const ghostLines = [makeTrail(0x17324d, 0.35), makeTrail(0x17324d, 0.22), makeTrail(0x17324d, 0.12)];
  const landMark = new THREE.Group();
  const lmPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 8), new THREE.MeshLambertMaterial({ color: 0x17324d })); lmPole.position.y = 0.22; landMark.add(lmPole);
  let lmLabel = null; landMark.visible = false; flyScene.add(landMark);
  const LANES = { dart: -2.7, glider: -0.9, lock: 0.9, stunt: 2.7 };
  const racers = {};
  PLANES.forEach((id) => {
    const paper = makePaper(4000); paper.matF.color.set(C.planes[id].color);
    const node = new THREE.Group(); node.add(paper.group); flyScene.add(node);
    const tr = makeTrail(new THREE.Color(C.planes[id].color).getHex(), 1); tr.position.z = LANES[id];
    const sh = new THREE.Mesh(shadow.geometry, shadow.material.clone()); sh.rotation.x = -Math.PI / 2; flyScene.add(sh);
    const mark = new THREE.Group();
    const pl = new THREE.Mesh(lmPole.geometry, new THREE.MeshLambertMaterial({ color: C.planes[id].color })); pl.position.y = 0.22; mark.add(pl);
    flyScene.add(mark);
    racers[id] = { id: id, node: node, trail: tr, shadow: sh, mark: mark, label: null };
    buildPlaneInto(paper, id);
    node.visible = sh.visible = tr.visible = mark.visible = false;
  });
  // 力的箭頭
  const arrowDefs = { lift: '--lift', weight: '--weight', thrust: '--thrust', drag: '--drag' };
  const arrows = {};
  Object.keys(arrowDefs).forEach((k) => { const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0xffffff, 0.16, 0.1); a.visible = false; flyScene.add(a); arrows[k] = a; });
  function colorArrows() { Object.keys(arrowDefs).forEach((k) => arrows[k].setColor(new THREE.Color(css(arrowDefs[k]) || '#888'))); }

  function isDark() { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
  function applyTheme() {
    const dark = isDark();
    foldScene.background = new THREE.Color(css('--stage') || '#dfeaf2');
    flyScene.background = new THREE.Color(dark ? 0x2b4a68 : 0xbfe0f5);
    flyScene.fog = new THREE.Fog(dark ? 0x2b4a68 : 0xbfe0f5, 18, 60);
    ground.material.color.set(dark ? 0x5f8a4a : 0x8cc46a);
    lane.material.color.set(dark ? 0x6c9a55 : 0xa6d385);
    paintMat(); colorArrows(); needRender = true;
  }

  // ---------- 飛行播放 ----------
  let flight = null; // { res, start, idx, done }
  const camPos = new THREE.Vector3(3, 1.6, 7.5), camLook = new THREE.Vector3(3, 0.9, 0);
  function placeObj(node, sh, s, dz) {
    node.position.set(s.x, s.y, s.z + dz);
    node.rotation.set(s.phi, -s.psi, s.th, 'YZX');
    sh.position.set(s.x, 0.012, s.z + dz);
    sh.material.opacity = Math.max(0.05, 0.3 - s.y * 0.06);
  }
  function placePlane(s) { placeObj(planeNode, shadow, s, 0); }
  function idlePlane() {
    const g0 = state.knobs.angle * Math.PI / 180;
    placePlane({ x: 0.05, y: 1.3, z: 0, th: g0, psi: 0, phi: 0 });
  }
  function velDir(s) { return new THREE.Vector3(Math.cos(s.gam) * Math.cos(s.psi), Math.sin(s.gam), Math.cos(s.gam) * Math.sin(s.psi)); }
  function updateArrows(s, show) {
    Object.keys(arrows).forEach((k) => { arrows[k].visible = false; });
    if (!show || !s) return;
    const pos = new THREE.Vector3(s.x, s.y, s.z), v = velDir(s);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(planeNode.quaternion);
    const liftDir = up.clone().sub(v.clone().multiplyScalar(up.dot(v))).normalize();
    const len = (F) => Math.max(0.2, Math.min(2.6, F / s.W * 1.1));
    const set = (k, dir, L) => { const a = arrows[k]; a.position.copy(pos); a.setDirection(dir); a.setLength(L, Math.min(0.26, L * 0.45), Math.min(0.16, L * 0.3)); a.visible = true; };
    set('weight', new THREE.Vector3(0, -1, 0), len(s.W));
    if (s.L > 0.0005) set('lift', s.L >= 0 ? liftDir : liftDir.clone().negate(), len(Math.abs(s.L)));
    if (s.D > 0.0005) set('drag', v.clone().negate(), len(s.D));
    if (s.t < 0.3) set('thrust', v, 1.6 * (1 - s.t / 0.3) + 0.2);
  }
  function throwPlane() {
    if (state.tab !== 'fly') switchTab('fly');
    hideRace(); showSingle(true);
    const res = Flight.simulate(state.plane, state.knobs);
    if (state.last) {
      state.ghosts.unshift(state.last.res.pts);
      state.ghosts = state.ghosts.slice(0, 3);
    }
    ghostLines.forEach((g, i) => { const p = state.ghosts[i]; if (p) fillTrail(g, p, p.length); else g.geometry.setDrawRange(0, 0); });
    flight = { res: res, start: performance.now(), idx: 0, done: false, knobs: Object.assign({}, state.knobs), plane: state.plane };
    state.last = flight;
    landMark.visible = false;
    $('#result').innerHTML = '<p class="note">飛行中…</p>';
    setBusy(true);
    needRender = true;
  }
  function setBusy(b) { ['#throwBtn', '#raceBtn', '#bestBtn'].forEach((id) => { $(id).disabled = b; }); }
  function showSingle(show) {
    planeNode.visible = shadow.visible = trail.visible = show;
    ghostLines.forEach((g) => { g.visible = show; });
    if (!show) { landMark.visible = false; updateArrows(null, false); }
  }
  function hideRace() {
    race = null;
    PLANES.forEach((id) => { const r = racers[id]; r.node.visible = r.shadow.visible = r.trail.visible = r.mark.visible = false; });
  }

  // ---------- 比賽：四架一起丟 ----------
  let race = null;
  function startRace() {
    if (state.tab !== 'fly') switchTab('fly');
    const knobs = Object.assign({}, state.knobs, { asym: 0 });
    flight = null; showSingle(false);
    race = { knobs: knobs, start: performance.now(), done: false, list: PLANES.map((id) => ({ id: id, res: Flight.simulate(id, knobs), idx: 0, landed: false })) };
    PLANES.forEach((id) => {
      const r = racers[id]; r.node.visible = r.shadow.visible = r.trail.visible = true; r.mark.visible = false;
      r.trail.geometry.setDrawRange(0, 0);
    });
    $('#result').innerHTML = '<p class="note">比賽中…</p>';
    setBusy(true); needRender = true;
  }
  function stepRace(now) {
    if (!race || race.done) return;
    const tt = (now - race.start) / 1000 * (state.slow ? 0.35 : 1);
    let all = true, lead = null;
    race.list.forEach((e) => {
      const pts = e.res.pts, R = racers[e.id];
      let i = e.idx; while (i < pts.length - 1 && pts[i + 1].t <= tt) i++;
      e.idx = i;
      const s = pts[i];
      placeObj(R.node, R.shadow, s, LANES[e.id]); fillTrail(R.trail, pts, i + 1);
      if (i >= pts.length - 1) {
        if (!e.landed) {
          e.landed = true;
          R.mark.position.set(s.x, 0, s.z + LANES[e.id]); R.mark.visible = true;
          if (R.label) R.mark.remove(R.label);
          R.label = label(e.res.dist.toFixed(1), { size: 0.75, bg: C.planes[e.id].color, color: '#ffffff', stroke: 'rgba(0,0,0,0)' });
          R.label.position.y = 0.6; R.mark.add(R.label);
        }
      } else all = false;
      if (!lead || s.x > lead.x) lead = { x: s.x, id: e.id };
    });
    race.lead = lead;
    if (state.tab !== 'fold') $('#ovTL').innerHTML = '<span class="pill">領先：' + C.planes[lead.id].name + '　' + lead.x.toFixed(1) + ' 公尺</span>';
    if (all) finishRace();
  }
  function finishRace() {
    race.done = true;
    setBusy(false);
    const rank = race.list.slice().sort((a, b) => b.res.dist - a.res.dist);
    rank.forEach((e) => updateBest(e.id, e.res.dist, race.knobs));
    const win = rank[0].id, max = rank[0].res.dist;
    $('#ovTL').innerHTML = '<span class="pill">第一名：' + C.planes[win].name + '</span>';
    const why = C.raceWhy[win];
    $('#result').innerHTML = '<div class="result paper tape" style="--pc:' + C.planes[win].color + '" aria-live="polite"><div class="eyebrow">大家都用：' + knobText(race.knobs) + '</div>' +
      rankList(rank.map((e) => ({ id: e.id, dist: e.res.dist })), max) +
      '<p class="kid" style="font-size:22px">' + esc(why.kid) + '</p>' + adultBox(why.adult, why.src) +
      '<p>換個力氣再比，冠軍可能會換人喔！</p></div>';
  }
  function rankList(rows, max) {
    return '<ol class="rank">' + rows.map((r, i) => '<li data-id="' + r.id + '" style="--pc:' + C.planes[r.id].color + '"><span class="pos">' + (i + 1) + '</span><span class="nm">' + C.planes[r.id].name + '</span><span class="bar"><i style="width:' + (r.dist ? Math.max(4, r.dist / max * 100) : 0) + '%"></i></span><span class="d">' + (r.dist ? r.dist.toFixed(1) + ' 公尺' : '還沒飛') + '</span></li>').join('') + '</ol>';
  }
  function knobText(k) {
    const f = (key) => { const kn = KNOBS.find((x) => x.key === key); const o = kn.opts.find((x) => x[0] === k[key]); return o ? o[1].replace(/<svg[\s\S]*?<\/svg>/, '') : ''; };
    return '力氣「' + f('power') + '」、方向「' + f('angle') + '」、迴紋針「' + f('clips') + '」、尾巴「' + f('tail') + '」';
  }
  function updateBest(id, dist, knobs) {
    const cur = state.best[id];
    if (!cur || dist > cur.dist) { state.best[id] = { dist: dist, knobs: Object.assign({}, knobs, { asym: 0 }) }; saveBest(); }
    renderBest();
  }
  function renderBest() {
    const rows = PLANES.map((id) => ({ id: id, dist: state.best[id] ? state.best[id].dist : 0 })).sort((a, b) => b.dist - a.dist);
    const max = Math.max(1, rows[0].dist);
    $('#bestBoard').innerHTML = '<div class="board paper"><h2>最遠紀錄</h2><p class="note">點一下，照那次再丟一次。</p>' +
      rankList(rows, max).replace(/<li /g, '<li role="button" tabindex="0" ') + (rows[0].dist ? '<div><button class="mini" id="bestReset">清除紀錄</button></div>' : '') + '</div>';
    const rb = $('#bestReset'); if (rb) rb.addEventListener('click', (e) => { e.stopPropagation(); state.best = {}; saveBest(); renderBest(); });
  }
  function stepFlight(now) {
    if (!flight || flight.done) return;
    const pts = flight.res.pts, speed = state.slow ? 0.35 : 1;
    const tt = (now - flight.start) / 1000 * speed;
    let i = flight.idx; while (i < pts.length - 1 && pts[i + 1].t <= tt) i++;
    flight.idx = i;
    const s = pts[i];
    placePlane(s); fillTrail(trail, pts, i + 1);
    updateArrows(s, state.arrows);
    setStats(s.x === undefined ? 0 : Math.hypot(s.x, s.z), s.t, false);
    if (i >= pts.length - 1) finishFlight();
  }
  function finishFlight() {
    flight.done = true;
    const res = flight.res, last = res.pts[res.pts.length - 1];
    updateArrows(null, false);
    landMark.position.set(last.x, 0, last.z); landMark.visible = true;
    if (lmLabel) landMark.remove(lmLabel);
    lmLabel = label(res.dist.toFixed(1) + ' 公尺', { size: 1.0, bg: 'rgba(255,255,255,.92)', color: '#16314a', stroke: 'rgba(255,255,255,0)' });
    lmLabel.position.y = 0.62; landMark.add(lmLabel);
    setBusy(false);
    setStats(res.dist, res.time, true);
    updateBest(flight.plane, res.dist, flight.knobs);
    showResult(res);
  }
  function updateFlyCamera(dt) {
    let want, look;
    const k = 1 - Math.pow(0.02, dt);
    if (race) {
      const xs = race.list.map((e) => e.res.pts[e.idx].x), ys = race.list.map((e) => e.res.pts[e.idx].y);
      if (!race.done) {
        const lx = Math.max(1.6, ...xs), my = Math.max(...ys);
        want = new THREE.Vector3(lx - 0.6, Math.max(2.6, my * 0.6 + 2), 9.5); look = new THREE.Vector3(lx + 0.6, Math.max(0.6, my * 0.6), 0);
      } else {
        const maxX = Math.max(...race.list.map((e) => e.res.dist)), minX = -0.6;
        const hfov = 2 * Math.atan(Math.tan(flyCam.fov * Math.PI / 360) * flyCam.aspect);
        const span = Math.max(7, (maxX - minX + 2.6) / (2 * Math.tan(hfov / 2)));
        want = new THREE.Vector3((minX + maxX) / 2 + 0.3, Math.max(3.2, span * 0.45), 3.2 + span); look = new THREE.Vector3((minX + maxX) / 2 + 0.3, 0.6, 0);
      }
    } else if (flight && !flight.done) {
      const s = flight.res.pts[flight.idx];
      if (state.chase) {
        const v = velDir(s); v.y *= 0.5; v.normalize();
        want = new THREE.Vector3(s.x, s.y, s.z).addScaledVector(v, -2.6).add(new THREE.Vector3(0, 0.9, 0));
        look = new THREE.Vector3(s.x, s.y, s.z).addScaledVector(v, 2);
      } else {
        const cx = Math.max(1.6, s.x);
        want = new THREE.Vector3(cx + 0.4, Math.max(1.5, s.y * 0.6 + 1.4), s.z + 4.4);
        look = new THREE.Vector3(cx + 0.9, Math.max(0.5, s.y * 0.85), s.z);
      }
    } else if (flight && flight.done) {
      const r = flight.res, last = r.pts[r.pts.length - 1];
      const mx = Math.max(...r.pts.map((p) => p.y));
      const minX = Math.min(-0.6, ...r.pts.map((p) => p.x)), maxX = Math.max(...r.pts.map((p) => p.x));
      const midX = (minX + maxX) / 2 + 0.35, midZ = last.z / 2;
      // 讓整條軌跡（含小朋友）都放得進畫面
      const hfov = 2 * Math.atan(Math.tan(flyCam.fov * Math.PI / 360) * flyCam.aspect);
      const span = Math.max(4.5, (maxX - minX + 2.6) / (2 * Math.tan(hfov / 2)), mx * 1.8) + Math.max(0, last.z);
      want = new THREE.Vector3(midX, Math.max(2.4, mx * 0.7 + 1.5), midZ + span);
      look = new THREE.Vector3(midX, Math.min(mx, 3) * 0.4 + 0.2, midZ);
    } else {
      const ix = state.mission && state.mission.island ? state.mission.island.x : 6;
      want = new THREE.Vector3(ix / 2 - 0.4, 2.1, 5.6); look = new THREE.Vector3(ix / 2 - 0.2, 0.7, 0);
    }
    camPos.lerp(want, k); camLook.lerp(look, k);
    flyCam.position.copy(camPos); flyCam.lookAt(camLook);
  }

  // ---------- 畫面 ----------
  let needRender = true, lastNow = performance.now(), anim = null;
  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    [foldCam, flyCam].forEach((c) => { c.aspect = r.width / Math.max(1, r.height); c.updateProjectionMatrix(); });
    const fit = Math.max(1, 0.78 / Math.min(foldCam.aspect, 0.78)) * Math.max(1, 1 / foldCam.aspect * 0.9);
    const D = 560 * Math.min(1.8, Math.max(1, 0.85 / foldCam.aspect));
    foldCam.position.set(0, -0.52 * D, 0.85 * D); foldCam.lookAt(0, 0, 0);
    void fit; needRender = true;
  }
  new ResizeObserver(resize).observe(stage);

  function loop(now) {
    const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    if (anim) {
      const p = Math.min(1, (now - anim.start) / anim.dur);
      state.t = anim.from + (anim.to - anim.from) * p;
      if (p >= 1) { const cb = anim.done; anim = null; if (cb) cb(); }
      needRender = true;
    }
    if (state.tab === 'fold' && spin && !dragging) { userRot.yaw += dt * 0.45; needRender = true; }
    if (state.tab === 'fold') {
      if (needRender) { renderFold(); renderer.render(foldScene, foldCam); updateParts(); needRender = false; }
    } else {
      stepFlight(now); stepRace(now);
      updateFlyCamera(dt);
      renderer.render(flyScene, flyCam);
    }
    requestAnimationFrame(loop);
  }

  // 拖曳轉動摺紙模型
  let spin = false, dragging = false;
  (function () {
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { if (state.tab !== 'fold') return; spin = false; closePart(); dragging = true; drag = { x: e.clientX, y: e.clientY, yaw: userRot.yaw, pitch: userRot.pitch }; canvas.setPointerCapture(e.pointerId); hideHint(); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      userRot.yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
      userRot.pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.008));
      needRender = true;
    });
    const end = () => { drag = null; dragging = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  })();
  let hintShown = true;
  function hideHint() { if (hintShown) { hintShown = false; const h = $('#dragHint'); if (h) h.remove(); } }

  // ---------- 出處面板 ----------
  function srcChip(keys) {
    if (!keys || !keys.length) return '';
    return '<button class="src" data-src="' + keys.join(',') + '" aria-label="查看出處"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 2h8v8H2z"/><path d="M4 5h4M4 7h3"/></svg>出處</button>';
  }
  // 給大人的說明：可收合；打開一個，其他的也一起打開（記住大人想看）
  let adultOpen = false;
  const bookIcon = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5c2.5-1 5-1 7 .5 2-1.5 4.5-1.5 7-.5v11c-2.5-1-5-1-7 .5-2-1.5-4.5-1.5-7-.5z"/><path d="M10 5v11"/></svg>';
  function adultBox(text, src, label) {
    return '<details class="adult"' + (adultOpen ? ' open' : '') + '><summary>' + bookIcon + esc(label || '給大人') + '</summary><div class="body"><p>' + esc(text) + srcChip(src) + '</p></div></details>';
  }
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.classList || !d.classList.contains('adult') || d.open === adultOpen) return;
    adultOpen = d.open;
    document.querySelectorAll('details.adult').forEach((x) => { if (x !== d) x.open = adultOpen; });
  }, true);
  let sheetCur = null, sheetPrevFn = null;
  function openSheet(title, html, prev) {
    $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html;
    sheetPrevFn = prev || null; $('#sheetPrev').hidden = !prev;
    $('#sheet').hidden = false; $('#sheetBack').hidden = false; $('#sheet').scrollTop = 0; $('#sheetClose').focus();
  }
  function openSources(keys) {
    const seen = new Set(), items = [];
    keys.forEach((k) => (C.sources[k] || []).forEach((s) => { if (!seen.has(s.u + s.n)) { seen.add(s.u + s.n); items.push(s); } }));
    const prev = !$('#sheet').hidden && sheetCur ? sheetCur : null;
    sheetCur = null;
    openSheet('出處', '<ol>' + items.map((s) => '<li><b>' + esc(s.t) + '</b><div class="pub">' + esc(s.p) + '</div><p>' + esc(s.n) + '</p><a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.u) + '</a></li>').join('') + '</ol>', prev);
  }
  function openStory(id) {
    const p = C.planes[id];
    sheetCur = () => openStory(id);
    openSheet(p.name + '的故事', '<div class="story" style="--pc:' + p.color + '"><p class="lead">' + esc(p.story) + '</p>' +
      '<div class="box paper tape"><h4>絕招</h4><b>' + esc(p.move.name) + '</b><p>' + esc(p.move.kid) + '</p></div>' +
      '<div class="box paper"><h4>' + esc(p.real.title) + '</h4><p>' + esc(p.real.kid) + srcChip(p.real.src) + '</p></div>' +
      adultBox(p.move.adult, p.move.src, '給大人：背後的物理') +
      '<p class="note">能力星星是依這個模擬的結果和摺紙步驟多寡給的大概值。</p></div>');
  }
  function closeSources() { $('#sheet').hidden = true; $('#sheetBack').hidden = true; sheetCur = null; }
  document.addEventListener('click', (e) => { const b = e.target.closest('.src'); if (b) openSources(b.dataset.src.split(',')); });
  $('#sheetPrev').addEventListener('click', () => { if (sheetPrevFn) sheetPrevFn(); });
  $('#sheetClose').addEventListener('click', closeSources);
  $('#sheetBack').addEventListener('click', closeSources);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSources(); });

  // ---------- 機型 ----------
  // ---------- 換飛機：下拉選單＋「換下一架」----------
  const nextId = () => PLANES[(PLANES.indexOf(state.plane) + 1) % PLANES.length];
  function renderPicker() {
    const flyWord = { fly: '會飛', spin: '會轉圈', look: '造型' };
    $('#pickMenu').innerHTML = '<div class="grp">可以 3D 摺紙的飛機</div>' +
      PLANES.map((id) => { const p = C.planes[id]; return '<button class="opt" role="option" data-plane="' + id + '" aria-selected="false"><canvas aria-hidden="true"></canvas><span><b>' + p.name + '</b><small>' + p.tag + '・' + p.persona + '</small></span><span class="mk">摺摺看</span></button>'; }).join('') +
      '<div class="grp">更多酷紙飛機（只有介紹，還不能 3D 摺）</div>' +
      C.cool.map((c) => '<button class="opt" data-cool="' + c.icon + '"><svg viewBox="0 0 96 64" aria-hidden="true">' + coolIcon[c.icon] + '</svg><span><b>' + esc(c.name) + '</b><small>' + flyWord[c.fly] + '・' + ['簡單', '中等', '難'][c.level - 1] + '</small></span><span class="mk">看介紹</span></button>').join('');
    document.querySelectorAll('#pickMenu .opt[data-plane]').forEach((b) => drawIcon(b.querySelector('canvas'), b.dataset.plane, 48, 35));
  }
  function updatePicker() {
    const p = C.planes[state.plane];
    $('#planebar').style.setProperty('--pc', p.color);
    $('#pickName').textContent = p.name;
    $('#pickCon').textContent = p.persona;
    $('#pickTags').innerHTML = p.tags.map((t) => '<span class="ptag">' + t + '</span>').join('');
    drawIcon($('#pickIcon'), state.plane, 52, 38);
    $('#nextPlane').textContent = '換下一架 →';
    $('#nextPlane').setAttribute('aria-label', '換下一架：' + C.planes[nextId()].name);
    document.querySelectorAll('#pickMenu .opt[data-plane]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.plane === state.plane)));
  }
  function openPicker(open) {
    $('#pickMenu').hidden = !open; $('#pickBtn').setAttribute('aria-expanded', String(open));
    if (open) { const cur = $('#pickMenu .opt[aria-selected="true"]'); if (cur) cur.focus(); }
  }
  $('#pickBtn').addEventListener('click', (e) => { e.stopPropagation(); openPicker($('#pickMenu').hidden); });
  $('#pickMenu').addEventListener('click', (e) => {
    const o = e.target.closest('.opt'); if (!o) return;
    openPicker(false);
    if (o.dataset.plane) { selectPlane(o.dataset.plane); $('#pickBtn').focus(); } else goCool(o.dataset.cool);
  });
  document.addEventListener('click', (e) => { if (!$('#pickMenu').hidden && !e.target.closest('.pickwrap')) openPicker(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#pickMenu').hidden) { openPicker(false); $('#pickBtn').focus(); } });
  $('#nextPlane').addEventListener('click', () => selectPlane(nextId()));
  function goCool(icon) {
    switchTab('missions');
    const el = $('#cool-' + icon); if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  function selectPlane(id, keepKnobs) {
    stopPlay(); spin = false; userRot.yaw = 0; userRot.pitch = 0;
    state.plane = id; state.step = 0; state.t = 1; anim = null;
    if (!keepKnobs) state.knobs = Object.assign({}, DEFAULT_KNOBS, { power: C.planes[id].power });
    updatePicker();
    document.documentElement.style.setProperty('--pc', C.planes[id].color);
    buildFlyPlane(); buildParts(); closePart();
    flight = null; state.last = null; trail.geometry.setDrawRange(0, 0); landMark.visible = false; updateArrows(null, false);
    hideRace(); showSingle(true); setBusy(false);
    idlePlane();
    renderPlaneHeads(); renderStep(); renderKnobs(); $('#result').innerHTML = ''; setStats(null);
    needRender = true;
    if (state.tab === 'fold' && !REDUCED && booted) playTimer = setTimeout(playAll, 350);
  }
  function renderPlaneHeads() {
    const p = C.planes[state.plane];
    const pips = (n) => '<span class="pips" aria-label="' + n + ' 顆星">' + [1, 2, 3, 4, 5].map((k) => '<i class="' + (k <= n ? 'on' : '') + '"></i>').join('') + '</span>';
    $('#foldHead').innerHTML = '<div class="hero paper tape" style="--pc:' + p.color + '"><h2 class="herot">' + p.name + '的能力</h2>' +
      '<ul class="stats4">' + C.statNames.map((n, i) => '<li><span>' + n + '</span>' + pips(p.stats[i]) + '</li>').join('') + '</ul>' +
      '<div class="acts"><button class="btn grow" id="storyBtn">聽它的故事</button><button class="btn grow" id="partsBtn">看身上的標籤</button></div>' +
      '<button class="btn primary nextcta" id="heroNext">摺好了？換「' + C.planes[nextId()].name + '」摺摺看 →</button></div>';
    $('#heroNext').addEventListener('click', () => { selectPlane(nextId()); window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); });
    $('#storyBtn').addEventListener('click', () => openStory(state.plane));
    $('#partsBtn').addEventListener('click', () => {
      stopPlay(); spin = false; partsOn = true;
      goStep(built[state.plane].frames.length - 1, false);
      window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    });
    $('#flyHead').textContent = p.tips;
  }

  // ---------- 3D 部位標籤 ----------
  const partsEl = $('#parts');
  let partEls = [], partsOn = true;
  function buildParts() {
    const p = C.planes[state.plane], A = built[state.plane].anchors;
    partsEl.innerHTML = '';
    partEls = p.parts.map((pt, i) => {
      const line = document.createElement('div'); line.className = 'part-line';
      const dot = document.createElement('div'); dot.className = 'part-dot';
      const tag = document.createElement('button'); tag.className = 'part-tag' + (pt.at === 'grip' ? ' grip' : ''); tag.textContent = pt.name; tag.dataset.i = i; tag.setAttribute('aria-expanded', 'false');
      partsEl.append(line, dot, tag);
      return { pt: pt, at: new THREE.Vector3(A[pt.at][0], A[pt.at][1], A[pt.at][2]), line: line, dot: dot, tag: tag };
    });
  }
  function updateParts() {
    const n = built[state.plane].frames.length;
    const show = partsOn && state.tab === 'fold' && state.step === n - 1 && state.t >= 1 && !anim;
    partsEl.hidden = !show;
    const cap = $('#caption'); if (cap) cap.hidden = show;
    if (!show) { if (!$('#partPop').hidden) closePart(); return; }
    const W = stage.clientWidth, H = stage.clientHeight, cg = built[state.plane].cg;
    const proj = (v) => { const w = offsetNode.localToWorld(v.clone()).project(foldCam); return [(w.x + 1) / 2 * W, (1 - w.y) / 2 * H]; };
    const c = proj(new THREE.Vector3(cg[0], cg[1], cg[2]));
    const placed = [];
    partEls.forEach((e) => {
      const p = proj(e.at);
      let dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy);
      if (l < 10) { dx = 0.3; dy = 1; l = Math.hypot(dx, dy); }
      const tw = e.tag.offsetWidth || 90;
      let tx = Math.max(tw / 2 + 6, Math.min(W - tw / 2 - 6, p[0] + dx / l * 56));
      let ty = Math.max(22, Math.min(H - 64, p[1] + dy / l * 44));
      placed.forEach((q) => { if (Math.abs(q[0] - tx) < (tw + q[2]) / 2 + 4 && Math.abs(q[1] - ty) < 32) ty = q[1] + (ty >= q[1] ? 32 : -32); });
      placed.push([tx, ty, tw]);
      const lx = tx - p[0], ly = ty - p[1];
      e.dot.style.left = p[0] + 'px'; e.dot.style.top = p[1] + 'px';
      e.tag.style.left = tx + 'px'; e.tag.style.top = ty + 'px';
      e.line.style.left = p[0] + 'px'; e.line.style.top = p[1] + 'px';
      e.line.style.width = Math.hypot(lx, ly) + 'px'; e.line.style.transform = 'rotate(' + Math.atan2(ly, lx) + 'rad)';
    });
  }
  function openPart(i) {
    const e = partEls[i]; if (!e) return;
    partEls.forEach((x) => x.tag.setAttribute('aria-expanded', String(x === e)));
    const pop = $('#partPop');
    const cp = C.partPart[e.pt.at], cc = C.compare.find((x) => x.key === cp);
    pop.innerHTML = '<button class="mini x" id="popClose">關閉</button><b>' + esc(e.pt.name) + '</b><p class="kidline">' + esc(e.pt.kid) + '</p>' + adultBox(e.pt.adult, e.pt.src) +
      (cc ? '<button class="mini learn" data-cmp="' + cp + '">跟真飛機比一比：' + cc.name + ' →</button>' : '');
    pop.hidden = false;
    $('#popClose').addEventListener('click', closePart);
  }
  function closePart() { $('#partPop').hidden = true; partEls.forEach((x) => x.tag.setAttribute('aria-expanded', 'false')); }
  partsEl.addEventListener('click', (e) => { const t = e.target.closest('.part-tag'); if (!t) return; spin = false; openPart(+t.dataset.i); });

  // ---------- 摺摺看 ----------
  function renderStep() {
    const b = built[state.plane], n = b.frames.length, step = b.frames[state.step].step;
    const txt = C.planes[state.plane].steps[step.key];
    $('#dots').innerHTML = b.frames.map((f, i) => '<button aria-label="第 ' + (i + 1) + ' 步" ' + (i === state.step ? 'aria-current="step"' : '') + ' class="' + (i < state.step ? 'past' : '') + '" data-i="' + i + '">' + (i + 1) + '</button>').join('');
    $('#stepEyebrow').textContent = '第 ' + (state.step + 1) + ' 步／共 ' + n + ' 步';
    $('#stepWhy').innerHTML = '<b>為什麼？</b>' + esc(txt.why);
    $('#stepAdult').innerHTML = adultBox(txt.adult, txt.src);
    const cp = C.stepPart[step.key], cc = cp && C.compare.find((x) => x.key === cp);
    $('#stepLink').innerHTML = cc ? '<button class="mini learn" data-cmp="' + cp + '">跟真飛機比一比：' + cc.name + ' →</button>' : '';
    $('#prevBtn').disabled = state.step === 0;
    const last = state.step === n - 1;
    $('#nextBtn').textContent = last ? '去飛飛看！' : '下一步';
    renderPlayBtn();
    if (state.tab === 'fold') {
      $('#ovTL').innerHTML = hintShown ? '<span class="pill ghost" id="dragHint">用手指轉轉看</span>' : '';
      $('#ovBR').innerHTML = (last ? '<button class="mini" id="partsTog">' + (partsOn ? '藏起標籤' : '看標籤') + '</button>' : '') + '<button class="mini" id="resetView">轉回來</button>';
      if (last) $('#partsTog').addEventListener('click', () => { partsOn = !partsOn; renderStep(); needRender = true; });
      $('#ovBL').innerHTML = '<span class="caption" id="caption">' + esc(txt.kid) + '</span>'; $('#ovTR').innerHTML = '';
      $('#resetView').addEventListener('click', () => { userRot.yaw = 0; userRot.pitch = 0; needRender = true; });
    }
  }
  function stepDur(k) { const st = built[state.plane].frames[k].step; return (st.open ? 2600 : (st.key === 'crease' ? 2000 : 1600)) * state.speed; }
  function goStep(i, animate, onDone) {
    const n = built[state.plane].frames.length;
    i = Math.max(0, Math.min(n - 1, i));
    const dur = stepDur;
    if (animate && i === state.step + 1) {
      state.step = i; state.t = 0; anim = { from: 0, to: 1, start: performance.now(), dur: dur(i), done: onDone };
    } else if (animate && i === state.step - 1) {
      const from = state.step;
      anim = { from: 1, to: 0, start: performance.now(), dur: dur(from) * 0.6, done: () => { state.step = i; state.t = 1; renderStep(); needRender = true; } };
      return;
    } else { state.step = i; state.t = 1; anim = null; }
    renderStep(); needRender = true;
  }
  // 從頭摺到尾：一步接一步自動播放
  let playing = false, playTimer = 0;
  function stopPlay() { playing = false; clearTimeout(playTimer); renderPlayBtn(); }
  function playAll() {
    const n = built[state.plane].frames.length;
    clearTimeout(playTimer); anim = null; spin = false;
    if (state.step >= n - 1 || state.step === 0) { state.step = 0; state.t = 1; renderStep(); }
    playing = true; renderPlayBtn(); needRender = true;
    playTimer = setTimeout(playNext, 700 * state.speed);
  }
  function playNext() {
    if (!playing) return;
    const n = built[state.plane].frames.length;
    if (state.step >= n - 1) { playing = false; spin = true; renderPlayBtn(); return; }
    goStep(state.step + 1, true, () => { if (playing) playTimer = setTimeout(playNext, 650 * state.speed); });
  }
  function renderPlayBtn() {
    const b = $('#playAll'); if (!b) return;
    const n = built[state.plane].frames.length;
    b.innerHTML = playing ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor"/></svg>暫停' :
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg>' + (state.step > 0 && state.step < n - 1 ? '繼續摺' : '從頭摺到尾');
  }
  $('#playAll').addEventListener('click', () => { if (playing) stopPlay(); else playAll(); });
  // 速度滑桿：播放倍速 0.5x～2x（state.speed 是每一步時間的倍數，所以取倒數）
  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
  $('#speedRange').addEventListener('input', (e) => {
    const r = RATES[+e.target.value] || 1;
    state.speed = 1 / r;
    $('#speedVal').textContent = r + 'x';
    e.target.setAttribute('aria-valuetext', r + ' 倍速');
  });
  $('#nextBtn').addEventListener('click', () => {
    stopPlay(); spin = false;
    const n = built[state.plane].frames.length;
    if (state.step === n - 1) { switchTab('fly'); return; }
    goStep(state.step + 1, true);
  });
  $('#prevBtn').addEventListener('click', () => { stopPlay(); spin = false; goStep(state.step - 1, true); });
  $('#replayBtn').addEventListener('click', () => { stopPlay(); spin = false; if (state.step === 0) return; state.t = 0; anim = { from: 0, to: 1, start: performance.now(), dur: stepDur(state.step) }; });
  $('#dots').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { stopPlay(); spin = false; goStep(+b.dataset.i, +b.dataset.i === state.step + 1); } });

  // ---------- 飛飛看：旋鈕 ----------
  const arrowIcon = (deg) => '<svg viewBox="0 0 20 20" aria-hidden="true"><g transform="rotate(' + (-deg) + ' 10 10)"><path d="M3 10h12M11 6l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
  const KNOBS = [
    { key: 'power', label: '丟的力氣', opts: [[1, '很輕'], [2, '輕輕'], [3, '中等'], [4, '用力'], [5, '超用力']] },
    { key: 'angle', label: '丟的方向', opts: ANGLES.map((a) => [a, arrowIcon(a) + ({ '-15': '往下', '0': '平平', '10': '微微上', '25': '往上', '40': '很高' })[a]]) },
    { key: 'clips', label: '機頭夾迴紋針', hint: '頭變重', opts: [[0, '不夾'], [1, '1 個'], [2, '2 個']] },
    { key: 'tail', label: '尾巴往上翹', hint: '頭抬起來', opts: [[0, '平的'], [1, '一點點'], [2, '中等'], [3, '很多']] },
    { key: 'asym', label: '左右翅膀', opts: [[-2, '左轉多'], [-1, '左轉'], [0, '一樣'], [1, '右轉'], [2, '右轉多']] }
  ];
  function renderKnobs() {
    $('#knobs').innerHTML = KNOBS.map((k) => '<div class="knob"><div class="lab">' + k.label + (k.hint ? '<small>' + k.hint + '</small>' : '') + '</div><div class="seg" role="group" aria-label="' + k.label + '">' +
      k.opts.map((o) => '<button data-k="' + k.key + '" data-v="' + o[0] + '" aria-pressed="' + (state.knobs[k.key] === o[0]) + '">' + o[1] + '</button>').join('') + '</div></div>').join('');
  }
  $('#knobs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    state.knobs[b.dataset.k] = +b.dataset.v;
    b.parentNode.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (!flight || flight.done) { if (!flight) idlePlane(); }
  });
  $('#throwBtn').addEventListener('click', throwPlane);
  $('#gripBtn').addEventListener('click', () => {
    switchTab('fold'); stopPlay(); spin = false; partsOn = true;
    goStep(built[state.plane].frames.length - 1, false);
    window.scrollTo({ top: 0 });
    const gi = C.planes[state.plane].parts.findIndex((p) => p.at === 'grip');
    needRender = true; openPart(gi);
  });
  $('#raceBtn').addEventListener('click', startRace);
  $('#bestBtn').addEventListener('click', () => {
    const b = Flight.findBest(state.plane);
    state.knobs = Object.assign({}, b.knobs); renderKnobs();
    state.bestNote = '電腦試了 ' + b.tried + ' 種丟法（不算翻圈），這樣丟最遠：' + knobText(b.knobs);
    throwPlane();
  });
  $('#bestBoard').addEventListener('click', (e) => {
    const li = e.target.closest('li[role="button"]'); if (!li) return;
    const id = li.dataset.id;
    if (!id || !state.best[id]) return;
    selectPlane(id, true); state.knobs = Object.assign({}, state.best[id].knobs); renderKnobs(); throwPlane();
  });
  function toggle(id, key, after) {
    $(id).addEventListener('click', () => { state[key] = !state[key]; $(id).setAttribute('aria-pressed', String(state[key])); if (after) after(); });
  }
  toggle('#tArrows', 'arrows', () => { renderFlyOverlay(); if (flight && flight.done) updateArrows(null, false); });
  toggle('#tCam', 'chase'); toggle('#tSlow', 'slow');
  $('#tClear').addEventListener('click', () => { state.ghosts = []; ghostLines.forEach((g) => g.geometry.setDrawRange(0, 0)); });

  function setStats(dist, time, final) {
    if (state.tab === 'fold') return;
    if (dist === null) { $('#ovTL').innerHTML = '<span class="pill">還沒丟</span>'; return; }
    $('#ovTL').innerHTML = '<span class="pill">' + (final ? '飛了 ' : '') + dist.toFixed(1) + ' 公尺</span><span class="pill">' + time.toFixed(1) + ' 秒</span>';
  }
  function renderFlyOverlay() {
    $('#ovBR').innerHTML = '';
    $('#ovTR').innerHTML = '';
    $('#ovBL').innerHTML = state.arrows ? '<span class="pill legend">' + C.forces.map((f) => '<i style="background:' + f.color + '"></i>' + f.name).join('&ensp;') + '</span>' : '';
  }
  function showResult(res) {
    const v = C.verdicts[res.verdict];
    let html = '<div class="result paper tape" aria-live="polite"><div class="stats"><span><b>' + res.dist.toFixed(1) + '</b>公尺</span><span><b>' + res.time.toFixed(1) + '</b>秒</span></div>' +
      '<p class="kid" style="font-size:22px">' + v.kid + '</p>' + adultBox(v.adult, v.src) + '</div>';
    const m = state.mission;
    if (m) {
      const ok = checkMission(m, res);
      if (ok && state.done.indexOf(m.id) < 0) { state.done.push(m.id); saveDone(); renderMissions(); }
      html = '<div class="mission-bar ' + (ok ? 'win' : '') + '"><div class="eyebrow">' + (ok ? '過關！得到一顆星星' : '再試一次') + '</div><p class="kid">' + (ok ? '你完成了「' + m.name + '」！' : m.hint) + '</p></div>' + html;
    }
    if (state.bestNote) { html = '<div class="mission-bar"><div class="eyebrow">電腦幫你找</div><p style="margin:0">' + esc(state.bestNote) + '</p></div>' + html; state.bestNote = ''; }
    $('#result').innerHTML = html;
  }
  function checkMission(m, res) {
    const last = res.pts[res.pts.length - 1];
    if (m.island) return Math.hypot(last.x - m.island.x, last.z - m.island.z) <= m.island.r;
    const g = m.goal || {};
    if (g.minDist && res.dist < g.minDist) return false;
    if (g.minSide && Math.abs(last.z) < g.minSide) return false;
    if (g.loop && res.verdict !== 'loop') return false;
    if (g.minTime && res.time < g.minTime) return false;
    return true;
  }

  // ---------- 任務 ----------
  function star(on, color) {
    return '<svg class="sticker" viewBox="0 0 56 56" aria-hidden="true"><path d="m28 5 6.8 14 15.4 2.2-11.1 10.8 2.6 15.3L28 40.1l-13.7 7.2 2.6-15.3L5.8 21.2 21.2 19z" ' + (on ? 'fill="' + color + '" stroke="var(--ink)" stroke-width="1.5"' : 'class="s-off" stroke-width="1.5"') + ' stroke-linejoin="round"/></svg>';
  }
  const starColors = ['#f3b63f', '#2f7fd1', '#23926f', '#a8489c', '#c8611f'];
  const coolIcon = {
    hoop: '<path class="l" d="M18 34 H84"/><ellipse class="a" cx="72" cy="34" rx="8" ry="20"/><ellipse class="b" cx="72" cy="34" rx="4" ry="15"/><ellipse class="a" cx="26" cy="34" rx="5" ry="12"/><ellipse class="b" cx="26" cy="34" rx="2.5" ry="8"/><path class="l" d="M18 34 H84"/>',
    ring: '<ellipse class="a" cx="48" cy="32" rx="30" ry="13"/><ellipse class="b" cx="48" cy="30" rx="24" ry="8"/><path class="l" d="M20 36 Q48 52 76 36"/>',
    whirly: '<path class="b" d="M44 30 H52 V60 H44 Z"/><path class="a" d="M44 30 L18 12 L20 6 L48 26 Z"/><path class="a" d="M52 30 L78 12 L76 6 L48 26 Z"/><path class="l" d="M45 56 h6"/>',
    ufo: '<ellipse class="a" cx="48" cy="38" rx="38" ry="11"/><path class="b" d="M32 36 Q34 16 48 16 Q62 16 64 36 Z"/><circle class="l" cx="30" cy="40" r="1.5"/><circle class="l" cx="48" cy="44" r="1.5"/><circle class="l" cx="66" cy="40" r="1.5"/>',
    space: '<path class="a" d="M12 8 L28 14 L28 50 L12 56 Z"/><path class="a" d="M84 8 L68 14 L68 50 L84 56 Z"/><path class="l" d="M28 32 H68"/><circle class="b" cx="48" cy="32" r="11"/><circle class="l" cx="48" cy="32" r="4"/>',
    suzanne: '<path class="a" d="M88 32 L10 18 L22 32 L10 46 Z"/><path class="l" d="M88 32 L14 32"/>',
    glider: '<path class="b" d="M10 30 Q50 26 86 31 L86 34 Q50 36 10 34 Z"/><path class="a" d="M44 12 L50 12 L52 52 L46 52 Z"/><path class="a" d="M14 24 L18 24 L19 40 L15 40 Z"/>',
    jet: '<path class="a" d="M48 4 L52 16 L52 30 L80 46 L80 50 L52 44 L52 52 L60 58 L60 60 L48 58 L36 60 L36 58 L44 52 L44 44 L16 50 L16 46 L44 30 L44 16 Z"/><path class="l" d="M42 50 L40 40 M54 50 L56 40"/>',
    stealth: '<path class="a" d="M48 10 L90 46 L78 50 L68 42 L58 50 L48 44 L38 50 L28 42 L18 50 L6 46 Z"/><path class="l" d="M42 22 L48 18 L54 22"/>'
  };
  const flyTag = { fly: '<span class="fly">會飛</span>', spin: '<span class="spin">會轉圈</span>', look: '<span class="look">造型</span>' };
  function renderCool() {
    $('#coolAdult').innerHTML = adultBox(C.coolAdult, ['catalog'], '給大人：紙飛機有幾種？');
    $('#coolList').innerHTML = C.cool.map((c) => '<div class="cool paper" id="cool-' + c.icon + '"><div class="pic"><svg viewBox="0 0 96 64" aria-hidden="true">' + coolIcon[c.icon] + '</svg></div><h3>' + esc(c.name) + '</h3>' +
      '<div class="tags">' + flyTag[c.fly] + '<span>' + ['簡單', '中等', '難'][c.level - 1] + '</span></div><p>' + esc(c.kid) + '</p><p class="needs">要準備：' + esc(c.needs) + '</p>' + adultBox(c.adult, c.src) + '</div>').join('');
  }
  function renderMissions() {
    $('#missionList').innerHTML = C.missions.map((m, i) => {
      const on = state.done.indexOf(m.id) >= 0;
      return '<div class="mission paper">' + star(on, starColors[i]) + '<div><h3>' + m.name + '</h3><p>' + m.kid + '</p><button class="btn ' + (on ? '' : 'primary') + '" data-m="' + m.id + '">' + (on ? '再玩一次' : '開始挑戰') + '</button></div></div>';
    }).join('');
  }
  $('#missionList').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) startMission(b.dataset.m); });
  function startMission(id) {
    const m = C.missions.find((x) => x.id === id);
    state.mission = m;
    if (m.plane) selectPlane(m.plane, false);
    if (m.knobs) { state.knobs = Object.assign({}, m.knobs); renderKnobs(); }
    island.visible = !!m.island;
    if (m.island) island.position.set(m.island.x, 0, m.island.z);
    renderMissionBar(); $('#result').innerHTML = '';
    flight = null; trail.geometry.setDrawRange(0, 0); landMark.visible = false; idlePlane();
    switchTab('fly');
  }
  function renderMissionBar() {
    const m = state.mission;
    if (!m) { $('#missionBar').innerHTML = ''; return; }
    $('#missionBar').innerHTML = '<div class="mission-bar"><div class="eyebrow">挑戰中：' + m.name + '</div><p class="kid">' + m.kid + '</p><div class="row"><button class="mini" id="mHint">給一點提示</button><button class="mini" id="mEnd">結束挑戰</button></div><p class="note" id="mHintText" hidden>' + m.hint + '</p></div>';
    $('#mHint').addEventListener('click', () => { $('#mHintText').hidden = false; });
    $('#mEnd').addEventListener('click', () => { state.mission = null; island.visible = false; renderMissionBar(); });
  }

  // ---------- 為什麼 ----------
  const forceIcon = {
    lift: '<path d="M11 19V5M6 10l5-5 5 5" />', weight: '<path d="M11 3v14M6 12l5 5 5-5" />',
    thrust: '<path d="M3 11h14M12 6l5 5-5 5" />', drag: '<path d="M19 11H5M10 6l-5 5 5 5" />'
  };
  function renderFar() {
    $('#farTips').innerHTML = C.farTips.map((t, i) => '<li class="paper"><span class="pos">' + (i + 1) + '</span><div><b>' + t.title + '</b><p class="kidline">' + esc(t.kid) + '</p>' + adultBox(t.adult, t.src) + '</div></li>').join('');
  }
  // 紙飛機（左）和真飛機（右）的俯視小圖，機頭朝上；hl＝要塗黃色的部位
  function paperSVG(hl) {
    let s = '<path class="b" d="M40 4 L76 92 L40 82 L4 92 Z"/>';
    if (hl === 'nose') s += '<path class="h" d="M40 4 L50 28 L30 28 Z"/>';
    if (hl === 'wing') s += '<path class="h" d="M43 22 L76 92 L43 83 Z"/><path class="h" d="M37 22 L4 92 L37 83 Z"/>';
    if (hl === 'tail') s += '<path class="h" d="M76 92 L46 83.7 L46 77.5 L73 85 Z"/><path class="h" d="M4 92 L34 83.7 L34 77.5 L7 85 Z"/><path class="hs" d="M40 34 V80"/>';
    s += '<path class="ln" d="M40 4 V82"/>';
    if (hl === 'engine') s += '<path class="hs" d="M40 110 V97 M33 103 L40 96 L47 103"/>';
    return '<svg viewBox="0 0 80 112" aria-hidden="true">' + s + '</svg>';
  }
  function realSVG(hl) {
    const c = (k) => (k === hl ? 'h' : 'b');
    let s = '<path class="' + c('wing') + '" d="M45 42 L78 62 L78 68 L45 58 Z"/><path class="' + c('wing') + '" d="M35 42 L2 62 L2 68 L35 58 Z"/>' +
      '<path class="' + c('tail') + '" d="M45 85 L60 93 L60 97 L45 94 Z"/><path class="' + c('tail') + '" d="M35 85 L20 93 L20 97 L35 94 Z"/>' +
      '<rect class="b" x="35" y="4" width="10" height="98" rx="5"/>' +
      '<rect class="' + c('tail') + '" x="38.5" y="78" width="3" height="24" rx="1.5"/>' +
      '<rect class="' + c('engine') + '" x="54" y="47" width="6" height="12" rx="2.5"/><rect class="' + c('engine') + '" x="20" y="47" width="6" height="12" rx="2.5"/>';
    if (hl === 'nose') s += '<path class="h" d="M35 24 V9 a5 5 0 0 1 10 0 V24 Z"/>';
    return '<svg viewBox="0 0 80 112" aria-hidden="true">' + s + '</svg>';
  }
  function renderCompare() {
    $('#compare').innerHTML = C.compare.map((c) => '<section class="cmp paper" id="cmp-' + c.key + '"><div><span class="badge">' + c.name + '</span></div><p class="kidline">' + esc(c.kid) + '</p>' +
      '<div class="pair"><figure>' + paperSVG(c.key) + '<figcaption><b>紙飛機</b>' + esc(c.paper) + '</figcaption></figure><figure>' + realSVG(c.key) + '<figcaption><b>真飛機</b>' + esc(c.real) + '</figcaption></figure></div>' +
      adultBox(c.adult, c.src) + '<button class="mini back" hidden></button></section>').join('');
  }
  // 從摺紙步驟或部位標籤跳到對照卡
  function goCompare(key) {
    const from = state.tab === 'fold' ? state.step : null;
    stopPlay(); spin = false; closePart();
    switchTab('why');
    const el = $('#cmp-' + key); if (!el) return;
    document.querySelectorAll('.cmp .back').forEach((b) => { b.hidden = true; });
    if (from !== null) { const b = el.querySelector('.back'); b.hidden = false; b.textContent = '← 回到摺紙第 ' + (from + 1) + ' 步'; }
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start', behavior: REDUCED ? 'auto' : 'smooth' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-cmp]'); if (b) goCompare(b.dataset.cmp); });
  $('#compare').addEventListener('click', (e) => { if (e.target.closest('.back')) switchTab('fold'); });
  function renderWhy() {
    renderFar(); renderCompare();
    $('#forceCards').innerHTML = C.forces.map((f) => '<div class="force paper"><h3><svg viewBox="0 0 22 22" fill="none" stroke="' + f.color + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + forceIcon[f.key] + '</svg>' + f.name + '</h3><div class="who">' + f.who + '</div><p>' + esc(f.text) + '</p></div>').join('');
    $('#forceAdult').innerHTML = adultBox(C.forcesAdult, ['forces', 'glide', 'liftEq']);
    $('#ideas').innerHTML = C.ideas.map((d, i) => '<div class="idea paper"><h3>' + d.title + '</h3><p class="kidline">' + d.kid + '</p>' + adultBox(d.adult, d.src) + '<div><button class="btn primary" data-idea="' + i + '">' + d.try.label + '</button></div></div>').join('');
    $('#fact').innerHTML = '<p class="eyebrow">金氏世界紀錄</p><p><span class="num">98.43</span> 公尺：飛最遠</p><p><span class="num">31.2</span> 秒：飛最久</p><p style="margin:6px 0 10px">差不多一整座足球場那麼遠！</p>' +
      adultBox('飛最遠 98.43 公尺：2025 年 12 月 28 日，上海。飛最久 31.2 秒：2026 年 2 月 11 日，江蘇崑山。', ['record']);
    $('#flyAdult').innerHTML = adultBox('畫面上的飛機放大了 3 倍，比較看得清楚。力氣「很輕」到「超用力」是每秒 3、5、7、9、11 公尺。模擬用的是簡化過的公式，數字跟真的紙飛機不會一模一樣，但「怎麼調會變怎樣」的方向是對的，拿真的紙飛機試試看最準。', [], '給大人：關於這個模擬');
  }
  $('#ideas').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-idea]'); if (!b) return;
    const d = C.ideas[+b.dataset.idea];
    state.mission = null; island.visible = false; renderMissionBar();
    selectPlane(d.try.plane, true); state.knobs = Object.assign({}, d.try.knobs); renderKnobs();
    switchTab('fly'); setTimeout(throwPlane, 450);
  });
  $('#arrowsGo').addEventListener('click', () => {
    state.arrows = true; state.slow = true;
    $('#tArrows').setAttribute('aria-pressed', 'true'); $('#tSlow').setAttribute('aria-pressed', 'true');
    switchTab('fly'); setTimeout(throwPlane, 450);
  });

  // ---------- 分頁 ----------
  function switchTab(tab, fromHash) {
    if (tab !== 'fold') { stopPlay(); partsEl.hidden = true; closePart(); }
    state.tab = tab;
    document.querySelector('.app').dataset.tab = tab;
    $('#prog').hidden = tab !== 'fold';
    ['fold', 'fly', 'why', 'missions'].forEach((t) => { $('#v-' + t).hidden = t !== tab; });
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (!fromHash && location.hash !== '#' + tab) { try { history.replaceState(null, '', '#' + tab); } catch (e) { location.hash = tab; } }
    if (tab === 'fold') renderStep();
    else { renderFlyOverlay(); if (flight && flight.done) setStats(flight.res.dist, flight.res.time, true); else if (!flight) setStats(null); }
    needRender = true;
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (['fold', 'fly', 'why', 'missions'].indexOf(h) >= 0 && h !== state.tab) switchTab(h, true); });

  // ---------- 開始 ----------
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let booted = false;
  renderPicker(); renderWhy(); renderMissions(); renderCool(); renderBest();
  selectPlane('dart');
  applyTheme(); resize();
  const h0 = location.hash.slice(1);
  switchTab(['fold', 'fly', 'why', 'missions'].indexOf(h0) >= 0 ? h0 : 'fold', true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { needRender = true; });
  booted = true;
  if (state.tab === 'fold' && !REDUCED) playTimer = setTimeout(playAll, 900);
  requestAnimationFrame(loop);
})();
