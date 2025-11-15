import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.join(__dirname, '../src/packs/skills-cardigan');

console.log('🔄 Atualizando estrutura de enhancements nas skills...');

// Read all skill files
const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_folder'));

let updatedCount = 0;

for (const file of files) {
  const filePath = path.join(SKILLS_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Check if it's a skill and has enhancements
  if (data.type === 'skill' && data.system.enhancements) {
    let needsUpdate = false;
    
    // Update each enhancement to include hasEffects and customEffects
    data.system.enhancements = data.system.enhancements.map(enhancement => {
      // Check if enhancement already has the new fields
      if (!enhancement.hasOwnProperty('hasEffects')) {
        needsUpdate = true;
        return {
          ...enhancement,
          hasEffects: false,
          customEffects: []
        };
      }
      return enhancement;
    });
    
    if (needsUpdate) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      updatedCount++;
      console.log(`✅ Updated: ${file}`);
    }
  }
}

console.log(`\n✨ Concluído! ${updatedCount} skills atualizadas.`);
console.log('📋 Agora execute: npm run build:packs');
