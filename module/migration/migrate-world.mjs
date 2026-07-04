/**
 * Schema version — bump this when adding a new migration batch.
 * Worlds with a stored version below this will run the pending migrations on ready.
 */
const SCHEMA_VERSION = 1;

/**
 * Run pending world data migrations.
 * Only the GM client executes this; other players wait for re-renders triggered by the updates.
 */
export async function migrateWorldData() {
  if (!game.user.isGM) return;

  const currentVersion = game.settings.get('cardigan', 'schemaVersion');
  if (currentVersion >= SCHEMA_VERSION) return;

  ui.notifications.warn(
    '[CARDIGAN] Migrando dados do mundo para a nova versão do schema. Por favor, aguarde...',
    { permanent: false }
  );
  console.log(`[CARDIGAN] Iniciando migração: schema v${currentVersion} → v${SCHEMA_VERSION}`);

  if (currentVersion < 1) await _migrateSchemaV1();

  await game.settings.set('cardigan', 'schemaVersion', SCHEMA_VERSION);
  ui.notifications.info('[CARDIGAN] Migração de dados concluída com sucesso.');
  console.log('[CARDIGAN] Migração concluída. Schema version:', SCHEMA_VERSION);
}

// ---------------------------------------------------------------------------
// Schema v1 — PT→EN field renames and choice value migrations
// Migration steps are added here incrementally as schemas are updated.
// ---------------------------------------------------------------------------

async function _migrateSchemaV1() {
  console.log('[CARDIGAN] Aplicando migrações do schema v1...');

  for (const actor of game.actors) {
    await _migrateActor(actor);
    for (const item of actor.items) {
      await _migrateItem(item);
    }
  }

  for (const item of game.items) {
    await _migrateItem(item);
  }
}

/**
 * @param {Actor} actor
 */
async function _migrateActor(actor) {
  // Migration steps for actors will be added in subsequent commits.
}

/**
 * @param {Item} item
 */
async function _migrateItem(item) {
  if (item.type === 'armadura') await _migrateArmaduraItem(item);
}

/**
 * Rename PT armor field keys to EN equivalents.
 * protecao→protection, bonusVida→lifeBonus, bonusEnergia→energyBonus,
 * bonusDeslocamento→movementBonus, bonusEspacoMochila→backpackBonus
 * @param {Item} item
 */
async function _migrateArmaduraItem(item) {
  const source = item._source?.system ?? {};
  const updates = {};

  if ('protecao' in source) {
    updates['system.protection'] = source.protecao;
    updates['system.-=protecao'] = null;
  }
  if ('bonusVida' in source) {
    updates['system.lifeBonus'] = source.bonusVida;
    updates['system.-=bonusVida'] = null;
  }
  if ('bonusEnergia' in source) {
    updates['system.energyBonus'] = source.bonusEnergia;
    updates['system.-=bonusEnergia'] = null;
  }
  if ('bonusDeslocamento' in source) {
    updates['system.movementBonus'] = source.bonusDeslocamento;
    updates['system.-=bonusDeslocamento'] = null;
  } else if (typeof source.movementBonus === 'number') {
    // Very old flat movementBonus field
    const v = source.movementBonus;
    updates['system.movementBonus'] = { enabled: v !== 0, bonus: v };
  }
  if ('bonusEspacoMochila' in source) {
    updates['system.backpackBonus'] = source.bonusEspacoMochila;
    updates['system.-=bonusEspacoMochila'] = null;
  } else if (typeof source.backpackSpace === 'number') {
    // Very old flat backpackSpace field
    const v = source.backpackSpace;
    updates['system.backpackBonus'] = { enabled: v !== 0, bonus: v };
    updates['system.-=backpackSpace'] = null;
  }

  if (Object.keys(updates).length > 0) {
    await item.update(updates);
  }
}
