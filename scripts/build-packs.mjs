import { compilePack } from "@foundryvtt/foundryvtt-cli";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SYSTEM_ROOT = path.resolve(__dirname, '..');

console.log("Compilando compêndios do sistema Cardigan...");

try {
  // Compilar efeitos-cardigan
  console.log("Compilando compêndio efeitos-cardigan...");
  await compilePack(
    path.join(SYSTEM_ROOT, 'src', 'packs', 'efeitos-cardigan'),
    path.join(SYSTEM_ROOT, 'packs', 'efeitos-cardigan'),
    { yaml: false, recursive: true }
  );
  console.log("✅ Compêndio efeitos-cardigan compilado!");

  // Compilar skills-cardigan
  console.log("Compilando compêndio skills-cardigan...");
  await compilePack(
    path.join(SYSTEM_ROOT, 'src', 'packs', 'skills-cardigan'),
    path.join(SYSTEM_ROOT, 'packs', 'skills-cardigan'),
    { yaml: false, recursive: true }
  );
  console.log("✅ Compêndio skills-cardigan compilado!");

  // Compilar racas-cardigan
  console.log("Compilando compêndio racas-cardigan...");
  await compilePack(
    path.join(SYSTEM_ROOT, 'src', 'packs', 'racas-cardigan'),
    path.join(SYSTEM_ROOT, 'packs', 'racas-cardigan'),
    { yaml: false, recursive: true }
  );
  console.log("✅ Compêndio racas-cardigan compilado!");

  console.log("🎉 Todos os compêndios compilados com sucesso!");
} catch (error) {
  console.error("❌ Erro ao compilar compêndios:", error);
}
