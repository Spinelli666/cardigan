#!/bin/bash

# Script para reconstruir completamente o compêndio de efeitos
# Uso: ./rebuild-effects-compendium.sh

echo "🔧 Rebuilding Effects Compendium..."

# Vai para o diretório do sistema
cd /home/dash/.local/share/FoundryVTT/Data/systems/cardigan

echo "📁 Cleaning old compendium files..."
# Remove completamente a pasta do compêndio
rm -rf packs/efeitos-cardigan

echo "📦 Packing compendium..."
# Recompila o compêndio com o caminho correto
npx fvtt package pack efeitos-cardigan \
  --in src/packs/efeitos-cardigan \
  --out packs

echo "✅ Effects compendium rebuilt successfully!"
echo "🔄 Please restart Foundry VTT and clear browser cache (Ctrl+F5)"

# Lista o conteúdo final
echo ""
echo "📄 Testing unpacked content..."
npx fvtt package unpack efeitos-cardigan --out /tmp/test-effects-verify > /dev/null 2>&1
EFFECTS_COUNT=$(ls /tmp/test-effects-verify/*.json 2>/dev/null | grep -v "_folder" | wc -l)
FOLDERS_COUNT=$(ls /tmp/test-effects-verify/*.json 2>/dev/null | grep "_folder" | wc -l)
echo "Effects: $EFFECTS_COUNT"
echo "Folders: $FOLDERS_COUNT"
rm -rf /tmp/test-effects-verify
