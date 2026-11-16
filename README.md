# 紙飛機小學堂

給小朋友的 3D 紙飛機教學網頁：一步一步摺、看懂機頭機翼機尾、四架一起比賽誰飛最遠。手機為主。

## 檔案

| 檔案 | 用途 |
|---|---|
| `src/fold-engine.js` | 摺紙引擎（直線谷摺／山摺、部分展開） |
| `src/planes.js` | 4 架飛機的摺線幾何 |
| `src/flight.js` | 簡化飛行模擬、找最遠丟法 |
| `src/content.js` | 所有文字、出處、角色卡、對照卡、酷紙飛機 |
| `src/app.js` | three.js r128 畫面與互動 |
| `src/template.html` | 版面與 CSS |
| `build.js` | 合成成單一 HTML（不需要安裝任何套件） |

## 建置

```bash
node build.js
```

輸出到 `dist/`：

- `index.html`：網站版（Cloudflare Pages 用）
- `paper-planes.html`：Claude Artifact 版
- `preview.html`：本機預覽用

本機預覽：`python -m http.server 8765 --directory dist`，開 http://localhost:8765/

## 測試

```bash
node test-fold.js
node test-flight.js
```

## 部署（Cloudflare Pages）

- Framework preset：None
- Build command：`node build.js`
- Build output directory：`dist`

外部資源：three.js 從 cdnjs 載入，字型用 Google Fonts。
