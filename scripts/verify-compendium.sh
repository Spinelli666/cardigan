#!/bin/bash

echo "=== Verificação do Sistema Cardigan ==="
echo ""

echo "1. Verificando estrutura do system.json..."
if grep -q "efeitos-cardigan" /home/dash/.local/share/FoundryVTT/Data/systems/cardigan/system.json; then
    echo "✅ Compêndio encontrado no system.json"
else
    echo "❌ Compêndio NÃO encontrado no system.json"
fi

echo ""
echo "2. Verificando arquivos fonte..."
SOURCE_DIR="/home/dash/.local/share/FoundryVTT/Data/systems/cardigan/src/packs/efeitos-cardigan"
if [ -d "$SOURCE_DIR" ]; then
    echo "✅ Pasta de arquivos fonte existe"
    echo "   Arquivos encontrados: $(ls -1 "$SOURCE_DIR" | wc -l)"
    ls -1 "$SOURCE_DIR"
else
    echo "❌ Pasta de arquivos fonte NÃO existe"
fi

echo ""
echo "3. Verificando banco compilado..."
PACK_DIR="/home/dash/.local/share/FoundryVTT/Data/systems/cardigan/packs/efeitos-cardigan"
if [ -d "$PACK_DIR" ]; then
    echo "✅ Pasta de compêndio compilado existe"
    if [ -f "$PACK_DIR/MANIFEST-000002" ] || [ -f "$PACK_DIR/MANIFEST-000001" ]; then
        echo "✅ Banco LevelDB válido encontrado"
    else
        echo "❌ Banco LevelDB NÃO encontrado"
    fi
else
    echo "❌ Pasta de compêndio compilado NÃO existe"
fi

echo ""
echo "4. Verificando configuração no system.json..."
PACK_PATH=$(grep -A 10 "efeitos-cardigan" /home/dash/.local/share/FoundryVTT/Data/systems/cardigan/system.json | grep "path" | cut -d'"' -f4)
echo "   Caminho configurado: $PACK_PATH"

if [ -d "/home/dash/.local/share/FoundryVTT/Data/systems/cardigan/$PACK_PATH" ]; then
    echo "✅ Caminho do compêndio está correto"
else
    echo "❌ Caminho do compêndio está INCORRETO"
fi

echo ""
echo "=== Resultado Final ==="
echo "Sistema Cardigan com compêndio 'Efeitos do Cardigan' configurado!"
echo "Reinicie o FoundryVTT para ver o compêndio funcionando."
