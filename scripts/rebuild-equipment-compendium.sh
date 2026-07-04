#!/bin/bash

# Script para reconstruir completamente o compêndio de items
# Uso: ./rebuild-items-compendium.sh

echo "🔧 Rebuilding Equipamentos Compendium..."

# Vai para o diretório do sistema
cd /home/dash/.local/share/FoundryVTT/Data/systems/cardigan

echo "📁 Cleaning old compendium files..."
# Remove completamente a pasta do compêndio
rm -rf packs/equipamentos-cardigan

echo "📦 Packing compendium..."
# Recompila o compêndio com o caminho correto
npx fvtt package pack equipamentos-cardigan \
  --in src/packs/equipamentos-cardigan \
  --out packs

echo "✅ Equipamentos compendium rebuilt successfully!"
echo "🔄 Please restart Foundry VTT and clear browser cache (Ctrl+F5)"

# Lista o conteúdo final
echo ""
echo "📄 Testing unpacked content..."
npx fvtt package unpack equipamentos-cardigan --out /tmp/test-equipamentos-verify > /dev/null 2>&1
ITEMS_COUNT=$(find /tmp/test-equipamentos-verify -name "*.json" -type f ! -name "_folder*" 2>/dev/null | wc -l)
FOLDERS_COUNT=$(find /tmp/test-equipamentos-verify -name "_folder*.json" -type f 2>/dev/null | wc -l)
echo "Items: $ITEMS_COUNT"
echo "Folders: $FOLDERS_COUNT"
rm -rf /tmp/test-equipamentos-verify
