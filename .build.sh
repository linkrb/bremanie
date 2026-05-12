#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist"

echo "Brémanie — build minifié"
echo "========================"

# ── Nettoyage ──────────────────────────────────────────────────────────────
rm -rf "$DIST"
mkdir -p "$DIST/css" "$DIST/js/chapters"

# ── CSS : concat + minifie → un seul fichier ──────────────────────────────
echo ""
echo "[1/3] CSS..."
TMP_CSS=$(mktemp)
cat "$ROOT/css/base.css" \
    "$ROOT/css/splash.css" \
    "$ROOT/css/title.css" \
    "$ROOT/css/game.css" \
    "$ROOT/css/towers.css" \
    "$ROOT/css/hero-ability.css" \
    "$ROOT/css/chapter-select.css" \
    > "$TMP_CSS"
npx --yes clean-css-cli "$TMP_CSS" -o "$DIST/css/styles.min.css"
rm "$TMP_CSS"

CSS_SRC=$(wc -c < <(cat "$ROOT"/css/*.css))
CSS_MIN=$(wc -c < "$DIST/css/styles.min.css")
CSS_GAIN=$(( (CSS_SRC - CSS_MIN) * 100 / CSS_SRC ))
echo "     ${CSS_SRC} octets → ${CSS_MIN} octets (-${CSS_GAIN}%)"

# ── JS : réécriture imports absolus → relatifs, puis minification ──────────
echo ""
echo "[2/3] JS..."

# Les fichiers dans js/ : '/js/Foo.js' → './Foo.js'
for f in "$ROOT"/js/*.js; do
    TMP=$(mktemp --suffix=.js)
    sed "s|from '/js/\([^']*\)'|from './\1'|g" "$f" > "$TMP"
    npx --yes terser "$TMP" --module --compress --mangle \
        -o "$DIST/js/$(basename "$f")"
    rm "$TMP"
done

# Les fichiers dans js/chapters/ : '/js/Foo.js' → '../Foo.js'
for f in "$ROOT"/js/chapters/*.js; do
    TMP=$(mktemp --suffix=.js)
    sed "s|from '/js/\([^']*\)'|from '../\1'|g" "$f" > "$TMP"
    npx --yes terser "$TMP" --module --compress --mangle \
        -o "$DIST/js/chapters/$(basename "$f")"
    rm "$TMP"
done

JS_SRC=$(find "$ROOT/js" -name "*.js" -exec cat {} \; | wc -c)
JS_MIN=$(find "$DIST/js" -name "*.js" -exec cat {} \; | wc -c)
JS_GAIN=$(( (JS_SRC - JS_MIN) * 100 / JS_SRC ))
echo "     ${JS_SRC} octets → ${JS_MIN} octets (-${JS_GAIN}%)"

# ── HTML : CSS → /dist/css/styles.min.css, JS → /dist/js/main.js ──────────
echo ""
echo "[3/3] HTML..."
python3 - "$ROOT/index.html" "$ROOT/index.html" "$DIST/index.html" <<'PYEOF'
import sys, re

with open(sys.argv[1]) as f:
    html = f.read()

# 7 liens CSS sources → un seul vers dist/ (idempotent : supprime aussi les doublons /dist/)
html = re.sub(r' {4}<link rel="stylesheet" href="/css/[^"]*">\n', '', html)
html = re.sub(r'( {4}<link rel="stylesheet" href="/dist/css/styles\.min\.css">\n)+', '', html)
html = html.replace('</head>', '    <link rel="stylesheet" href="/dist/css/styles.min.css">\n</head>')

# Script principal → dist/
html = html.replace('src="/js/main.js"', 'src="/dist/js/main.js"')

# Imports absolus dans les blocs <script type="module"> inline
html = re.sub(r"from '/js/([^']*)'", r"from '/dist/js/\1'", html)

# Écrit à la racine ET dans dist/
for path in sys.argv[2:]:
    with open(path, 'w') as f:
        f.write(html)
PYEOF

# ── Résumé ─────────────────────────────────────────────────────────────────
echo ""
echo "✓ dist/ prêt — index.html à la racine patché"
echo "  → git add dist/ index.html && git push && (sur le serveur) git pull"
echo ""
echo "  Pour reprendre le dev : git restore index.html"
