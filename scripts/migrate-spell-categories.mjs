import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.join(__dirname, '../src/packs/skills-cardigan');

console.log('🔄 Migrando spellCategory para spellCategories (array)...');
console.log('');

// Read all skill files
const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_folder'));

let updatedCount = 0;
let feiticeiroCount = 0;
let otherCount = 0;

for (const file of files) {
  const filePath = path.join(SKILLS_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Check if it's a skill
  if (data.type === 'skill') {
    const isFeiticeiro = data.system.skillClass === 'feiticeiro';
    
    // Remove old spellCategory field if it exists
    const oldCategory = data.system.spellCategory;
    delete data.system.spellCategory;
    
    // Determine new spellCategories value
    let spellCategories;
    if (isFeiticeiro && oldCategory && oldCategory !== '') {
      spellCategories = [oldCategory];
      feiticeiroCount++;
    } else {
      spellCategories = [];
      otherCount++;
    }
    
    // Create new system object with correct order (spellCategories after skillClass)
    const newSystem = {
      skillActionTypes: data.system.skillActionTypes,
      skillClass: data.system.skillClass,
      spellCategories: spellCategories,
      hasEnergyCost: data.system.hasEnergyCost,
      energyCost: data.system.energyCost,
      hasCustomEffects: data.system.hasCustomEffects,
      customEffects: data.system.customEffects,
      enhancements: data.system.enhancements,
      acquiredEnhancements: data.system.acquiredEnhancements,
      description: data.system.description
    };
    
    // Add any other fields that might exist
    for (const key in data.system) {
      if (!newSystem.hasOwnProperty(key)) {
        newSystem[key] = data.system[key];
      }
    }
    
    data.system = newSystem;
    
    // Write file with proper formatting
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    updatedCount++;
    console.log(`✅ Updated: ${file} - ${isFeiticeiro && oldCategory ? `[${oldCategory}]` : '[]'}`);
  }
}

console.log('');
console.log(`✨ Concluído!`);
console.log(`   📄 ${updatedCount} skills migradas`);
console.log(`   🧙 ${feiticeiroCount} skills de Feiticeiro com categoria`);
console.log(`   ⚔️  ${otherCount} outras skills (array vazio)`);
console.log('');
console.log('📋 Próximo passo: Execute o script de rebuild do compêndio');
console.log('   ./scripts/rebuild-skills-compendium.sh');
console.log('');
