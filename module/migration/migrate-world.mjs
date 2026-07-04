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

const CLASSES_PT_TO_EN = {
  'andarilho': 'wanderer',
  'guerreiro': 'warrior',
  'ladino': 'rogue',
  'feiticeiro': 'sorcerer'
};

const SHOW_SKILLS_PT_TO_EN = {
  'showSkillsAndarilhoTable': 'showSkillsWandererTable',
  'showSkillsGuerreiroTable': 'showSkillsWarriorTable',
  'showSkillsLadinoTable': 'showSkillsRogueTable',
  'showSkillsFeiticeiroTable': 'showSkillsSorcererTable',
  'showSkillsRaciaisTable': 'showSkillsRacialTable',
  'showSkillsUnicasTable': 'showSkillsUniqueTable'
};

/**
 * Rename classes sub-fields PT→EN and showSkills detail flags PT→EN.
 * @param {Actor} actor
 */
async function _migrateActor(actor) {
  if (actor.type !== 'character') return;
  const source = actor._source?.system ?? {};
  const updates = {};

  const classes = source.classes ?? {};
  for (const [pt, en] of Object.entries(CLASSES_PT_TO_EN)) {
    if (pt in classes) {
      updates[`system.classes.${en}`] = classes[pt];
      updates[`system.classes.-=${pt}`] = null;
    }
  }

  const details = source.details ?? {};
  for (const [pt, en] of Object.entries(SHOW_SKILLS_PT_TO_EN)) {
    if (pt in details) {
      updates[`system.details.${en}`] = details[pt];
      updates[`system.details.-=${pt}`] = null;
    }
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }
}

/**
 * @param {Item} item
 */
async function _migrateItem(item) {
  if (item.type === 'armadura') await _migrateArmaduraItem(item);
  if (item.type === 'efeito') await _migrateEfeitoItem(item);
  if (item.type === 'skill') await _migrateSkillItem(item);
  if (item.type === 'arma') await _migrateArmaItem(item);
  if (item.type === 'item-consumivel') await _migrateConsumivelItem(item);
  await _migrateWeightItem(item);
}

const EFEITO_TYPE_PT_TO_EN = {
  "positivo": "positive",
  "negativo": "negative"
};

/**
 * Rename efeitoType→effectType, rodadas→rounds; migrate choice values PT→EN.
 * @param {Item} item
 */
async function _migrateEfeitoItem(item) {
  const source = item._source?.system ?? {};
  const updates = {};

  if ('efeitoType' in source) {
    updates['system.effectType'] = EFEITO_TYPE_PT_TO_EN[source.efeitoType] ?? source.efeitoType;
    updates['system.-=efeitoType'] = null;
  } else if (source.effectType && EFEITO_TYPE_PT_TO_EN[source.effectType]) {
    updates['system.effectType'] = EFEITO_TYPE_PT_TO_EN[source.effectType];
  }

  if ('rodadas' in source) {
    updates['system.rounds'] = source.rodadas;
    updates['system.-=rodadas'] = null;
  }

  if (Object.keys(updates).length > 0) {
    await item.update(updates);
  }
}

const SKILL_ACTION_TYPE_PT_TO_EN = {
  "passiva": "passive",
  "foco": "focus",
  "reacao": "reaction"
};

const SKILL_CLASS_PT_TO_EN = {
  "andarilho": "wanderer",
  "guerreiro": "warrior",
  "ladino": "rogue",
  "feiticeiro": "sorcerer",
  "raciais": "racial",
  "unicas": "unique"
};

const SPELL_CATEGORY_PT_TO_EN = {
  "neutro": "neutral",
  "feerico": "fae",
  "caos": "chaos",
  "necromancia": "necromancy"
};

/**
 * Migrate skillActionTypes, skillClass and spellCategories choice values PT→EN.
 * @param {Item} item
 */
async function _migrateSkillItem(item) {
  const source = item._source?.system ?? {};
  const updates = {};

  // Migrate skillClass
  const enClass = SKILL_CLASS_PT_TO_EN[source.skillClass];
  if (enClass) updates['system.skillClass'] = enClass;

  // Migrate skillActionTypes array
  if (Array.isArray(source.skillActionTypes)) {
    const migratedTypes = source.skillActionTypes.map(t => SKILL_ACTION_TYPE_PT_TO_EN[t] ?? t);
    if (migratedTypes.some((t, i) => t !== source.skillActionTypes[i])) {
      updates['system.skillActionTypes'] = migratedTypes;
    }
  }

  // Migrate spellCategories array
  if (Array.isArray(source.spellCategories)) {
    const migratedCats = source.spellCategories.map(c => SPELL_CATEGORY_PT_TO_EN[c] ?? c);
    if (migratedCats.some((c, i) => c !== source.spellCategories[i])) {
      updates['system.spellCategories'] = migratedCats;
    }
  }

  if (Object.keys(updates).length > 0) {
    await item.update(updates);
  }
}

const WEAPON_PROPERTY_PT_TO_EN = {
  'certeiro': 'accurate',
  'contundente': 'blunt',
  'eletrocutar': 'electrify',
  'ferir': 'wound',
  'impacto': 'impact',
  'incendiar': 'ignite',
  'traspassar': 'pierce'
};

/**
 * Migrate weapon properties array values PT→EN.
 * @param {Item} item
 */
async function _migrateArmaItem(item) {
  const source = item._source?.system ?? {};
  if (!Array.isArray(source.properties)) return;
  const migrated = source.properties.map(p => WEAPON_PROPERTY_PT_TO_EN[p] ?? p);
  if (migrated.some((p, i) => p !== source.properties[i])) {
    await item.update({ 'system.properties': migrated });
  }
}

const WEIGHT_PT_TO_EN = {
  "leve": "light",
  "pesado": "heavy",
  "muito-pesado": "very-heavy",
  "medio": "medium"
};

/**
 * Migrate weight choice values PT→EN for all item types that have a weight field.
 * @param {Item} item
 */
async function _migrateWeightItem(item) {
  const WEIGHT_ITEM_TYPES = ['armadura', 'arma', 'item-municao', 'item-comum', 'item-ingredient', 'item-consumivel', 'item-recipe'];
  if (!WEIGHT_ITEM_TYPES.includes(item.type)) return;

  const source = item._source?.system ?? {};
  const enWeight = WEIGHT_PT_TO_EN[source.weight];
  if (!enWeight) return;

  await item.update({ 'system.weight': enWeight });
}

const STATUS_EFFECTS_PT_TO_EN = {
  'fome': 'hunger',
  'sede': 'thirst',
  'fratura': 'fracture',
  'sanidade': 'sanity',
  'toxidade': 'toxicity'
};

/**
 * Rename bonusDeslocamento→movementBonus and statusEffects sub-fields PT→EN.
 * @param {Item} item
 */
async function _migrateConsumivelItem(item) {
  const source = item._source?.system ?? {};
  const updates = {};

  if ('bonusDeslocamento' in source) {
    updates['system.movementBonus'] = source.bonusDeslocamento;
    updates['system.-=bonusDeslocamento'] = null;
  }

  const statusEffects = source.modifiers?.statusEffects ?? {};
  for (const [pt, en] of Object.entries(STATUS_EFFECTS_PT_TO_EN)) {
    if (pt in statusEffects) {
      updates[`system.modifiers.statusEffects.${en}`] = statusEffects[pt];
      updates[`system.modifiers.statusEffects.-=${pt}`] = null;
    }
  }

  if (Object.keys(updates).length > 0) {
    await item.update(updates);
  }
}

const ARMOR_TYPE_PT_TO_EN = {
  "cabeca": "head",
  "acessorios": "accessories",
  "bracos": "arms",
  "pernas": "legs",
  "pes": "feet"
};

/**
 * Rename PT armor field keys to EN equivalents.
 * protecao→protection, bonusVida→lifeBonus, bonusEnergia→energyBonus,
 * bonusDeslocamento→movementBonus, bonusEspacoMochila→backpackBonus
 * @param {Item} item
 */
async function _migrateArmaduraItem(item) {
  const source = item._source?.system ?? {};
  const updates = {};

  // Migrate armorType choice values PT→EN ("cabeca"→"head", etc.; "torso" unchanged)
  const enArmorType = ARMOR_TYPE_PT_TO_EN[source.armorType];
  if (enArmorType) {
    updates['system.armorType'] = enArmorType;
  }

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
