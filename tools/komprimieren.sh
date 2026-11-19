#!/bin/bash
# Komprimiert GLB-Dateien für das Spiel mit Draco. Nach jedem neuen Modell oder Blender-Export aufrufen.
# Bewusst nur Draco und kein "optimize": Der Code fügt geladene Teile per mergeGeometries zusammen und rechnet
# Positionen um (kit.js, models.js, sheep.js) — das braucht Float-Werte, die Meshopt-Quantisierung nicht liefert.
# "optimize" legt außerdem gleiche Materialien zusammen, dabei gehen Materialnamen verloren (Umfärben per Name).
# Aufruf: tools/komprimieren.sh [datei.glb ...]   Ohne Angabe: alle Modelle in public/models.
set -e
cd "$(dirname "$0")/.."
DATEIEN="$@"
[ -z "$DATEIEN" ] && DATEIEN=$(find public/models -name '*.glb')
for f in $DATEIEN; do
  npx -y @gltf-transform/cli draco "$f" "$f" 2>&1 | grep -iE "^error" || true
done
du -sh public/models
