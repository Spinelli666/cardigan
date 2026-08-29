import { compilePack } from "@foundryvtt/foundryvtt-cli";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SYSTEM_ROOT = path.resolve(__dirname, '..');

// Remove legacy Portuguese-named pack directories if they still exist on disk
const LEGACY_PACKS = ['efeitos-cardigan', 'racas-cardigan', 'equipamentos-cardigan'];
for (const name of LEGACY_PACKS) {
  const dir = path.join(SYSTEM_ROOT, 'packs', name);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`🗑️  Removido diretório legado: packs/${name}`);
  }
}

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

  // Compilar equipment-cardigan
  console.log("Compilando compêndio equipment-cardigan...");
  await compilePack(
    path.join(SYSTEM_ROOT, 'src', 'packs', 'equipment-cardigan'),
    path.join(SYSTEM_ROOT, 'packs', 'equipment-cardigan'),
    { yaml: false, recursive: true }
  );
  console.log("✅ Compêndio equipment-cardigan compilado!");

  console.log("🎉 Todos os compêndios compilados com sucesso!");
} catch (error) {
  console.error("❌ Erro ao compilar compêndios:", error);
}
