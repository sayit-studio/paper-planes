// 四種機型的摺法（幾何）。文字內容放在 content.js。
var PlaneSpecs = (function () {
  var CENTER = [[0, 0], [0, 297]];
  var ALPHA = 8, DIHEDRAL = 6, OPEN = 90 + ALPHA + DIHEDRAL; // 機身 V 半角、上反角

  function crease() { return { key: 'crease', ops: [{ id: 'crease', line: CENTER, move: [-50, 150], dir: 'valley', crease: true }] }; }
  function corners() {
    return { key: 'corners', ops: [
      { id: 'cL', line: [[0, 297], [-105, 192]], move: [-100, 290], dir: 'valley' },
      { id: 'cR', line: [[0, 297], [105, 192]], move: [100, 290], dir: 'valley' }
    ] };
  }
  function half(dir) { return { key: 'half', ops: [{ id: 'half', line: CENTER, move: [-50, 150], dir: dir, setTag: 'L', otherTag: 'R' }] }; }
  // 對摺後：L 在上（谷摺）或在下（山摺）
  function wings(line, halfDir) {
    var topTag = halfDir === 'valley' ? 'L' : 'R', botTag = topTag === 'L' ? 'R' : 'L';
    return [
      { key: 'wing1', ops: [{ id: 'w' + topTag, line: line, move: [100, 60], dir: 'valley', tagFilter: topTag }] },
      { key: 'wing2', ops: [{ id: 'w' + botTag, line: line, move: [100, 60], dir: 'mountain', tagFilter: botTag }] }
    ];
  }
  function open(halfDir) {
    return { key: 'open', open: true, halfDir: halfDir, ops: [
      { unfold: 'wL', angle: OPEN }, { unfold: 'wR', angle: OPEN }, { unfold: 'half', angle: ALPHA * 2 }
    ] };
  }
  // 翅膀上的小摺：上面那片用谷摺、下面那片用山摺，飛行時兩邊都朝上
  function wingFlaps(key, line, move, angle, halfDir) {
    var topTag = halfDir === 'valley' ? 'L' : 'R', botTag = topTag === 'L' ? 'R' : 'L';
    return { key: key, ops: [
      { id: key + topTag, line: line, move: move, dir: 'valley', angle: angle, movedFilter: 'w' + topTag },
      { id: key + botTag, line: line, move: move, dir: 'mountain', angle: angle, movedFilter: 'w' + botTag }
    ] };
  }

  var dart = { id: 'dart', steps: [
    { key: 'paper', ops: [] },
    crease(), corners(),
    { key: 'corners2', ops: [
      { id: 'dL', line: [[0, 297], [-105, 43.5]], move: [-100, 150], dir: 'valley' },
      { id: 'dR', line: [[0, 297], [105, 43.5]], move: [100, 150], dir: 'valley' }
    ] },
    half('valley')
  ].concat(wings([[16, 297], [24, 0]], 'valley'), [open('valley')]) };

  var glider = { id: 'glider', steps: [
    { key: 'paper', ops: [] },
    crease(), corners(),
    { key: 'nose', ops: [{ id: 'nose', line: [[-105, 236], [105, 236]], move: [0, 290], dir: 'valley' }] },
    half('valley')
  ].concat(wings([[13, 236], [16, 0]], 'valley'), [
    wingFlaps('tip', [[-62, 0], [-62, 300]], [-90, 120], 85, 'valley'),
    open('valley')
  ]) };

  var lock = { id: 'lock', steps: [
    { key: 'paper', ops: [] },
    crease(), corners(),
    { key: 'down', ops: [{ id: 'down', line: [[-105, 170], [105, 170]], move: [0, 290], dir: 'valley' }] },
    { key: 'corners3', ops: [
      { id: 'eL', line: [[0, 170], [-105, 65]], move: [-100, 165], dir: 'valley' },
      { id: 'eR', line: [[0, 170], [105, 65]], move: [100, 165], dir: 'valley' }
    ] },
    { key: 'lock', ops: [{ id: 'lockTab', line: [[-105, 66], [105, 66]], move: [0, 46], dir: 'valley', movedFilter: 'down' }] },
    half('mountain')
  ].concat(wings([[14, 170], [22, 0]], 'mountain'), [open('mountain')]) };

  var stunt = { id: 'stunt', steps: [
    { key: 'paper', ops: [] },
    crease(), corners(),
    half('valley')
  ].concat(wings([[20, 297], [30, 0]], 'valley'), [
    wingFlaps('flap', [[-200, 20], [200, 20]], [0, 5], 40, 'valley'),
    open('valley')
  ]) };

  return { list: [dart, glider, lock, stunt], ALPHA: ALPHA };
})();
if (typeof module !== 'undefined') module.exports = PlaneSpecs;
