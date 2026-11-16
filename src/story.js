// 開場動畫：「為什麼紙飛機要平頭？」叔叔和姪子的 3D 小劇場（直式 9:16，約 21 秒）。
// 只做到故事結束；介紹網站的畫面由使用者自己錄影接上。
// 所有動作都由時間 T 算出來，所以可以拖時間軸、跳到任何一幕重錄。
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const frameEl = $('#frame'), layer = $('#bubbles');
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const seg = (T, a, b) => clamp01((T - a) / (b - a));
  const pop = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; const c = 2.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const END = 21;
  const SCENES = [
    { at: 0, name: '1 為什麼平頭' }, { at: 4, name: '2 同學教的' }, { at: 10, name: '3 不會迴轉' }, { at: 16.5, name: '4 一起搞懂' }
  ];
  // 對話框：off＝叔叔在畫面外說話
  const BUBBLES = [
    { from: 0.75, to: 3.9, who: 'uncle', name: '叔叔', text: '紙飛機為什麼要平頭？！', cls: 'shout' },
    { from: 4.9, to: 7.5, who: 'kid', name: '姪子', text: '同學教的！要這樣摺才厲害！' },
    { from: 7.7, to: 10.0, who: 'uncle', name: '叔叔', text: '嗯……想不通。' },
    { from: 10.4, to: 13.0, who: 'kid', name: '姪子', text: '因為這樣才不會迴轉！' },
    { from: 13.4, to: 16.4, who: 'uncle', name: '叔叔', text: '不對不對，你把我的問題迴轉了啦！' },
    { from: 17.2, to: 21.0, who: 'uncle', name: '叔叔', text: '我們一起搞懂，再去試試看！' }
  ];

  // ---------- three.js 基本 ----------
  // ?render＝逐格輸出影片用：用裝置的完整像素密度、藏起控制列
  const RENDER = /[?&]render(&|$)/.test(location.search);
  if (RENDER) document.body.classList.add('rec');
  const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
  renderer.setPixelRatio(RENDER ? (window.devicePixelRatio || 1) : Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const BG = 0xfbf5e6, INK = 0x2b2a3d;
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 5.5, 11);
  const cam = new THREE.PerspectiveCamera(34, 9 / 16, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbf9f, 0.62));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(-2, 5, 4); scene.add(sun);

  // 卡通上色＋粗黑邊（手作貼紙感）
  const grad = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.LuminanceFormat);
  grad.minFilter = THREE.NearestFilter; grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });
  const inkBack = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const inkM = new THREE.MeshBasicMaterial({ color: INK });
  function part(geo, mat, k) {
    const g = new THREE.Group();
    const o = new THREE.Mesh(geo, inkBack); o.scale.setScalar(1 + k);
    g.add(o, new THREE.Mesh(geo, mat));
    return g;
  }

  // 方格紙地板
  const fc = document.createElement('canvas'); fc.width = fc.height = 128;
  (function () { const x = fc.getContext('2d'); x.fillStyle = '#fbf5e6'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(70,110,160,.26)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 1); x.lineTo(128, 1); x.moveTo(1, 0); x.lineTo(1, 128); x.stroke(); })();
  const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(40, 40); ft.anisotropy = 4;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: ft }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  function blob(r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: 0x8a7a5a, transparent: true, opacity: 0.25, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.003; return m;
  }

  // ---------- Q 版人物 ----------
  function person(o) {
    const s = o.s, R = o.headR;
    const root = new THREE.Group();
    const shirt = toon(o.shirt), pants = toon(o.pants), skin = toon(0xf6cfaa), hairM = toon(o.hair), shoeM = toon(0x3b3550);
    const legH = 0.26 * s, bodyH = 0.36 * s, rT = 0.14 * s, rB = 0.18 * s;
    root.add(blob(0.3 * s));
    [-1, 1].forEach((sd) => {
      const leg = part(new THREE.CylinderGeometry(0.062 * s, 0.058 * s, legH, 14), pants, 0.14); leg.position.set(sd * 0.075 * s, legH / 2, 0); root.add(leg);
      const sh = part(new THREE.SphereGeometry(0.072 * s, 14, 10), shoeM, 0.14); sh.scale.set(1, 0.55, 1.45); sh.position.set(sd * 0.075 * s, 0.035 * s, 0.035 * s); root.add(sh);
    });
    const body = new THREE.Group(); body.position.y = legH; root.add(body);
    const torso = part(new THREE.CylinderGeometry(rT, rB, bodyH, 22), shirt, 0.05); torso.position.y = bodyH / 2; body.add(torso);
    const cap = part(new THREE.SphereGeometry(rT, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), shirt, 0.05); cap.position.y = bodyH; cap.scale.y = 0.5; body.add(cap);
    const armL = 0.29 * s;
    const arms = [-1, 1].map((sd) => {
      const pv = new THREE.Group(); pv.position.set(sd * (rT + 0.03 * s), bodyH - 0.02 * s, 0); body.add(pv);
      const a = part(new THREE.CylinderGeometry(0.048 * s, 0.044 * s, armL, 12), shirt, 0.14); a.position.y = -armL / 2; pv.add(a);
      const hand = new THREE.Group(); hand.position.y = -armL - 0.02 * s; pv.add(hand);
      hand.add(part(new THREE.SphereGeometry(0.056 * s, 14, 10), skin, 0.14));
      return { pv: pv, hand: hand, sd: sd };
    });
    const head = new THREE.Group(); head.position.y = bodyH + R * 0.88; body.add(head);
    head.add(part(new THREE.SphereGeometry(R, 30, 22), skin, 0.04));
    [-1, 1].forEach((sd) => { const e = part(new THREE.SphereGeometry(R * 0.17, 12, 8), skin, 0.2); e.position.set(sd * R * 0.97, -R * 0.05, -R * 0.05); head.add(e); });
    const whiteM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyes = [-1, 1].map((sd) => {
      const g = new THREE.Group(); g.position.set(sd * R * 0.34, R * 0.06, R * 0.93);
      const e = new THREE.Mesh(new THREE.SphereGeometry(R * 0.105, 14, 10), inkM); e.scale.set(0.85, 1.15, 0.45); g.add(e);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(R * 0.034, 8, 6), whiteM); hl.position.set(R * 0.03, R * 0.045, R * 0.045); g.add(hl);
      head.add(g); return g;
    });
    // 驚嚇用的大白眼（平常藏起來）
    const whites = [-1, 1].map((sd) => { const w = part(new THREE.SphereGeometry(R * 0.2, 18, 12), whiteM, 0.1); w.position.set(sd * R * 0.34, R * 0.06, R * 0.9); w.visible = false; head.add(w); return w; });
    const rims = [];
    const brows = [-1, 1].map((sd) => { const b = new THREE.Mesh(new THREE.BoxGeometry(R * 0.24, R * 0.05, R * 0.05), inkM); b.position.set(sd * R * 0.34, R * 0.3, R * 0.94); head.add(b); return b; });
    const cheekM = new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.55 });
    [-1, 1].forEach((sd) => { const c = new THREE.Mesh(new THREE.SphereGeometry(R * 0.11, 12, 8), cheekM); c.scale.set(1.2, 0.7, 0.3); c.position.set(sd * R * 0.56, -R * 0.14, R * 0.8); head.add(c); });
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(R * 0.11, 14, 10), new THREE.MeshBasicMaterial({ color: 0x8a3346 }));
    mouth.position.set(0, -R * 0.27, R * 0.95); head.add(mouth);
    const hair = part(new THREE.SphereGeometry(R * 1.07, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, 0.03);
    hair.rotation.x = -0.42; hair.position.y = R * 0.02; head.add(hair);
    if (o.tufts) {
      [-0.35, 0, 0.35].forEach((x) => { const t = part(new THREE.ConeGeometry(R * 0.16, R * 0.38, 10), hairM, 0.08); t.position.set(x * R, R * 0.66, R * 0.6); t.rotation.set(1.9, 0, -x * 0.8); head.add(t); });
      const top = part(new THREE.ConeGeometry(R * 0.12, R * 0.4, 10), hairM, 0.1); top.position.set(0, R * 1.12, -R * 0.15); top.rotation.set(-0.3, 0, 0.35); head.add(top);
    }
    if (o.glasses) {
      [-1, 1].forEach((sd) => { const r = new THREE.Mesh(new THREE.TorusGeometry(R * 0.17, R * 0.028, 8, 28), inkM); r.position.set(sd * R * 0.34, R * 0.06, R * 1.0); head.add(r); rims.push(r); });
      const br = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.022, R * 0.022, R * 0.34, 6), inkM); br.rotation.z = Math.PI / 2; br.position.set(0, R * 0.1, R * 1.01); head.add(br);
    }
    return { root: root, body: body, head: head, arms: arms, eyes: eyes, whites: whites, rims: rims, brows: brows, mouth: mouth, R: R };
  }
  const kid = person({ s: 0.9, headR: 0.25, shirt: 0xf3b63f, pants: 0x35587a, hair: 0x3b2a20, tufts: true });
  const uncle = person({ s: 1.22, headR: 0.25, shirt: 0x5aa8e0, pants: 0x5c5470, hair: 0x2a221c, glasses: true });
  kid.root.position.set(-0.36, 0, 0); kid.root.rotation.y = 0.5;
  uncle.root.position.set(0.36, 0, -0.05); uncle.root.rotation.y = -0.5;
  scene.add(kid.root, uncle.root);

  // ---------- 大翅膀滑翔機（用摺紙引擎摺出來的真形狀）----------
  const spec = PlaneSpecs.list.find((p) => p.id === 'glider');
  const folded = FoldEngine.build(spec);
  const ALPHA = PlaneSpecs.ALPHA * Math.PI / 180;
  const fv = V(0, 1, 0), U = V(Math.cos(ALPHA), 0, Math.sin(ALPHA));
  const toLocal = new THREE.Matrix4().makeBasis(fv, U, new THREE.Vector3().crossVectors(fv, U)).transpose();
  const cgp = FoldEngine.centerOfMass(folded.final);
  const loc = (v) => V(v[0] - cgp[0], v[1] - cgp[1], v[2] - cgp[2]).applyMatrix4(toLocal).multiplyScalar(0.001);
  const plane = new THREE.Group(); plane.rotation.order = 'YZX';
  (function () {
    const pos = [], posB = [], edges = [];
    folded.final.forEach((q) => {
      const p = q.cur.map(loc);
      for (let i = 1; i < p.length - 1; i++) { pos.push(p[0], p[i], p[i + 1]); posB.push(p[0], p[i + 1], p[i]); }
      for (let i = 0; i < p.length; i++) if (q.edges[i] === 'b') edges.push(p[i], p[(i + 1) % p.length]);
    });
    const mk = (arr) => { const g = new THREE.BufferGeometry().setFromPoints(arr); g.computeVertexNormals(); return g; };
    const po = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    plane.add(new THREE.Mesh(mk(pos), new THREE.MeshLambertMaterial(Object.assign({ color: 0x2e9e7a }, po))));
    plane.add(new THREE.Mesh(mk(posB), new THREE.MeshLambertMaterial(Object.assign({ color: 0xfbf8ef }, po))));
    plane.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edges), new THREE.LineBasicMaterial({ color: INK })));
  })();
  scene.add(plane);
  // 平頭機頭的中心
  let noseX = -1e9; folded.final.forEach((q) => q.cur.forEach((v) => { noseX = Math.max(noseX, loc(v).x); }));
  const noseC = V(0, 0, 0); let nN = 0;
  folded.final.forEach((q) => q.cur.forEach((v) => { const p = loc(v); if (p.x > noseX - 0.004) { noseC.add(p); nN++; } }));
  noseC.multiplyScalar(1 / nN); noseC.z = 0;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffc93c, depthTest: false }));
  ring.renderOrder = 5; scene.add(ring);

  // ---------- 小道具：問號、暈眩、燈泡、平板 ----------
  function cvSprite(draw, size, px) {
    px = px || 128;
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    draw(cv.getContext('2d'), px);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true, fog: false }));
    sp.scale.set(size, size, 1); sp.renderOrder = 10; sp.visible = false; scene.add(sp); return sp;
  }
  const textDraw = (txt, fill) => (x, px) => {
    x.font = '400 ' + Math.round(px * 0.8) + 'px Huninn, "Noto Sans TC", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = px * 0.11; x.strokeStyle = '#2b2a3d'; x.strokeText(txt, px / 2, px * 0.55); x.fillStyle = fill; x.fillText(txt, px / 2, px * 0.55);
  };
  const spiralDraw = (color, w) => (x, px) => {
    x.strokeStyle = color; x.lineWidth = px * w; x.lineCap = 'round'; x.beginPath();
    for (let a = 0; a <= Math.PI * 6; a += 0.08) { const r = a / (Math.PI * 6) * px * 0.42; const X = px / 2 + Math.cos(a) * r, Y = px / 2 + Math.sin(a) * r; a ? x.lineTo(X, Y) : x.moveTo(X, Y); }
    x.stroke();
  };
  const bigQ = cvSprite(textDraw('?', '#ff8fa3'), 0.42);
  const qs = [0, 1, 2].map((i) => cvSprite(textDraw('?', ['#ffc93c', '#8fd0ff', '#ff8fa3'][i]), 0.2));
  const dizzy = cvSprite(spiralDraw('#7a68b5', 0.06), 0.34);
  const eyeSp = [0, 1].map(() => cvSprite(spiralDraw('#2b2a3d', 0.1), 0.085));
  const stars = [0, 1, 2].map(() => cvSprite(textDraw('★', '#ffc93c'), 0.13));
  const rays = cvSprite((x, px) => { x.strokeStyle = '#ffc93c'; x.lineWidth = px * 0.05; x.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(px / 2 + Math.cos(a) * px * 0.3, px / 2 + Math.sin(a) * px * 0.3); x.lineTo(px / 2 + Math.cos(a) * px * 0.46, px / 2 + Math.sin(a) * px * 0.46); x.stroke(); } }, 0.5);
  const burst = (function () {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d');
    for (let i = 0; i < 28; i++) {
      const a0 = i / 28 * Math.PI * 2, w = 0.07;
      x.fillStyle = i % 2 ? 'rgba(255,201,60,.95)' : 'rgba(43,42,61,.85)';
      x.beginPath(); x.moveTo(256 + Math.cos(a0) * 120, 256 + Math.sin(a0) * 120);
      x.lineTo(256 + Math.cos(a0 - w) * 256, 256 + Math.sin(a0 - w) * 256); x.lineTo(256 + Math.cos(a0 + w) * 256, 256 + Math.sin(a0 + w) * 256); x.fill();
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, fog: false }));
    sp.visible = false; scene.add(sp); return sp;
  })();
  const bulb = new THREE.Group();
  bulb.add(part(new THREE.SphereGeometry(0.085, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe066 }), 0.12));
  const bBase = part(new THREE.CylinderGeometry(0.042, 0.038, 0.06, 12), toon(0x9a96a8), 0.15); bBase.position.y = -0.1; bulb.add(bBase);
  scene.add(bulb);
  // 旋轉的弧線（飛機迴轉時）
  const swirl = new THREE.Group(), spinner = new THREE.Group(), inner = new THREE.Group();
  swirl.rotation.order = 'YZX'; inner.rotation.y = Math.PI / 2;
  [0, 1, 2].forEach((i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.011, 6, 30, Math.PI * 0.7), inkM); t.rotation.z = i * Math.PI * 2 / 3; inner.add(t); });
  spinner.add(inner); swirl.add(spinner); scene.add(swirl);

  // ---------- 鏡頭 ----------
  const camKeys = [
    { at: 0, dur: 0, pos: V(-0.02, 0.8, 1.3), look: V(0.28, 0.93, 0) },
    { at: 0.9, dur: 2.8, pos: V(0.0, 0.82, 1.22), look: V(0.29, 0.95, 0) },
    { at: 3.9, dur: 1.0, pos: V(0.04, 1.35, 4.7), look: V(0.04, 0.8, 0) },
    { at: 10.0, dur: 0.7, pos: V(-0.3, 1.2, 2.7), look: V(-0.12, 0.85, 0) },
    { at: 13.1, dur: 0.7, pos: V(0.5, 1.3, 2.75), look: V(0.3, 1.02, 0) },
    { at: 16.4, dur: 0.8, pos: V(0.04, 1.35, 4.7), look: V(0.04, 0.8, 0) },
    { at: 18.0, dur: 3.0, pos: V(0.04, 1.25, 4.1), look: V(0.04, 0.82, 0) }
  ];
  function camAt(T) {
    const p = camKeys[0].pos.clone(), l = camKeys[0].look.clone();
    for (let i = 1; i < camKeys.length; i++) {
      const k = camKeys[i]; if (T < k.at) break;
      const e = k.dur ? ease(seg(T, k.at, k.at + k.dur)) : 1; p.lerp(k.pos, e); l.lerp(k.look, e);
    }
    p.x += 0.03 * Math.sin(T * 0.7); p.y += 0.02 * Math.sin(T * 0.9 + 1);
    // 第一幕：叔叔嚇到的瞬間，鏡頭猛推近＋晃動
    p.lerp(l, 0.24 * ease(seg(T, 0.42, 0.56)) * (1 - ease(seg(T, 3.6, 4.2))));
    if (T > 0.42 && T < 1.2) { const a = 0.022 * (1 - seg(T, 0.42, 1.2)); p.x += a * Math.sin(T * 93); p.y += a * Math.cos(T * 71); }
    cam.position.copy(p); cam.lookAt(l);
  }

  // ---------- 每一刻的動作 ----------
  function rest(p) {
    p.root.position.y = 0;
    p.body.rotation.set(0, 0, 0);
    p.head.rotation.set(0, 0, 0);
    p.arms.forEach((a) => a.pv.rotation.set(0, 0, a.sd * 0.12));
    p.mouth.scale.set(1.1, 0.3, 0.4);
    p.brows.forEach((b, i) => { b.rotation.z = i ? -0.15 : 0.15; b.position.y = p.R * 0.3; });
    p.eyes.forEach((e) => { e.visible = true; e.scale.set(1, 1, 1); e.position.z = p.R * 0.93; });
    p.whites.forEach((w) => { w.visible = false; });
    p.rims.forEach((r) => r.scale.setScalar(1));
    p.head.position.x = 0;
  }
  const talk = (p, T, a, b) => { if (T >= a && T < b) p.mouth.scale.y = 0.3 + 0.55 * Math.abs(Math.sin((T - a) * 13)); };
  const blink = (p, T, off) => { if (((T + off) / 3.3) % 1 < 0.045) p.eyes.forEach((e) => { e.scale.y = 0.12; }); };
  const tmp = V(0, 0, 0);
  function headTop(p, up) { return p.head.getWorldPosition(V(0, 0, 0)).add(V(0, p.R * (up || 1.3), 0)); }

  function pose(T) {
    rest(kid); rest(uncle);
    kid.body.scale.y = 1 + 0.012 * Math.sin(T * 3); uncle.body.scale.y = 1 + 0.012 * Math.sin(T * 3 + 1);
    blink(kid, T, 0.4); blink(uncle, T, 1.7);

    // 姪子：舉起飛機、說話、跳一下
    const raise = 1 - 0.45 * ease(seg(T, 16.5, 17.3));
    const ka = kid.arms[1].pv; ka.rotation.x = -0.55 * raise; ka.rotation.z = 0.12 + 1.2 * raise;
    talk(kid, T, 4.9, 7.4); talk(kid, T, 10.4, 12.6);
    if (T > 4.9 && T < 7.4) kid.root.position.y = 0.025 * Math.abs(Math.sin((T - 4.9) * 6));
    if (T > 11.1 && T < 12.9) kid.root.position.y = 0.07 * Math.abs(Math.sin((T - 11.1) * 7));
    if (T > 18.0 && T < 19.2) kid.head.rotation.x = 0.2 * Math.abs(Math.sin((T - 18) * 5.2));

    // 第一幕：叔叔盯著飛機 → 突然瞪大眼睛大喊
    if (T < 0.5) { uncle.head.rotation.x = 0.2 * (1 - seg(T, 0.36, 0.48)); uncle.body.rotation.x = 0.05 * (1 - seg(T, 0.36, 0.48)); }
    const sh = pop(seg(T, 0.42, 0.7)) * (1 - ease(seg(T, 3.55, 3.95)));
    if (sh > 0.001) {
      uncle.whites.forEach((w) => { w.visible = true; w.scale.set(1.25 * sh, 1.45 * sh, 0.35); });
      uncle.eyes.forEach((e) => { e.scale.set(0.55, 0.55, 1); e.position.z = uncle.R * (0.93 + 0.07 * sh); });
      uncle.rims.forEach((r) => r.scale.setScalar(1 + 0.5 * sh));
      uncle.brows.forEach((b, i) => { b.position.y = uncle.R * (0.3 + 0.22 * sh); b.rotation.z = (i ? 0.3 : -0.3) * sh; });
      uncle.mouth.scale.set(0.95, 0.5 + 0.7 * sh, 0.5);
      uncle.body.rotation.x = -0.14 * sh; uncle.head.rotation.x = -0.12 * sh;
    }
    talk(uncle, T, 0.8, 3.3);
    // 叔叔：抓頭想不通
    const cf = seg(T, 7.4, 7.8) * (1 - seg(T, 9.9, 10.2));
    if (cf > 0) {
      const ua = uncle.arms[1].pv; ua.rotation.z = 0.12 + 2.8 * ease(cf) + 0.1 * Math.sin(T * 10) * cf; ua.rotation.x = -0.35 * cf;
      uncle.head.rotation.z = -0.2 * ease(cf);
      uncle.brows[0].rotation.z = -0.35 * cf; uncle.brows[1].rotation.z = -0.2 * cf; uncle.brows[1].position.y = uncle.R * (0.3 + 0.08 * cf);
    }
    // 叔叔：被「迴轉」轉暈
    const dz = seg(T, 13.2, 13.5) * (1 - seg(T, 16.3, 16.6));
    if (dz > 0) { uncle.head.rotation.z = 0.18 * Math.sin(T * 5) * dz; uncle.body.rotation.z = 0.06 * Math.sin(T * 5 + 1) * dz; uncle.eyes.forEach((e) => { e.visible = dz < 0.5; }); }
    talk(uncle, T, 13.4, 16.0);
    // 叔叔：想到了、拿出平板
    const happy = seg(T, 16.7, 17.0);
    if (happy > 0) uncle.brows.forEach((b) => { b.position.y = uncle.R * (0.3 + 0.07 * happy); });
    talk(uncle, T, 17.2, 20.4);
    scene.updateMatrixWorld(true);

    // 飛機：一直在姪子手上
    const hp = kid.arms[1].hand.getWorldPosition(V(0, 0, 0)); hp.y += 0.07;
    const handYaw = -0.75, handPitch = 0.22;
    plane.position.copy(hp); plane.scale.setScalar(1.7);
    plane.rotation.set(Math.PI * 4 * ease(seg(T, 11.2, 12.8)), handYaw, handPitch);
    plane.updateMatrixWorld(true);

    // 機頭的黃圈圈
    ring.visible = T > 1.1 && T < 3.95;
    if (ring.visible) {
      ring.position.copy(plane.localToWorld(noseC.clone())); ring.lookAt(cam.position);
      ring.scale.setScalar(Math.max(0.001, pop(seg(T, 1.1, 1.5)) * (1 + 0.12 * Math.sin(T * 7))));
    }
    bigQ.visible = false; // 第一幕改成叔叔大喊，不再放大問號
    if (bigQ.visible) { bigQ.position.copy(ring.position).add(V(0.06, 0.28, 0)); bigQ.scale.setScalar(0.42 * pop(seg(T, 1.6, 2.0))); bigQ.material.rotation = 0.15 * Math.sin(T * 3); }
    // 叔叔嚇到時頭後面的放射線
    burst.visible = sh > 0.01;
    if (burst.visible) { const hw = uncle.head.getWorldPosition(V(0, 0, 0)); burst.position.copy(hw.add(hw.clone().sub(cam.position).normalize().multiplyScalar(0.45))); burst.scale.setScalar(1.7 * sh); burst.material.rotation = T * 0.4; burst.material.opacity = Math.min(1, sh); }
    // 叔叔頭上的問號
    qs.forEach((q, i) => {
      q.visible = T > 7.6 + i * 0.25 && T < 10.0;
      if (!q.visible) return;
      q.position.copy(headTop(uncle, 0.6)).add(V(-0.3 - 0.11 * i, 0.12 * i + 0.03 * Math.sin(T * 4 + i), 0.05));
      q.scale.setScalar(0.2 * pop(seg(T, 7.6 + i * 0.25, 7.95 + i * 0.25))); q.material.rotation = 0.25 * Math.sin(T * 5 + i);
    });
    // 飛機迴轉的弧線
    swirl.visible = T > 11.1 && T < 12.9;
    if (swirl.visible) { swirl.position.copy(plane.position); swirl.rotation.set(0, handYaw, handPitch); spinner.rotation.x = T * 9; swirl.scale.setScalar(1.1 * pop(seg(T, 11.1, 11.4))); }
    // 叔叔轉暈
    const dzOn = T > 13.3 && T < 16.4;
    dizzy.visible = dzOn; stars.forEach((s) => { s.visible = dzOn; }); eyeSp.forEach((s) => { s.visible = dzOn && dz >= 0.5; });
    if (dzOn) {
      const ht = headTop(uncle, 1.45);
      dizzy.position.copy(ht); dizzy.material.rotation = T * 6; dizzy.scale.setScalar(0.34 * pop(seg(T, 13.3, 13.6)));
      stars.forEach((s, i) => { const a = T * 3 + i * Math.PI * 2 / 3; s.position.copy(ht).add(V(Math.cos(a) * 0.26, -0.08 + 0.04 * Math.sin(a * 2), Math.sin(a) * 0.26)); });
      uncle.eyes.forEach((e, i) => { const w = e.getWorldPosition(V(0, 0, 0)); w.add(cam.position.clone().sub(w).normalize().multiplyScalar(0.04)); eyeSp[i].position.copy(w); eyeSp[i].material.rotation = -T * 8; });
    }
    // 燈泡
    bulb.visible = T > 16.8;
    rays.visible = bulb.visible;
    if (bulb.visible) { bulb.position.copy(headTop(uncle, 0.4)).add(V(0.27, 0.08, 0)); bulb.scale.setScalar(Math.max(0.001, pop(seg(T, 16.8, 17.2)))); rays.position.copy(bulb.position); rays.material.rotation = T * 0.8; rays.scale.setScalar(0.5 * pop(seg(T, 17.0, 17.4)) * (1 + 0.08 * Math.sin(T * 6))); }
  }

  // ---------- 對話框 ----------
  BUBBLES.forEach((b) => {
    const el = document.createElement('div');
    el.className = 'bubble ' + b.who + (b.who === 'off' ? ' notail' : '') + (b.cls ? ' ' + b.cls : '');
    el.innerHTML = '<span class="who">' + b.name + '</span>' + b.text;
    layer.appendChild(el); b.el = el;
  });
  let FW = 360, FH = 640, showB = true;
  function placeBubbles(T) {
    BUBBLES.forEach((b) => {
      const on = showB && T >= b.from && T < b.to;
      // 彈出、淡出都由時間算，逐格輸出才會一致
      b.el.style.opacity = on ? clamp01((T - b.from) / 0.12) * clamp01((b.to - T) / 0.15) : 0;
      b.el.style.transform = 'translate(-50%, -100%) scale(' + (0.55 + 0.45 * pop(seg(T, b.from, b.from + 0.32))) + ')';
      if (!on) return;
      let ax, ay;
      if (b.who === 'off') { ax = FW / 2; ay = FH * 0.16; }
      else { tmp.copy(headTop(b.who === 'kid' ? kid : uncle, 1.35)).project(cam); ax = (tmp.x + 1) / 2 * FW; ay = (1 - tmp.y) / 2 * FH - 14; }
      const w = b.el.offsetWidth, m = 10;
      const cx = Math.max(w / 2 + m, Math.min(FW - w / 2 - m, ax));
      b.el.style.left = cx + 'px';
      b.el.style.top = Math.max(b.el.offsetHeight + m, ay) + 'px';
      b.el.style.setProperty('--tx', Math.max(-w / 2 + 22, Math.min(w / 2 - 22, ax - cx)) + 'px');
    });
  }

  // ---------- 控制列 ----------
  let T = 0, playing = false, pre = 0, last = performance.now();
  const chips = SCENES.map((s) => {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = s.name;
    b.addEventListener('click', () => { pause(); T = s.at; });
    $('#chips').appendChild(b); return b;
  });
  function updPlay() { $('#play').textContent = playing ? '❚❚ 暫停' : (T >= END ? '↺ 重播' : '▶ 播放'); }
  function play() { if (T >= END) T = 0; playing = true; pre = 0.6; document.body.classList.add('rec'); updPlay(); }
  function pause() { playing = false; document.body.classList.remove('rec'); updPlay(); }
  $('#play').addEventListener('click', () => { playing ? pause() : play(); });
  $('#gl').addEventListener('click', () => { if (playing) pause(); });
  $('#scrub').addEventListener('input', (e) => { pause(); T = +e.target.value; });
  $('#showBubbles').addEventListener('change', (e) => { showB = e.target.checked; });
  function ui(T) {
    $('#scrub').value = T; $('#time').textContent = T.toFixed(1) + ' 秒';
    let cur = 0; SCENES.forEach((s, i) => { if (T >= s.at) cur = i; });
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === cur)));
  }

  function resize() {
    FW = frameEl.clientWidth; FH = frameEl.clientHeight;
    renderer.setSize(FW, FH, false); cam.aspect = FW / FH; cam.updateProjectionMatrix();
    layer.style.fontSize = Math.max(14, FW * 0.056) + 'px';
    frameEl.style.setProperty('--fw', FW + 'px');
  }
  window.addEventListener('resize', resize); resize();

  function render() { camAt(T); pose(T); renderer.render(scene, cam); placeBubbles(T); ui(T); }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing) {
      if (pre > 0) pre -= dt;
      else { T += dt; if (T >= END) { T = END; playing = false; updPlay(); setTimeout(() => { if (!playing) document.body.classList.remove('rec'); }, 900); } }
    }
    render(); requestAnimationFrame(loop);
  }

  // 字型載入後再畫文字貼圖，不然會用到系統字
  const fontsReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('400 80px Huninn'), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  fontsReady.then(() => {
    // 重畫用 Huninn 的文字貼圖
    const redo = (sp, draw) => { const cv = sp.material.map.image; const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); draw(x, cv.width); sp.material.map.needsUpdate = true; };
    redo(bigQ, textDraw('?', '#ff8fa3'));
    qs.forEach((q, i) => redo(q, textDraw('?', ['#ffc93c', '#8fd0ff', '#ff8fa3'][i])));
    stars.forEach((s) => redo(s, textDraw('★', '#ffc93c')));
  });
  window.__story = { set: (t) => { pause(); if (RENDER) document.body.classList.add('rec'); T = t; render(); }, END: END, fontsReady: fontsReady };
  requestAnimationFrame(loop);
})();
