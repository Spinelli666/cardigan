import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const efeitosDir = path.join(__dirname, '..', 'src', 'packs', 'effects-cardigan');

// Read all JSON files in the directory
const files = fs.readdirSync(efeitosDir).filter(file => 
  file.endsWith('.json') && !file.startsWith('_folder')
);

console.log(`Found ${files.length} effect files to update`);

let updatedCount = 0;
let errors = 0;

files.forEach(file => {
  const filePath = path.join(efeitosDir, file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const effect = JSON.parse(content);
    
    // Skip if not an effect item
    if (effect.type !== 'efeito') {
      console.log(`Skipping ${file} - not an effect`);
      return;
    }
    
    let modified = false;
    
    // Remove active field if it exists
    if (effect.system.hasOwnProperty('active')) {
      delete effect.system.active;
      modified = true;
      console.log(`Removed 'active' field from ${effect.name}`);
    }
    
    // Ensure efeitoType is set correctly
    if (!effect.system.efeitoType || effect.system.efeitoType === '') {
      // Default to 'negativo' if not set
      effect.system.efeitoType = 'negativo';
      modified = true;
      console.log(`Set default efeitoType for ${effect.name}`);
    } else if (effect.system.efeitoType !== 'positivo' && effect.system.efeitoType !== 'negativo') {
      // Convert any other values to 'negativo'
      effect.system.efeitoType = 'negativo';
      modified = true;
      console.log(`Converted efeitoType to 'negativo' for ${effect.name}`);
    }
    
    // Write back if modified
    if (modified) {
      const updatedContent = JSON.stringify(effect, null, 2);
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      updatedCount++;
      console.log(`✓ Updated ${effect.name} (${file})`);
    } else {
      console.log(`- No changes needed for ${effect.name}`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${file}:`, error.message);
    errors++;
  }
});

console.log('\n=== Update Summary ===');
console.log(`Total files processed: ${files.length}`);
console.log(`Files updated: ${updatedCount}`);
console.log(`Errors: ${errors}`);
console.log('\nNext steps:');
console.log('1. Review the changes in src/packs/effects-cardigan/');
console.log('2. Run: npm run build:packs');
console.log('3. Restart Foundry VTT to see the changes');
