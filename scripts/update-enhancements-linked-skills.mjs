import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.join(__dirname, '../src/packs/skills-cardigan');

console.log('🔄 Atualizando estrutura de linked skills nos enhancements...');
console.log('');

// Read all skill files
const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_folder'));

let updatedCount = 0;
let enhancementsUpdated = 0;

for (const file of files) {
  const filePath = path.join(SKILLS_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Check if it's a skill and has enhancements
  if (data.type === 'skill' && data.system.enhancements) {
    let needsUpdate = false;
    
    // Update each enhancement to include hasLinkedSkills and linkedSkills
    data.system.enhancements = data.system.enhancements.map((enhancement, index) => {
      // Check if enhancement already has the new fields
      if (!enhancement.hasOwnProperty('hasLinkedSkills')) {
        needsUpdate = true;
        enhancementsUpdated++;
        return {
          ...enhancement,
          hasLinkedSkills: false,
          linkedSkills: []
        };
      }
      return enhancement;
    });
    
    if (needsUpdate) {
      // Write file with proper formatting
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      updatedCount++;
      console.log(`✅ Updated: ${file} (${data.system.enhancements.length} enhancements)`);
    }
  }
}

console.log('');
console.log(`✨ Concluído!`);
console.log(`   📄 ${updatedCount} skills atualizadas`);
console.log(`   🔧 ${enhancementsUpdated} enhancements atualizados`);
console.log('');
console.log('📋 Próximo passo: Execute o script de rebuild do compêndio');
console.log('   ./scripts/rebuild-skills-compendium.sh');
console.log('');
