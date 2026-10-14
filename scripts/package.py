"""Build portable Web preview with preserved relative asset paths."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
with ZipFile(root / 'star-maze-playable.zip', 'w', ZIP_DEFLATED) as z:
    for name in ['index.html', 'style.css', 'game.js', 'cpu.js', 'README.md']:
        z.write(root / name, name)
    for asset in sorted((root / 'assets').rglob('*')):
        if asset.is_file(): z.write(asset, asset.relative_to(root))
print('Packaged scripts, styles and assets with original relative paths.')
