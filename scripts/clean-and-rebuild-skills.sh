#!/bin/bash

# Script para limpar COMPLETAMENTE e reconstruir o compêndio de skills
# Uso: ./clean-and-rebuild-skills.sh

echo "🧹 LIMPEZA COMPLETA DO COMPÊNDIO DE SKILLS..."
echo ""

# Vai para o diretório do sistema
cd /home/dash/.local/share/FoundryVTT/Data/systems/cardigan

echo "📁 Removendo TODOS os arquivos antigos..."
# Remove completamente a pasta do compêndio incluindo pasta lost
rm -rf packs/skills-cardigan
rm -rf packs/skills-cardigan.db 2>/dev/null
rm -rf packs/skills-cardigan.lock 2>/dev/null

echo "📂 Criando diretório limpo..."
mkdir -p packs/skills-cardigan

echo ""
echo "📦 Compilando compêndio do zero..."
npx fvtt package pack skills-cardigan \
  --in src/packs/skills-cardigan \
  --out packs

echo ""
echo "✅ Compêndio reconstruído!"
echo ""
echo "📊 Verificando conteúdo..."
npx fvtt package unpack skills-cardigan --out /tmp/test-skills-final 2>&1 | grep "Wrote"

echo ""
echo "📈 Contagem final:"
SKILLS_COUNT=$(ls /tmp/test-skills-final/*.json 2>/dev/null | grep -v -E "_(Sk1|Sk2|Sk3|Sk4|Sk5|Sk6)" | wc -l)
FOLDERS_COUNT=$(ls /tmp/test-skills-final/*.json 2>/dev/null | grep -E "_(Sk1|Sk2|Sk3|Sk4|Sk5|Sk6)" | wc -l)
echo "  ⚔️  Skills: $SKILLS_COUNT"
echo "  📁 Pastas: $FOLDERS_COUNT"

rm -rf /tmp/test-skills-final

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "  1. ❌ FECHE COMPLETAMENTE o Foundry VTT (não recarregue, FECHE a janela)"
echo "  2. ✅ Abra o Foundry novamente"
echo "  3. 🌐 Entre na mesa"
echo "  4. ♻️  Limpe o cache do navegador: Ctrl + Shift + R (ou F5 várias vezes)"
echo "  5. 📂 Abra o Compendium 'Skills do Cardigan'"
echo ""
echo "✨ Deve aparecer:"
echo "  📁 6 Pastas (Andarilho, Feiticeiro, Guerreiro, Ladino, Raciais, Únicas)"
echo "  ⚔️  2 Skills (Acerto Debilitante, Fogo Rápido) na pasta Andarilho"
echo ""
