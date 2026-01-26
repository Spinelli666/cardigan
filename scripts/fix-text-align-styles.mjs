#!/usr/bin/env node

/**
 * Script para corrigir estilos inline malformados nos JSONs de skills
 * Adiciona ponto-e-vírgula faltante em style="text-align: justify"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.join(__dirname, '../src/packs/skills-cardigan');

// Contador de arquivos modificados
let filesModified = 0;
let totalReplacements = 0;

// Função para processar um arquivo JSON
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let fileReplacements = 0;
    
    // Padrão 1: text-align: justify (sem ponto-e-vírgula)
    const pattern1 = /style=\\"text-align:\s*justify\\"/g;
    const matches1 = content.match(pattern1);
    if (matches1) {
      content = content.replace(pattern1, 'style=\\"text-align: justify;\\"');
      fileReplacements += matches1.length;
    }
    
    // Padrão 2: text-align: center (sem ponto-e-vírgula)
    const pattern2 = /style=\\"text-align:\s*center\\"/g;
    const matches2 = content.match(pattern2);
    if (matches2) {
      content = content.replace(pattern2, 'style=\\"text-align: center;\\"');
      fileReplacements += matches2.length;
    }
    
    // Padrão 3: text-align: left (sem ponto-e-vírgula)
    const pattern3 = /style=\\"text-align:\s*left\\"/g;
    const matches3 = content.match(pattern3);
    if (matches3) {
      content = content.replace(pattern3, 'style=\\"text-align: left;\\"');
      fileReplacements += matches3.length;
    }
    
    // Padrão 4: text-align: right (sem ponto-e-vírgula)
    const pattern4 = /style=\\"text-align:\s*right\\"/g;
    const matches4 = content.match(pattern4);
    if (matches4) {
      content = content.replace(pattern4, 'style=\\"text-align: right;\\"');
      fileReplacements += matches4.length;
    }
    
    if (fileReplacements > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesModified++;
      totalReplacements += fileReplacements;
      console.log(`✓ ${path.basename(filePath)}: ${fileReplacements} correções`);
    }
    
  } catch (error) {
    console.error(`✗ Erro ao processar ${filePath}:`, error.message);
  }
}

// Processar todos os arquivos JSON no diretório
function processDirectory() {
  console.log('🔍 Procurando arquivos com estilos malformados...\n');
  
  const files = fs.readdirSync(SKILLS_DIR);
  
  files.forEach(file => {
    if (file.endsWith('.json') && !file.startsWith('_')) {
      const filePath = path.join(SKILLS_DIR, file);
      processFile(filePath);
    }
  });
  
  console.log(`\n✅ Concluído!`);
  console.log(`📊 ${filesModified} arquivos modificados`);
  console.log(`🔧 ${totalReplacements} correções aplicadas`);
}

// Executar
processDirectory();
