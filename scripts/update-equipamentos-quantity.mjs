import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SYSTEM_ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(SYSTEM_ROOT, "src", "packs", "equipment-cardigan");

const ITEM_TYPES = new Set(["arma", "armadura"]);

async function run() {
  const entries = await readdir(SOURCE_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_folder"));

  let scanned = 0;
  let updated = 0;
  let alreadyOk = 0;
  let skipped = 0;

  for (const fileName of files) {
    const filePath = path.join(SOURCE_DIR, fileName);
    const raw = await readFile(filePath, "utf8");

    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.warn(`⚠️ JSON inválido, pulando: ${fileName}`);
      skipped++;
      continue;
    }

    scanned++;

    if (!ITEM_TYPES.has(data?.type)) {
      skipped++;
      continue;
    }

    if (!data.system || typeof data.system !== "object") {
      data.system = {};
    }

    if (typeof data.system.quantity === "number" && Number.isFinite(data.system.quantity)) {
      alreadyOk++;
      continue;
    }

    data.system.quantity = 1;
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    updated++;
  }

  console.log("✅ Migração de quantity concluída.");
  console.log(`📦 Arquivos analisados: ${scanned}`);
  console.log(`🛠️ Arquivos atualizados: ${updated}`);
  console.log(`✔️ Já estavam corretos: ${alreadyOk}`);
  console.log(`⏭️ Ignorados: ${skipped}`);
}

run().catch((error) => {
  console.error("❌ Erro ao migrar quantity nos equipamentos:", error);
  process.exit(1);
});
