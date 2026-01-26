#!/bin/bash

# Script para reconstruir completamente o compêndio de skills
# Uso: ./rebuild-skills-compendium.sh

echo "🔧 Rebuilding Skills Compendium..."

# Vai para o diretório do sistema
cd /home/dash/.local/share/FoundryVTT/Data/systems/cardigan

echo "📁 Cleaning old compendium files..."
# Remove completamente a pasta do compêndio
rm -rf packs/skills-cardigan

echo "📦 Packing compendium..."
# Recompila o compêndium com o caminho correto
npx fvtt package pack skills-cardigan \
  --in src/packs/skills-cardigan \
  --out packs

echo "✅ Skills compendium rebuilt successfully!"
echo "🔄 Please restart Foundry VTT and clear browser cache (Ctrl+F5)"

# Lista o conteúdo final
echo ""
echo "📄 Testing unpacked content..."
npx fvtt package unpack skills-cardigan --out /tmp/test-skills-verify > /dev/null 2>&1
SKILLS_COUNT=$(ls /tmp/test-skills-verify/*.json 2>/dev/null | grep -v "_folder" | wc -l)
FOLDERS_COUNT=$(ls /tmp/test-skills-verify/*.json 2>/dev/null | grep "_folder" | wc -l)
echo "Skills: $SKILLS_COUNT"
echo "Folders: $FOLDERS_COUNT"
rm -rf /tmp/test-skills-verify
