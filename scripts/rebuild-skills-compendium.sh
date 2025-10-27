#!/bin/bash

# Script para reconstruir completamente o compêndio de skills
# Uso: ./rebuild-skills-compendium.sh

echo "🔧 Rebuilding Skills Compendium..."

# Vai para o diretório do sistema
cd /home/dash/.local/share/FoundryVTT/Data/systems/cardigan

echo "📁 Cleaning old compendium files..."
# Remove todos os arquivos do compêndio
rm -rf packs/skills-cardigan/*.ldb
rm -rf packs/skills-cardigan/*.log  
rm -rf packs/skills-cardigan/MANIFEST-*
rm -rf packs/skills-cardigan/CURRENT
rm -rf packs/skills-cardigan/LOG*
rm -rf packs/skills-cardigan/LOCK
rm -rf packs/skills-cardigan/lost/

echo "📋 Copying source files..."
# Copia os arquivos fonte atualizados
cp src/packs/skills-cardigan/* packs/skills-cardigan/_source/

echo "📦 Packing compendium..."
# Recompila o compêndium
npx fvtt package pack skills-cardigan --clean

echo "✅ Skills compendium rebuilt successfully!"
echo "🔄 Please restart Foundry VTT and clear browser cache (Ctrl+F5)"

# Lista o conteúdo final
echo "📄 Final compendium contents:"
ls -la packs/skills-cardigan/_source/*.json | grep -v "_folder" | wc -l | xargs echo "Skills count:"
echo "Folders: 6 (Andarilho, Guerreiro, Ladino, Feiticeiro, Raciais, Únicas)"