import { compilePack } from "@foundryvtt/foundryvtt-cli";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SYSTEM_ROOT = path.resolve(__dirname, '..');

console.log("Compilando compêndios do sistema Cardigan...");

try {
  // Compilar effects-cardigan
  console.log("Compilando compêndio effects-cardigan...");
  await compilePack(
    path.join(SYSTEM_ROOT, 'src', 'packs', 'effects-cardigan'),
    path.join(SYSTEM_ROOT, 'packs', 'effects-cardigan'),
    { yaml: false, recursive: true }
  );
  console.log("✅ Compêndio effects-cardigan compilado!");

  // Compilar skills-cardigan
  console.log("Compilando compêndio skills-cardigan...");
  await compilePack(
    path.join(SYSTEM_ROOT, 'src', 'packs', 'skills-cardigan'),
    path.join(SYSTEM_ROOT, 'packs', 'skills-cardigan'),
    { yaml: false, recursive: true }
  );
  console.log("✅ Compêndio skills-cardigan compilado!");

  // Compilar races-cardigan
  console.log("Compilando compêndio races-cardigan...");
  await compilePack(
    path.join(SYSTEM_ROOT, 'src', 'packs', 'races-cardigan'),
    path.join(SYSTEM_ROOT, 'packs', 'races-cardigan'),
    { yaml: false, recursive: true }
  );
  console.log("✅ Compêndio races-cardigan compilado!");

  console.log("🎉 Todos os compêndios compilados com sucesso!");
} catch (error) {
  console.error("❌ Erro ao compilar compêndios:", error);
}
