#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

python3 - "$ROOT/index.html" <<'PYEOF'
import sys, re

with open(sys.argv[1]) as f:
    html = f.read()

# styles.min.css → 7 liens CSS originaux
CSS_LINKS = """\
    <link rel="stylesheet" href="/css/base.css">
    <link rel="stylesheet" href="/css/splash.css">
    <link rel="stylesheet" href="/css/title.css">
    <link rel="stylesheet" href="/css/game.css">
    <link rel="stylesheet" href="/css/towers.css">
    <link rel="stylesheet" href="/css/hero-ability.css">
    <link rel="stylesheet" href="/css/chapter-select.css">"""
html = re.sub(r' {4}<link rel="stylesheet" href="/dist/css/styles\.min\.css(?:\?v=[^"]*)?">',
              CSS_LINKS.rstrip(), html)

# JS → chemins sources
html = re.sub(r'src="/dist/js/main\.js(?:\?v=[^"]*)?\"', 'src="/js/main.js"', html)
html = re.sub(r"from '/dist/js/([^'?]*)(?:\?v=[^']*)?'", r"from '/js/\1'", html)

with open(sys.argv[1], 'w') as f:
    f.write(html)

print("index.html restauré en mode dev")
PYEOF
