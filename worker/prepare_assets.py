#!/usr/bin/env python3
"""Reuse the blog's local fonts and favicon in the admin deployment."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
public = root / 'worker/public'
fonts = public / 'fonts'
fonts.mkdir(exist_ok=True)
for name in ('noto-serif-sc-600.woff2', 'noto-sans-sc-400.woff2', 'ibm-plex-mono-400.woff2', 'OFL.txt'):
    shutil.copyfile(root / 'assets/fonts' / name, fonts / name)
shutil.copyfile(root / 'assets/favicon.svg', public / 'favicon.svg')
print('Prepared admin fonts and favicon')
