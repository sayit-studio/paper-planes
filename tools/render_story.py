"""把 dist/story.html 的 3D 開場動畫逐格輸出成 1080x1920、30fps 的 MP4（無聲）。

用法：
    node build.js
    python tools/render_story.py              # 全片
    python tools/render_story.py --from 10 --to 13   # 只輸出一段（檢查用）

輸出：out/story_1080x1920.mp4、out/sheet_story.jpg（縮圖表）
"""
import argparse
import json
import pathlib
import shutil
import subprocess

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'out'
FRAMES = OUT / 'frames'
FPS = 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='t0', type=float, default=0.0)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--bubbles', choices=['on', 'off'], default='on', help='是否畫對話框')
    args = ap.parse_args()

    shutil.rmtree(FRAMES, ignore_errors=True)
    FRAMES.mkdir(parents=True)
    url = (ROOT / 'dist' / 'story.html').as_uri() + '?render'

    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = browser.new_page(viewport={'width': 360, 'height': 640}, device_scale_factor=3)
        page.goto(url)
        page.wait_for_function('window.__story !== undefined')
        page.evaluate('window.__story.fontsReady')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(800)
        if args.bubbles == 'off':
            page.evaluate("document.querySelector('#showBubbles').click()")
        end = args.t1 if args.t1 is not None else page.evaluate('window.__story.END')
        n0, n1 = round(args.t0 * FPS), round(end * FPS)
        frame = page.locator('#frame')
        for k, i in enumerate(range(n0, n1)):
            page.evaluate(f'window.__story.set({i / FPS})')
            frame.screenshot(path=str(FRAMES / f'f{k:04d}.png'))
        browser.close()

    mp4 = OUT / 'story_1080x1920.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', str(FRAMES / 'f%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', str(mp4)], check=True)
    # 縮圖表：每 1.5 秒一格
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(mp4), '-vf', 'fps=1/1.5,scale=216:-1,tile=7x2',
                    '-frames:v', '1', str(OUT / 'sheet_story.jpg')], check=False)  # 片段太短時抽不到格，不算失敗
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                            'stream=width,height,r_frame_rate,pix_fmt:format=duration,size', '-of', 'json', str(mp4)],
                           capture_output=True, text=True, check=True)
    info = json.loads(probe.stdout)
    s, f = info['streams'][0], info['format']
    print(json.dumps({'mp4': str(mp4.relative_to(ROOT)), 'size': f"{s['width']}x{s['height']}", 'fps': s['r_frame_rate'],
                      'pix_fmt': s['pix_fmt'], 'duration': round(float(f['duration']), 2),
                      'MB': round(int(f['size']) / 1e6, 2), 'frames': n1 - n0}, ensure_ascii=False))


if __name__ == '__main__':
    main()
