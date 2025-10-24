import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import path from "path";

const SYSTEM_ID = process.cwd();
const yaml = false;
const folders = true;

console.log("Compilando compêndios do sistema Cardigan...");

try {
  // Compilar efeitos-cardigan
  console.log("Compilando compêndio efeitos-cardigan...");
  await compilePack(
    `${SYSTEM_ID}/src/packs/efeitos-cardigan`,
    `${SYSTEM_ID}/packs/efeitos-cardigan`,
    { yaml, recursive: folders }
  );
  console.log("✅ Compêndio efeitos-cardigan compilado!");

  // Compilar skills-cardigan
  console.log("Compilando compêndio skills-cardigan...");
  await compilePack(
    `${SYSTEM_ID}/src/packs/skills-cardigan`,
    `${SYSTEM_ID}/packs/skills-cardigan`,
    { yaml, recursive: folders }
  );
  console.log("✅ Compêndio skills-cardigan compilado!");

  console.log("🎉 Todos os compêndios compilados com sucesso!");
} catch (error) {
  console.error("❌ Erro ao compilar compêndios:", error);
}
