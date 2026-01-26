#!/bin/bash

# Script para reconstruir completamente o compêndio de raças
# Uso: ./rebuild-racas-compendium.sh

echo "🔧 Rebuilding Racas Compendium..."

# Vai para o diretório do sistema
cd /home/dash/.local/share/FoundryVTT/Data/systems/cardigan

echo "📁 Cleaning old compendium files..."
# Remove completamente a pasta do compêndio
rm -rf packs/racas-cardigan

echo "📦 Packing compendium..."
# Recompila o compêndio com o caminho correto
npx fvtt package pack racas-cardigan \
  --in src/packs/racas-cardigan \
  --out packs

echo "✅ Racas compendium rebuilt successfully!"
echo "🔄 Please restart Foundry VTT and clear browser cache (Ctrl+F5)"

# Lista o conteúdo final
echo ""
echo "📄 Testing unpacked content..."
npx fvtt package unpack racas-cardigan --out /tmp/test-racas-verify > /dev/null 2>&1
RACAS_COUNT=$(ls /tmp/test-racas-verify/*.json 2>/dev/null | grep -v "_folder" | wc -l)
FOLDERS_COUNT=$(ls /tmp/test-racas-verify/*.json 2>/dev/null | grep "_folder" | wc -l)
echo "Raças: $RACAS_COUNT"
echo "Folders: $FOLDERS_COUNT"
rm -rf /tmp/test-racas-verify
