// 文字內容：kid＝小朋友看的一句話（短）；why＝為什麼要這樣摺；adult＝給大人的說明（有出處）；src＝出處代號
var Content = (function () {
  var S = {
    paper: { kid: '拿一張 A4 紙，直直放好。', why: '紙平平的，飛機才不會歪。', adult: '一般 A4 影印紙就可以（約 5 公克）。先把紙壓平，有皺摺的紙左右會不一樣，飛出去容易偏。', src: [] },
    crease: { kid: '對摺，再打開。', why: '中間這條線是背脊，左右都要對準它。', adult: '先壓出中線，後面每一摺都以它為準，左右兩邊才會一樣。左右不對稱，兩邊翅膀的升力就不一樣，飛機會傾斜、轉彎。', src: ['roll'] },
    corners: { kid: '上面兩個角，摺到中間線。', why: '頭變尖，好切開空氣。', adult: '尖的機頭迎風的面積小，空氣擋住它的力量（阻力）比較小，飛機比較能保持速度。', src: ['drag'] }
  };
  function half(kidExtra) {
    return { kid: '沿中間線對摺' + kidExtra, why: '這塊是飛機的肚子，手捏這裡。', adult: '下面這塊叫機身，讓手有地方捏，也像船底一樣，讓飛機比較不會左右晃。', src: [] };
  }
  function wing1(note) { return { kid: '上面那片往下摺，變成翅膀。', why: '翅膀是空氣托住的地方。', adult: '飛機往前飛時，翅膀和迎面而來的空氣有一個小角度，空氣被翅膀往下推，翅膀就被往上推，這就是升力。' + (note || ''), src: ['lift'] }; }
  var wing2 = { kid: '翻過來，另一邊也一樣摺。', why: '兩邊一樣大，才會直直飛。', adult: '兩邊翅膀大小或角度不一樣，一邊升力大、一邊升力小，飛機就會傾斜，然後轉彎。可以把兩片疊在一起比比看。', src: ['roll'] };
  var openStep = { kid: '打開翅膀，變成小小的 V 字。', why: '像小鳥張開翅膀，飛得穩。', adult: '翅膀稍微往上翹叫做「上反角」。飛機往一邊傾斜時，低的那邊翅膀會得到比較多升力，把飛機推回水平。紅色的點是重心（平衡點），是用每一層紙的位置算出來的。', src: ['dihedral'] };

  // 角色卡：persona＝個性；stats＝速度、滑很久、很穩、好摺（1～5，依模擬結果與摺法步驟數給的大概值）
  // parts＝摺好後 3D 模型上的部位標籤；at＝nose 機頭、wing 左翅膀、tip 右翼尖往上立的地方、tail 右翅膀後緣、cg 重心
  var planes = {
    dart: {
      name: '尖頭鏢', tag: '又快又直', color: '#2f7fd1', power: 4,
      persona: '急性子的賽跑選手', tags: ['又快又直', '用力丟', '最好摺'],
      stats: [5, 2, 3, 5],
      tips: '小撇步：用力、平平的丟。',
      story: '小鏢最愛比快！它的頭尖尖的，可以把空氣切開，衝得飛快。可是它的翅膀很小，跑慢了就飛不起來，所以要用力丟它。',
      move: { name: '切開空氣', kid: '頭尖尖的，空氣擋不住它。', adult: '尖的機頭迎風面積小、形狀比較流線，阻力小，飛機比較能保持速度。翅膀小，則要比較快的速度才有足夠的升力（升力和速度的平方、翅膀面積成正比），所以適合用力丟。', src: ['drag', 'liftEq'] },
      real: { title: '真的飛機也是', kid: '很快的噴射機，頭也是尖尖的，為的就是減少空氣的阻力。', src: ['drag'] },
      parts: [
        { at: 'nose', name: '尖尖的頭', kid: '把空氣切開，阻力小。', adult: '迎風面積小、比較流線的形狀，阻力比較小。', src: ['drag'] },
        { at: 'wing', name: '小小的翅膀', kid: '翅膀小，要飛快才撐得住。', adult: '升力和翅膀面積、速度的平方成正比；翅膀小就要靠速度。', src: ['liftEq'] },
        { at: 'cg', name: '紅點：重心', kid: '平衡點在前面，飛得穩。', adult: '紙一層層疊在機頭，重心往前；重心在升力中心稍前，飛機比較穩。', src: ['cg'] },
        { at: 'grip', name: '手捏這裡', kid: '大拇指和食指輕輕捏住肚子，在紅點前面一點。', adult: '捏在機身下方、靠近重心（稍微前面）的地方，放手時飛機比較不會被扭歪；不要捏太緊，以免把摺痕壓壞。丟的時候翅膀保持和地面平行，從肩膀旁邊伸直手臂往前送，再放手。', src: ['throwTips', 'cg'] }
      ],
      src: ['dartFold'],
      steps: {
        paper: S.paper, crease: S.crease, corners: S.corners,
        corners2: { kid: '斜邊再摺到中間一次。', why: '紙疊在前面，頭變重。', adult: '前面的紙越多，整架飛機的重心（平衡點）就越往前。重心稍微偏前，飛機比較穩、不會抬頭翻掉；但太前面又會一直往下栽。', src: ['cg'] },
        half: half('，摺好的部分包在裡面。'),
        wing1: wing1(''), wing2: wing2, open: openStep
      }
    },
    glider: {
      name: '大翅膀滑翔機', tag: '慢慢飄', color: '#2e9e7a', power: 1,
      persona: '愛慢慢散步的雲朵旅行家', tags: ['慢慢飄', '輕輕推', '飛最久'],
      stats: [1, 5, 3, 4],
      tips: '小撇步：輕輕推出去就好。',
      story: '阿滑有一對大大的翅膀，空氣一托就飄起來。它不喜歡被用力丟，太快會嚇得抬頭、停住、掉下來。輕輕一推，它就能慢慢飄好久。',
      move: { name: '慢慢飄', kid: '翅膀大，空氣托得多，慢慢飛也不會掉。', adult: '同樣重的飛機，翅膀越大，每一塊翅膀要撐的重量越少，飛得慢也有足夠的升力，所以能慢慢滑、飛很久。可是用力丟，升力一下子太大，飛機會爬升、變慢，最後失速。', src: ['wingLoad', 'stall'] },
      real: { title: '真的飛機也有', kid: '很多大飛機的翅膀尖端，也有往上翹的小翅膀喔！', src: ['winglet'] },
      parts: [
        { at: 'wing', name: '大大的翅膀', kid: '翅膀大，空氣托得多。', adult: '翅膀面積大，低速就有足夠升力，可以慢慢滑。', src: ['wingLoad'] },
        { at: 'tip', name: '立起來的小翼', kid: '像小擋板，讓它飛得直。', adult: '立起來的翼尖可以幫忙保持方向。真飛機的「翼尖小翼」用來減弱翼尖的漩渦、降低阻力。', src: ['winglet'] },
        { at: 'nose', name: '鈍鈍的頭', kid: '摺進一小段，頭重一點才穩。', adult: '前面多一小段紙，重心往前；大翅膀的飛機尤其需要前面有一點重量。', src: ['cg'] },
        { at: 'grip', name: '手捏這裡', kid: '大拇指和食指輕輕捏住肚子，在紅點前面一點。', adult: '捏在機身下方、靠近重心（稍微前面）的地方，放手時飛機比較不會被扭歪；不要捏太緊，以免把摺痕壓壞。丟的時候翅膀保持和地面平行，從肩膀旁邊伸直手臂往前送，再放手。', src: ['throwTips', 'cg'] }
      ],
      src: ['wingLoad'],
      steps: {
        paper: S.paper, crease: S.crease, corners: S.corners,
        nose: { kid: '尖頭往下摺一小段。', why: '頭鈍一點、重一點。', adult: '鈍頭比較耐撞。把一小段紙摺在前面，也讓重心往前，大翅膀的飛機尤其需要前面有一點重量才會穩。', src: ['cg'] },
        half: half('，摺好的部分包在裡面。'),
        wing1: wing1('這架的摺線很靠近中間，所以翅膀特別大。'), wing2: wing2,
        tip: { kid: '翅膀最外面，立起一小片。', why: '像小擋板，讓飛機不亂轉。', adult: '立起來的翼尖可以幫忙保持方向。真的飛機也有類似的「翼尖小翼」，用來減少翼尖捲起的漩渦。', src: ['winglet'] },
        open: openStep
      }
    },
    lock: {
      name: '鎖頭飛機', tag: '穩又遠', color: '#c8611f', power: 3,
      persona: '穩重可靠的老隊長', tags: ['穩又遠', '中等力氣', '頭最重'],
      stats: [3, 3, 5, 2],
      tips: '小撇步：中等力氣、平平的丟。',
      story: '隊長的頭上有一把小小的三角形鎖，把紙牢牢鎖住。它的頭比較重，不容易抬頭停住，也不容易往下栽，每次都穩穩的飛出去。',
      move: { name: '三角形鎖', kid: '小三角把紙鎖住，頭重重的，飛得穩。', adult: '這種摺法叫「中村鎖」（Nakamura lock）。往下摺的三角形讓前半段變厚、重心往前，最後用小三角形把紙固定住，飛行時不會鬆開。', src: ['lockFold', 'cg'] },
      real: { title: '鎖的故事', kid: '這把鎖是一位叫中村（Nakamura）的紙飛機設計師想出來的，所以叫「中村鎖」。', src: ['lockFold'] },
      parts: [
        { at: 'nose', name: '三角形鎖', kid: '把紙鎖住，不會散開。', adult: '中村鎖：小三角形把前面的紙固定住，重量也集中在前面。', src: ['lockFold'] },
        { at: 'cg', name: '紅點：重心', kid: '頭重重的，飛得最穩。', adult: '前半段紙最多，重心偏前，不容易抬頭失速。', src: ['cg'] },
        { at: 'wing', name: 'V 字翅膀', kid: '像小鳥張開翅膀，不會翻來翻去。', adult: '上反角：飛機往一邊傾斜時，低的那邊翅膀升力比較多，會把飛機推回水平。', src: ['dihedral'] },
        { at: 'grip', name: '手捏這裡', kid: '大拇指和食指輕輕捏住肚子，在紅點前面一點。', adult: '捏在機身下方、靠近重心（稍微前面）的地方，放手時飛機比較不會被扭歪；不要捏太緊，以免把摺痕壓壞。丟的時候翅膀保持和地面平行，從肩膀旁邊伸直手臂往前送，再放手。', src: ['throwTips', 'cg'] }
      ],
      src: ['lockFold'],
      steps: {
        paper: S.paper, crease: S.crease, corners: S.corners,
        down: { kid: '整個尖頭往下摺。', why: '紙都集中到前面。', adult: '摺下來的三角形讓前半段變厚，重心往前移。下一步會用它的尖端把紙鎖住。', src: ['cg'] },
        corners3: { kid: '兩個角摺到中間，下面露出小三角。', why: '頭又變尖，還變厚。', adult: '兩個角要在中線上碰在一起，下面留一個小小的三角形尖端，等一下要用它來「上鎖」。', src: [] },
        lock: { kid: '小三角往上摺，壓住兩片。', why: '這是「鎖」，紙不會散開。', adult: '這種摺法叫做中村鎖（Nakamura lock）。小三角形把前面的紙固定住，飛行時不會鬆開，重量也集中在前面。', src: ['lockFold'] },
        half: half('，往後摺，小三角留在外面。'),
        wing1: wing1(''), wing2: wing2, open: openStep
      }
    },
    stunt: {
      name: '翹尾巴特技機', tag: '會翻圈', color: '#a8489c', power: 2,
      persona: '愛表演的空中特技演員', tags: ['會翻圈', '尾巴翹', '愛表演'],
      stats: [2, 2, 1, 4],
      tips: '小撇步：想翻圈，就用力往上丟。',
      story: '小翹的尾巴翹起來，風一吹，尾巴被壓下去，頭就抬起來。用力丟，它會在天空翻一個大圈圈！可是翻圈很花力氣，所以它飛不遠。',
      move: { name: '翻筋斗', kid: '尾巴翹起來，頭一直往上抬，就翻圈了。', adult: '翅膀後緣往上翹，迎面的空氣把尾巴往下壓，機頭就抬起來。丟得越快，升力越大，飛機一直往上彎，最後翻一圈。翻圈會用掉很多速度，所以飛不遠。', src: ['elevator', 'liftEq'] },
      real: { title: '真的飛機也有', kid: '真飛機尾巴上有「升降舵」，也是這樣讓飛機抬頭、低頭。', src: ['elevator'] },
      parts: [
        { at: 'tail', name: '翹起來的尾巴', kid: '風把尾巴往下壓，頭就抬起來。', adult: '後緣上翹，作用和真飛機的升降舵一樣，讓機頭抬起。', src: ['elevator'] },
        { at: 'wing', name: '大大的翅膀', kid: '翅膀大，輕輕丟也能飄。', adult: '翅膀面積大，低速就有升力；配上翹尾巴，速度一快就容易翻圈。', src: ['wingLoad'] },
        { at: 'cg', name: '紅點：重心', kid: '頭沒有比較重，很愛抬頭。', adult: '沒有在機頭多疊紙，重心比較後面，加上尾巴上翹，機頭容易抬起。', src: ['cg'] },
        { at: 'grip', name: '手捏這裡', kid: '大拇指和食指輕輕捏住肚子，在紅點前面一點。', adult: '捏在機身下方、靠近重心（稍微前面）的地方，放手時飛機比較不會被扭歪；不要捏太緊，以免把摺痕壓壞。丟的時候翅膀保持和地面平行，從肩膀旁邊伸直手臂往前送，再放手。', src: ['throwTips', 'cg'] }
      ],
      src: ['elevator'],
      steps: {
        paper: S.paper, crease: S.crease, corners: S.corners,
        half: half('，摺好的部分包在裡面。'),
        wing1: wing1(''), wing2: wing2,
        flap: { kid: '翅膀最後面，往上摺一小條。', why: '尾巴翹，頭就會抬起來。', adult: '翅膀後緣往上翹，迎面的空氣會把它往下壓。後面被壓下去，前面的機頭就抬起來，這和真飛機的「升降舵」是同一個道理。', src: ['elevator'] },
        open: openStep
      }
    }
  };
  var statNames = ['速度', '滑很久', '很穩', '好摺'];

  // 飛行結果
  var verdicts = {
    smooth: { kid: '飛得好順！', adult: '重心、尾巴角度和丟的速度剛好配合，升力差不多撐住重量，飛機穩穩的滑下來。紙飛機沒有引擎，只靠一開始丟出去的速度和高度，慢慢滑翔。', src: ['forces', 'glide'] },
    dive: { kid: '咻——直直往下衝！', adult: '機頭太重（重心太前面）或往下丟，翅膀的角度太小、升力不夠撐住重量，飛機就往下衝。試試拿掉迴紋針，或把尾巴翹一點。', src: ['cg', 'elevator'] },
    stall: { kid: '抬頭抬太高，停住、掉下來！', adult: '翅膀和空氣的角度太大、速度又太慢，翅膀上面的氣流會亂掉，升力突然變小，這叫做「失速」。丟輕一點、尾巴少翹一點，或在機頭加一個迴紋針。', src: ['stall'] },
    wave: { kid: '一高一低，像在坐雲霄飛車。', adult: '往上爬會變慢，升力變小又往下掉；往下掉速度變快，升力變大又爬上去。這種一高一低的波浪叫做「長週期振盪」。機頭加一點重量通常可以讓它平順一些。', src: ['phugoid'] },
    loop: { kid: '哇！翻了一個圈！', adult: '丟得很快（或尾巴翹得多），升力比重量大很多，飛機一直往上彎，最後翻了一圈，這就是特技飛行的「翻筋斗」。翻圈會浪費很多速度，想飛遠就丟輕一點、尾巴放平。', src: ['elevator', 'liftEq'] },
    turn: { kid: '飛機轉彎了！', adult: '左右兩邊翅膀不一樣，一邊升力大、一邊小，飛機就傾斜。升力跟著斜一邊，把飛機往旁邊拉，就開始轉彎。想直直飛，要讓兩邊一樣。', src: ['roll'] },
    drop: { kid: '太輕了，馬上就掉下來。', adult: '速度不夠，升力就不夠。升力跟速度的平方有關：速度少一半，升力只剩大約四分之一。', src: ['liftEq'] }
  };

  // 「為什麼」頁
  var forces = [
    { key: 'lift', name: '升力', who: '空氣往上托', color: 'var(--lift)', text: '飛越快，托得越大。', src: ['forces', 'lift'] },
    { key: 'weight', name: '重力', who: '地球往下拉', color: 'var(--weight)', text: '所有東西都會被往下拉。', src: ['forces'] },
    { key: 'thrust', name: '推力', who: '你的手往前推', color: 'var(--thrust)', text: '只有丟出去的那一下。', src: ['forces', 'glide'] },
    { key: 'drag', name: '阻力', who: '空氣擋在前面', color: 'var(--drag)', text: '讓飛機越飛越慢。', src: ['forces', 'drag'] }
  ];
  var forcesAdult = '紙飛機沒有引擎，推力只有手丟出去的那一下，之後就靠滑翔：升力撐住重力，阻力讓它慢慢變慢。升力跟速度的平方有關，飛得越快升力越大。';
  var ideas = [
    { title: '重心：平衡點', kid: '用手指頂住飛機肚子，找到不會倒的地方。', adult: '重心在翅膀比較前面的位置，飛機會像風向雞一樣自己把頭擺正，比較穩。重心太前面會往下栽，太後面會抬頭失速。紙飛機最簡單的調法，就是在機頭夾迴紋針。', src: ['cg'], try: { label: '夾 2 個迴紋針', plane: 'dart', knobs: { clips: 2, tail: 0, power: 4, angle: 0, asym: 0 } } },
    { title: '尾巴翹：頭抬起來', kid: '翅膀後面翹起來，頭就會抬起來。', adult: '後緣往上翹，空氣把尾巴往下壓，機頭就抬起來，這和真飛機的升降舵一樣。翹一點點可以修正往下栽；翹太多會一直抬頭、失速，或翻圈。', src: ['elevator'], try: { label: '尾巴翹最高', plane: 'stunt', knobs: { clips: 0, tail: 3, power: 5, angle: 10, asym: 0 } } },
    { title: '左右一樣：直直飛', kid: '兩邊翅膀不一樣，就會轉彎。', adult: '右邊翅膀後緣往上翹一點，右邊升力變小、右邊往下沉，飛機向右傾斜，就往右轉。真飛機用「副翼」做同樣的事。', src: ['roll'], try: { label: '讓它右轉', plane: 'lock', knobs: { clips: 0, tail: 0, power: 3, angle: 0, asym: 2 } } },
    { title: '翅膀大小：快或慢', kid: '大翅膀飛得慢又久，小翅膀飛得快又直。', adult: '同樣重的飛機，翅膀越大，每一塊翅膀要撐的重量越少，不用飛很快就有足夠的升力，所以可以慢慢滑、飛很久。小翅膀要靠速度，適合用力丟。', src: ['wingLoad'], try: { label: '輕輕推滑翔機', plane: 'glider', knobs: { clips: 0, tail: 0, power: 1, angle: 0, asym: 0 } } },
    { title: '太用力也不行', kid: '有些飛機要輕輕推，太用力反而會掉下來。', adult: '速度快，升力就大很多（跟速度的平方有關）。大翅膀的飛機被用力丟出去，升力太大，會一直往上爬，最後太慢而失速。', src: ['liftEq', 'stall'], try: { label: '用力丟滑翔機', plane: 'glider', knobs: { clips: 0, tail: 0, power: 5, angle: 10, asym: 0 } } }
  ];

  var missions = [
    { id: 'island', name: '降落在小島上', kid: '讓飛機停在 6 公尺遠的小島上。', hint: '試試不同的力氣。鎖頭飛機用輕輕的力氣，或尖頭鏢用中等力氣都可以試試。', plane: null, knobs: null, island: { x: 6, z: 0, r: 0.9 } },
    { id: 'fix', name: '修好愛栽頭的飛機', kid: '這架尖頭鏢一直往下衝，讓它飛超過 6 公尺。', hint: '它的頭太重了。拿掉迴紋針，或把尾巴翹一點。', plane: 'dart', knobs: { clips: 2, tail: 0, power: 4, angle: 0, asym: 0 }, goal: { minDist: 6 } },
    { id: 'turn', name: '讓飛機轉彎', kid: '讓飛機降落在跑道外面，離中間 2 公尺以上。', hint: '讓左右兩邊不一樣。', plane: null, knobs: null, goal: { minSide: 2 } },
    { id: 'loop', name: '翻一個圈圈', kid: '讓飛機在空中翻一圈。', hint: '尾巴翹高、用力往上一點丟。翹尾巴特技機最容易。', plane: null, knobs: null, goal: { loop: true } },
    { id: 'long', name: '飛得最久', kid: '讓飛機在空中待 3 秒以上。', hint: '大翅膀的飛機、輕輕推、往上一點點，翅膀後面也翹一點點。', plane: null, knobs: null, goal: { minTime: 3 } }
  ];

  // 出處（2026-11-16 逐一開啟確認）
  var sources = {
    forces: [{ t: 'Four Forces on an Airplane', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/four-forces-on-an-airplane/', n: '飛機在空中受到重力、升力、阻力、推力四種力。' }],
    glide: [
      { t: 'Three Forces on a Glider', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/three-forces-on-a-glider', n: '滑翔機沒有引擎、不產生推力，只受升力、重力、阻力；並寫到紙飛機是最簡單的滑翔機。' },
      { t: 'How do paper planes fly?', p: 'Smithsonian National Air and Space Museum', u: 'https://howthingsfly.si.edu/ask-an-explainer/how-do-paper-planes-fly', n: '紙飛機沒有引擎，飛行的能量來自丟它的人。' }
    ],
    lift: [{ t: 'Four Forces on an Airplane', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/four-forces-on-an-airplane/', n: '升力由飛機在空氣中移動產生，主要來自翅膀。' }],
    liftEq: [{ t: 'Lift Equation', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation', n: '升力和空氣密度、速度的平方、翅膀面積有關。' }],
    drag: [{ t: 'Shape Effects on Drag', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/', n: '物體的形狀對阻力影響很大，平板最大、流線形最小。' }],
    cg: [
      { t: 'Advanced Paper Airplane Trimming', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/paper-airplane-trimming.php', n: '重心通常放在升力中心稍微前面最好，可以在機頭加小重物調整。' },
      { t: 'Common Paper Airplane Problems & Solutions', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/paper-plane-solutions.php', n: '機頭往下栽通常是太重，拿掉迴紋針或把後緣往上摺；一上一下或失速，可在機頭加小迴紋針。' },
      { t: 'Paper Airplane Printout（含迴紋針實驗）', p: 'Smithsonian National Air and Space Museum', u: 'https://howthingsfly.si.edu/sites/default/files/paper-airplane/NASM_paper_plane_printout_b1p9i2.pdf', n: '迴紋針夾在尾巴機頭會抬起，夾在機頭會往下。' }
    ],
    elevator: [
      { t: 'Pitch Interactive', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/pitch', n: '紙飛機兩翼後緣往上摺，尾巴往下、機頭往上，可能會翻圈。' },
      { t: 'Advanced Paper Airplane Trimming', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/paper-airplane-trimming.php', n: '兩邊升降舵往上摺，機頭會抬起。' }
    ],
    stall: [
      { t: 'Effects of Inclination on Lift', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/incline', n: '翅膀和氣流的角度太大時，升力會突然變小。' },
      { t: 'Common Paper Airplane Problems & Solutions', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/paper-plane-solutions.php', n: '紙飛機爬太陡、速度掉太多就會失速。' }
    ],
    dihedral: [
      { t: 'Wing Geometry', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/wing-geometry', n: '上反角讓飛機左右滾轉時比較穩，被輕輕推歪後會自己回正。' },
      { t: 'Advanced Paper Airplane Trimming', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/paper-airplane-trimming.php', n: '紙飛機翅膀有一點上反角會比較穩。' }
    ],
    roll: [
      { t: 'Ailerons', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ailerons/', n: '副翼讓一邊升力變大、一邊變小，飛機傾斜後轉彎。' },
      { t: 'Advanced Paper Airplane Trimming', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/paper-airplane-trimming.php', n: '紙飛機會往後緣翹起來的那一邊滾轉。' }
    ],
    phugoid: [
      { t: 'Common Paper Airplane Problems & Solutions', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/paper-plane-solutions.php', n: '紙飛機一上一下（porpoising），通常在機頭加小迴紋針就會改善。' },
      { t: 'Phugoid', p: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/Phugoid', n: '飛機抬頭爬升、再低頭下降的長週期運動。' }
    ],
    wingLoad: [
      { t: 'Paper Airplane Tips for Success', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/tips-for-success.php', n: '寬翅膀的紙飛機飛得比較慢、滑得比較久；窄翅膀飛得快。' },
      { t: 'Lift Equation', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation', n: '升力和翅膀面積成正比。' }
    ],
    parts: [{ t: 'Airplane Parts and Function', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/airplane-parts-function', n: '機翼產生大部分升力；水平尾翼與升降舵管機頭上下、垂直尾翼與方向舵管左右偏擺；副翼讓飛機滾轉；引擎提供推力克服阻力。' }],
    shape: [{ t: 'Effects of Shape on Lift Interactive', p: 'NASA Glenn Research Center', u: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape/', n: '升力取決於氣流被轉向多少；機翼後段往下彎升力變大，往上翹升力變小甚至變負。' }],
    throwTips: [{ t: 'Paper Airplane Tips for Success', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/aerodynamics/tips-for-success.php', n: '先把飛機拿在肩膀旁邊，手臂往前伸直再放手；大多時候放手時翅膀要和地面平行。有的飛機喜歡用力丟，有的喜歡輕輕推。' }],
    catalog: [{ t: "Fold 'N Fly Paper Airplanes", p: "Fold 'N Fly", u: 'https://www.foldnfly.com/', n: '收錄 58 種紙飛機摺法，可依類型（距離、滯空、特技、造型）、難度、是否要剪刀篩選。' }],
    hoop: [{ t: 'Hoop Glider', p: 'Florida Museum of Natural History', u: 'https://www.floridamuseum.ufl.edu/educators/resource/hoop-glider/', n: '吸管加大小兩個紙圈；5～13 歲，15～30 分鐘；小圈在前，像丟標槍一樣輕輕擲出。' }],
    ring: [{ t: 'The Ring Wing Glider', p: 'NASA Jet Propulsion Laboratory', u: 'https://www.jpl.nasa.gov/edu/resources/lesson-plan/the-ring-wing-glider/', n: '3～8 年級的教學活動：一張紙斜摺後捲成環狀滑翔機，膠帶可有可無。' }],
    whirly: [{ t: 'Make a Whirlybird from Paper', p: 'Scientific American', u: 'https://www.scientificamerican.com/article/make-a-whirlybird-from-paper/', n: '需要紙、剪刀、迴紋針；旋轉的葉片產生升力抵抗重力而慢慢落下；請大人協助從安全的高處放下。' }],
    ufo: [{ t: 'The UFO', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/13.html', n: '圓盤狀的紙飛機，會繞大圈慢慢飄；中等難度，需要剪刀。' }],
    space: [{ t: 'Space Fighter', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/54.html', n: '特技機，在空中快速閃動；中等難度。' }],
    suzanne: [
      { t: 'Is this the farthest ever flight by a paper airplane?', p: 'Guinness World Records', u: 'https://www.guinnessworldrecords.com/news/2012/2/video-is-this-the-farthest-ever-flight-by-a-paper-airplane', n: 'John Collins 設計、Joe Ayoob 擲出 226 英尺 10 英寸（約 69.14 公尺），2012 年。' },
      { t: 'The Perfect Paper Airplane', p: 'Mental Floss', u: 'https://www.mentalfloss.com/article/54488/perfect-paper-airplane', n: '介紹 John Collins 設計的紀錄機「Suzanne」。' },
      { t: 'World Record Paper Airplanes', p: "Fold 'N Fly", u: 'https://www.foldnfly.com/lounge/world-record-paper-airplanes.php', n: 'Joe Ayoob 69.14 公尺（2012 年 2 月）；目前紀錄 98.43 公尺（2025 年 12 月，上海）。' }
    ],
    ninomiya: [{ t: 'Yasuaki Ninomiya', p: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/Yasuaki_Ninomiya', n: '日本飛機設計師，設計 WhiteWings 厚紙飛機系列；美國國家航空太空博物館策展人稱為「紙飛機界的法拉利」。' }],
    jets: [{ t: 'Awesome Origami Aircraft（書評）', p: "Gilad's Origami Page", u: 'https://www.giladorigami.com/BO_AwesomeAircraft.html', n: 'Tem Boun 著，18 款戰鬥機加 1 個展示架，中高級；書評寫明這些模型不是會飛的類型。' }],
    stealth: [{ t: 'Stealth Aircraft Origami', p: 'Search Press（Dover Publications）', u: 'https://searchpress.com/book/9780486824246/stealth-aircraft-origami', n: 'Jayson Merrill 著，8 款隱形飛機（B-2、F-117、F-22、F-35 等），給進階摺紙者。' }],
    winglet: [{ t: 'Winglets Save Billions of Dollars in Fuel Costs', p: 'NASA Spinoff', u: 'https://spinoff.nasa.gov/node/10666', n: '翼尖小翼減弱翼尖渦流，降低阻力。' }],
    dartFold: [{ t: 'How to Build Your Paper Airplane – The Dart', p: 'Smithsonian National Air and Space Museum', u: 'https://howthingsfly.si.edu/sites/default/files/paper-airplane/NASM_paper_plane_printout_b1p9i2.pdf', n: '尖頭鏢的步驟摺法。' }],
    lockFold: [{ t: 'Nakamura lock plane', p: 'CSIRO Double Helix', u: 'https://blog.doublehelix.csiro.au/nakamura-lock-plane', n: '中村鎖的步驟摺法，以紙飛機設計者 Eiji Nakamura 命名。' }],
    record: [
      { t: 'Farthest flight by a paper aircraft', p: 'Guinness World Records', u: 'https://www.guinnessworldrecords.com/world-records/farthest-flight-by-a-paper-aircraft', n: '98.43 公尺，Liu Liwen 等 6 人，2025-12-28，上海。' },
      { t: 'Longest flying paper aircraft – duration', p: 'Guinness World Records', u: 'https://www.guinnessworldrecords.com/world-records/longest-time-flying-a-paper-aircraft', n: '31.2 秒，Tang Shuai、Yang Shian、Liu Liwen 等 7 人，2026-02-11，江蘇崑山。' }
    ]
  };

  // 紙飛機 vs 真飛機（部位對照）；step＝摺紙步驟 key 對應到哪一個部位
  var compare = [
    { key: 'nose', name: '機頭', kid: '頭重一點，飛機才會自己擺正。',
      paper: '多摺幾層紙、夾迴紋針，頭就變重。尖尖的頭也比較好切開空氣。',
      real: '設計師會把重心放在翅膀前面一點，機頭做成圓滑的形狀。',
      adult: '重心在升力中心稍前面，飛機被吹得抬頭時，會自己把機頭壓回來，像風向雞一樣回正。紙飛機靠前面多疊幾層紙或夾迴紋針來調重心。流線形的機頭讓阻力變小。', src: ['cg', 'drag'] },
    { key: 'wing', name: '機翼', kid: '翅膀把空氣往下推，空氣就把飛機往上托。',
      paper: '平平的紙，斜斜的迎著風。打開成小小的 V 字。',
      real: '翅膀的切面彎彎的（叫「翼型」），更會托。很多飛機翅膀也是 V 字。',
      adult: '兩種翅膀產生升力的道理一樣：讓迎面的氣流轉向往下，空氣就把翅膀往上推；氣流被轉得越多，升力越大。真飛機的機翼剖面有弧度，能把氣流轉得更多；紙飛機的翅膀是平的，只靠迎風的角度讓氣流轉向，角度太大就會失速。翅膀微微往上翹（上反角）讓飛機左右比較穩。', src: ['parts', 'shape', 'stall', 'dihedral'] },
    { key: 'tail', name: '機尾', kid: '尾巴管「抬頭、低頭」，也讓飛機不亂甩。',
      paper: '翅膀後面兼當尾巴：往上摺一點，頭就抬起來。下面的機身像一片直直的尾巴。',
      real: '後面有平平的水平尾翼和直直的垂直尾翼，上面有會動的「舵」。',
      adult: '真飛機的水平尾翼和升降舵管機頭上下，垂直尾翼和方向舵管機頭左右，副翼讓飛機滾轉。大部分紙飛機沒有獨立的尾翼：翅膀後緣往上摺，作用就像升降舵（後段往上翹，那裡的升力變小，機頭抬起）；一邊翹起來就像副翼，會傾斜轉彎；機身那塊直立的紙，作用類似垂直尾翼。紙飛機的「舵」要在丟之前摺好，飛的時候不能再改。', src: ['parts', 'shape', 'elevator', 'roll'] },
    { key: 'engine', name: '引擎', kid: '紙飛機沒有引擎，你的手就是引擎！',
      paper: '只有丟出去的那一下有推力，之後一路滑下來。',
      real: '引擎一直往前推，所以能一直飛，還能往上爬。',
      adult: '有引擎的飛機靠推力抵消阻力；滑翔機沒有推力，只受升力、重力和阻力，用高度換速度，慢慢往下滑。紙飛機就是最簡單的滑翔機，飛行的能量全部來自丟它的人。', src: ['parts', 'glide'] }
  ];
  var stepPart = { crease: 'wing', corners: 'nose', corners2: 'nose', nose: 'nose', down: 'nose', corners3: 'nose', lock: 'nose', half: 'tail', wing1: 'wing', wing2: 'wing', tip: 'wing', flap: 'tail', open: 'wing' };
  var partPart = { nose: 'nose', cg: 'nose', wing: 'wing', tip: 'wing', tail: 'tail', grip: 'engine' };

  // 更多酷紙飛機（2026-11-16 逐一開啟確認）；fly：fly 會飛、spin 會轉著掉、look 造型；level：1 簡單～3 難
  var cool = [
    { icon: 'hoop', name: '吸管圈圈滑翔機', fly: 'fly', level: 1, needs: '吸管、剪刀、膠帶', kid: '一根吸管加兩個紙圈圈，小圈圈在前面，輕輕推出去！', adult: '佛羅里達自然史博物館的教學活動，標示 5～13 歲、大約 15～30 分鐘。大小兩個紙圈就是它的翅膀，空氣穿過圈圈產生升力。小圈在前，像丟標槍一樣輕輕往前推。', src: ['hoop'] },
    { icon: 'ring', name: '圈圈翅膀飛機', fly: 'fly', level: 1, needs: '一張紙（膠帶可有可無）', kid: '把紙摺好、捲成一個圈，丟出去會往前滑。', adult: 'NASA 噴射推進實驗室（JPL）的教學活動，標示 3～8 年級：紙斜對摺、再摺兩小摺，把兩端捲成環就能飛。6 歲小朋友可以和大人一起做。', src: ['ring'] },
    { icon: 'whirly', name: '紙直升機', fly: 'spin', level: 1, needs: '剪刀、迴紋針', kid: '放手後會一直轉圈圈，慢慢掉下來。', adult: '旋轉的葉片產生升力、抵抗重力，所以會慢慢落下。從高一點的地方放比較好玩，請大人幫忙（例如站在椅子上）。', src: ['whirly'] },
    { icon: 'ufo', name: '飛碟', fly: 'fly', level: 2, needs: '剪刀', kid: '圓圓的像飛碟，會慢慢的繞大圈圈。', adult: "Fold'N Fly 收錄的造型機，中等難度，第一步要剪掉一個角。", src: ['ufo'] },
    { icon: 'space', name: '太空戰機', fly: 'fly', level: 2, needs: '不用剪刀', kid: '長得像科幻電影的戰機，會在空中快速閃來閃去。', adult: "Fold'N Fly 收錄的特技機，中等難度，只要用摺的。", src: ['space'] },
    { icon: 'suzanne', name: '蘇珊號（Suzanne）', fly: 'fly', level: 3, needs: '一張 A4 紙', kid: '它曾經是世界上飛最遠的紙飛機，飛了 69 公尺！', adult: '由 John Collins 設計，2012 年 2 月由前美式足球四分衛 Joe Ayoob 擲出 69.14 公尺（226 英尺 10 英寸），是當時的紙飛機距離紀錄，後來已經被打破（現在是 98.43 公尺）。步驟多，需要大人主摺。', src: ['suzanne', 'record'] },
    { icon: 'glider', name: '剪貼滑翔機（White Wings）', fly: 'fly', level: 3, needs: '厚紙、剪刀、膠水', kid: '用厚紙剪下一片片零件再黏起來，像真的滑翔機！', adult: '日本飛機設計師二宮康明設計的厚紙飛機系列，美國國家航空太空博物館的策展人稱它們是「紙飛機界的法拉利」。要剪要黏，大人主做，小朋友幫忙塗膠、試飛。', src: ['ninomiya'] },
    { icon: 'jet', name: '摺紙戰鬥機', fly: 'look', level: 3, needs: '一張紙（進階摺法）', kid: '摺出 F-14、F-22 這些真的戰鬥機，擺在桌上超帥！', adult: 'Tem Boun 的書《Awesome Origami Aircraft》收錄 18 款戰鬥機摺紙（另有一個展示架），書評寫明這些是造型模型、不是用來飛的。難度屬中高級，適合大人摺給小朋友看。', src: ['jets'] },
    { icon: 'stealth', name: '隱形轟炸機', fly: 'look', level: 3, needs: '一張紙（進階摺法）', kid: '三角形的隱形飛機，看起來像外星飛船！', adult: 'Jayson Merrill 的書《Stealth Aircraft Origami》（Dover 出版）收錄 B-2、F-117、F-22、F-35 等 8 款隱形飛機，對象是進階摺紙者。書介沒有說能不能飛，這裡當作造型模型。', src: ['stealth'] }
  ];
  var coolAdult = "紙飛機的變化非常多，沒有一個固定的總數。光是 Fold'N Fly 網站就收錄了 58 種摺法，並分成四類：飛得遠、飛得久、特技、造型，還可以依難度和要不要剪刀篩選。";

  // 比賽第一名的原因
  var raceWhy = {
    dart: { kid: '用力丟，尖頭鏢衝最遠！', adult: '尖頭鏢阻力小、翅膀小，速度快的時候升力也不會大到讓它一直往上爬，所以能保持速度一路往前。', src: ['drag', 'liftEq'] },
    glider: { kid: '輕輕丟，大翅膀滑翔機飄最遠！', adult: '翅膀面積大，速度慢也有足夠的升力，可以慢慢滑下來。可是用力丟，升力太大，它會抬頭爬升、然後失速。', src: ['wingLoad', 'stall'] },
    lock: { kid: '中等力氣，鎖頭飛機最穩最遠！', adult: '鎖頭飛機前面重、重心偏前，不容易抬頭失速，也不容易往下栽。', src: ['cg'] },
    stunt: { kid: '這次特技機飄最遠！', adult: '特技機翅膀大，輕輕丟可以飄一下；但尾巴上翹，機頭一直想抬起來，用力丟就會翻圈，反而飛不遠。', src: ['elevator', 'wingLoad'] }
  };

  // 怎樣讓紙飛機飛得遠
  var farTips = [
    { title: '選對力氣', kid: '大翅膀輕輕推，尖頭鏢用力丟。', adult: '每架飛機有適合的速度。丟太用力，升力變得很大（跟速度的平方有關），飛機會一直往上爬、變慢，然後失速。', src: ['wingLoad', 'liftEq'] },
    { title: '頭重一點點', kid: '平衡點在前面一點，飛得最穩。', adult: '重心在翅膀升力中心稍微前面最穩。太後面會抬頭失速，太前面會一直往下栽；可以用迴紋針微調。', src: ['cg'] },
    { title: '平平的丟', kid: '往上丟太高，會停住掉下來。', adult: '往上丟太高，飛機先爬升、速度變慢，翅膀和氣流的角度變大，超過一定角度就失速。', src: ['stall'] },
    { title: '左右一樣', kid: '兩邊不一樣就會轉彎，飛不遠。', adult: '左右翅膀不對稱，一邊升力大、一邊小，飛機傾斜後轉彎，往前的距離就少了。', src: ['roll'] },
    { title: '頭尖、壓平', kid: '每一摺都用指甲壓平。', adult: '形狀越流線、表面越平，阻力越小，飛機越能保持速度。', src: ['drag'] }
  ];

  return { cool: cool, coolAdult: coolAdult, compare: compare, stepPart: stepPart, partPart: partPart, raceWhy: raceWhy, farTips: farTips, statNames: statNames, forcesAdult: forcesAdult, sources: sources, planes: planes, verdicts: verdicts, forces: forces, ideas: ideas, missions: missions };
})();
