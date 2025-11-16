import { compilePack } from "@foundryvtt/foundryvtt-cli";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SYSTEM_ROOT = path.resolve(__dirname, '..');

console.log("🔄 Reconstruindo compêndio de efeitos...");

try {
  const sourcePath = path.join(SYSTEM_ROOT, 'src', 'packs', 'efeitos-cardigan');
  const destPath = path.join(SYSTEM_ROOT, 'packs', 'efeitos-cardigan');
  
  console.log(`📂 Fonte: ${sourcePath}`);
  console.log(`📂 Destino: ${destPath}`);
  
  await compilePack(sourcePath, destPath, {
    yaml: false,
    recursive: true
  });
  
  console.log("✅ Compêndio de efeitos reconstruído com sucesso!");
} catch (error) {
  console.error("❌ Erro ao reconstruir compêndio:", error);
  process.exit(1);
}
