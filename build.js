const fs=require('fs');
const js=['fold-engine.js','planes.js','flight.js','content.js','app.js'].map(f=>fs.readFileSync('src/'+f,'utf8').replace(/^if \(typeof module.*$/m,'')).join('\n');
const tpl=fs.readFileSync('src/template.html','utf8');
const page=tpl.replace('<!--ENGINE-->','<script>\n'+js+'\n</script>');
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/paper-planes.html',page);
fs.writeFileSync('dist/preview.html','<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+page+'</body></html>');
// 網站版（Cloudflare Pages）：完整 HTML，title/字型/CSS 放 head，其餘放 body，深淺色跟著系統
const cut=page.indexOf('</style>')+'</style>'.length;
const desc='給小朋友的 3D 紙飛機教學：一步一步摺、看懂機頭機翼機尾、四架一起比賽誰飛最遠。';
const head='<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n'
 +'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
 +'<meta name="description" content="'+desc+'">\n'
 +'<meta property="og:title" content="紙飛機小學堂">\n<meta property="og:description" content="'+desc+'">\n<meta property="og:type" content="website">\n'
 +'<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Ctext y=%27.9em%27 font-size=%2790%27%3E%E2%9C%88%EF%B8%8F%3C/text%3E%3C/svg%3E">\n'
 +'<style>body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>\n';
fs.writeFileSync('dist/index.html',head+page.slice(0,cut)+'\n</head>\n<body>\n'+page.slice(cut)+'\n</body>\n</html>\n');
// 開場動畫（影片用）：story.html
const storyJs=['fold-engine.js','planes.js','story.js'].map(f=>fs.readFileSync('src/'+f,'utf8').replace(/^if \(typeof module.*$/m,'')).join('\n');
fs.writeFileSync('dist/story.html',fs.readFileSync('src/story.html','utf8').replace('<!--ENGINE-->','<script>\n'+storyJs+'\n</script>'));
console.log('ok', page.length);
