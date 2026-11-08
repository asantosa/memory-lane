"""Create the portable design preview from the same source served to phones."""
from pathlib import Path
import base64

root = Path(__file__).resolve().parent.parent
web = root / 'web'
css = (web / 'style.css').read_text().replace("@import url('artwork.css');", (web / 'artwork.css').read_text())
html = (web / 'index.html').read_text().replace('<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>')
for name in ('pwa.js', 'voice.js', 'app.js'):
    html = html.replace(f'<script src="{name}"></script>', '<script>' + (web / name).read_text() + '</script>')
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', '')
html = html.replace('href="studio.html', 'href="http://127.0.0.1:4173/studio.html')
for name in ['lakeside-demo.png', 'lakeside-boat.png', 'icon-192.png', 'apple-touch-icon.png'] + [str(p.relative_to(web / 'assets')) for p in (web / 'assets' / 'fonts').glob('*.ttf')]:
    data = base64.b64encode((web / 'assets' / name).read_bytes()).decode()
    mime = 'font/ttf' if name.endswith('.ttf') else 'image/png'
    html = html.replace(f'assets/{name}', f'data:{mime};base64,{data}')
output = root / 'prototypes' / 'memory-lane-preview.html'
output.parent.mkdir(exist_ok=True)
output.write_text(html)
print(output)
