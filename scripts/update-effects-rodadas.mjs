/**
 * Script para adicionar o campo 'rodadas' em todos os efeitos do compendium
 * Usage: node scripts/update-effects-rodadas.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EFFECTS_DIR = path.join(__dirname, '..', 'src', 'packs', 'efeitos-cardigan');

console.log('🔄 Atualizando efeitos com campo "rodadas"...\n');

let updatedCount = 0;
let skippedCount = 0;

// Ler todos os arquivos do diretório de efeitos
const files = fs.readdirSync(EFFECTS_DIR);

for (const file of files) {
  // Pular arquivos que não são efeitos (pastas, arquivos _folder_*.json, etc)
  if (!file.endsWith('.json') || file.startsWith('_folder_')) {
    continue;
  }

  const filePath = path.join(EFFECTS_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Verificar se é um item do tipo efeito
  if (data.type !== 'efeito') {
    console.log(`⚠️  Pulando ${file} - não é do tipo 'efeito'`);
    skippedCount++;
    continue;
  }

  // Verificar se já tem o campo rodadas
  if (data.system.rodadas !== undefined) {
    console.log(`✓ ${file} - já tem campo 'rodadas'`);
    skippedCount++;
    continue;
  }

  // Adicionar o campo rodadas com valor padrão "0"
  data.system.rodadas = "0";

  // Salvar o arquivo atualizado
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  
  console.log(`✅ ${file} - campo 'rodadas' adicionado`);
  updatedCount++;
}

console.log(`\n📊 Resumo:`);
console.log(`   ✅ Atualizados: ${updatedCount}`);
console.log(`   ⏭️  Pulados: ${skippedCount}`);
console.log(`\n✨ Concluído! Agora execute: ./scripts/rebuild-effects-compendium.sh`);
