import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import path from "path";

const SYSTEM_ID = process.cwd();
const yaml = false;
const folders = true;

console.log("Compilando compêndio efeitos-cardigan...");

try {
  await compilePack(
    `${SYSTEM_ID}/src/packs/efeitos-cardigan`,
    `${SYSTEM_ID}/packs/efeitos-cardigan`,
    { yaml, recursive: folders }
  );
  console.log("Compêndio compilado com sucesso!");
} catch (error) {
  console.error("Erro ao compilar compêndio:", error);
}
