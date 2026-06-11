# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cardigan** is a tabletop RPG system for Foundry VTT (system id `cardigan`, pt-BR localized, requires Foundry v12+). It is a fork/derivative of the "CardiganSystem" boilerplate, heavily customized with its own actors, items, skills, effects, races and combat mechanics. There is no JS bundler — the system runs as native ES modules (`.mjs`) loaded directly by Foundry.

## Commands

```bash
npm install              # install sass + @foundryvtt/foundryvtt-cli
npm run build             # compile src/scss/cardigan.scss -> css/cardigan.css (expanded, no source map)
npm run watch             # same, but watches and emits source maps
npm run build:packs       # compile src/packs/* JSON sources into the LevelDB compendiums under packs/
npm run build:all          # build CSS + packs
```

There is no test suite or linter configured. After changing SCSS, run `npm run build` (or `npm run watch` while iterating) — `css/cardigan.css` is the file Foundry actually loads. After editing compendium source JSON under `src/packs/`, run `npm run build:packs` to regenerate the LevelDB packs in `packs/` (each pack's `CURRENT`/`LOG`/`MANIFEST-*` files are build artifacts).

One-off data migration/maintenance scripts live in `scripts/` (e.g. `rebuild-effects-compendium.sh`, `update-skills-enhancements.mjs`, `migrate-spell-categories.mjs`). These are run manually with `node scripts/<name>.mjs` against `src/packs/` source data, then followed by `npm run build:packs`.

## Architecture

### Entry point
`module/cardigan.mjs` is the system bootstrap. In the `init` hook it: registers `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels`, registers the V2 actor/item sheets, registers Handlebars helpers, sets `CONFIG.ActiveEffect.legacyTransferral = false`, and calls the `initialize*` functions for the Skills/Effects/Races/Weapon-Properties subsystems. The `setup` hook loads `CONFIG.statusEffects` from the `efeitos-cardigan` compendium and registers a `::path/to/image::` ProseMirror text enricher. It also exposes `globalThis.cardigan` / `game.cardigan` with documents, sheet classes and data models for downstream use. Note: this file is large (3700+ lines) because it also contains the PvP combat dialogs (attacker/GM result dialogs, armor durability selection, trade dialogs) — when looking for combat-resolution logic, search here first.

### Data models (`module/data/`)
Each Actor/Item type has a `TypeDataModel` subclass with `defineSchema()`, re-exported from `module/data/_module.mjs`. Actor types: `character`, `npc`. Item types: `item-comum`, `item-municao`, `item-consumivel`, `item-ingredient`, `item-recipe`, `race`, `efeito`, `arma`, `armadura`, `skill`. `system.json` declares these via the modern `documentTypes` field; `template.json` still exists with the legacy schema shape but the DataModel classes are the source of truth for actual fields.

### Documents (`module/documents/`)
`actor.mjs`, `item.mjs`, `chat-message.mjs` extend the base Foundry document classes for system-specific behavior (roll data prep, derived stats, etc.).

### Sheets (`module/sheets/`)
`actor-sheet.mjs` and `item-sheet.mjs` extend `ApplicationV2`/`HandlebarsApplicationMixin` (`api.HandlebarsApplicationMixin(sheets.ActorSheetV2/ItemSheetV2)`) using `static PARTS` for multi-part rendering (header, tabs, proficiencies, biography, skills, equipment, professions, description, per-item-type attribute parts, etc.) and `static DEFAULT_OPTIONS.actions` for declarative action handlers. Sheet logic is split by concern into subfolders:
- `sheets/actions/` — static action handler classes (e.g. `WeaponActions`, `EquipmentActions`, `InventoryActions`, `ConsumableActions`, `HeaderActions`, `AmmunitionActions`, `MoneyTradeActions`, `ProfessionFilterActions`).
- `sheets/listeners/` — DOM event listener setup (e.g. `header-listeners.mjs`, `armor-item-listeners.mjs`, `common-item-listeners.mjs`).
- `sheets/parts/` — per-part context preparation and behavior helpers (e.g. `armor-context.mjs`, `header-context.mjs`, `weapon-ammunition-behavior.mjs`).

### "Manager" subsystems
Four parallel subsystems follow the same registry/factory pattern — a static `Manager` class with a `Map` registry, a `register(name, Class)` method, a `get*`/`apply*` factory method, and an `initializeX()` entry point called from `cardigan.mjs`'s `init` hook:
- `module/effects/` — `EffectManager` + `effects/effects/*.mjs` (status effects like `Sangramento`, `Incendiado`, `Eletrocutado`, `Congelado`, `Petrificado`, `Lento`, `Envenenado`, etc.). Many register their own Foundry hooks via `registerHooks()`.
- `module/skills/` — `SkillManager` + skill implementations.
- `module/races/` — `RaceManager` + race implementations (e.g. `norsca.mjs`).
- `module/weapon-properties/` — `WeaponPropertyManager` + properties (`ferir`, `traspassar`, `contundente`, `incendiar`, `eletrocutar`, `impacto`, `certeiro`, `vorpal`). These are invoked from the combat dialogs in `cardigan.mjs` on critical hits.

When adding a new effect/skill/race/weapon property, follow the existing pattern: create the class under the relevant `*/properties|effects|races` folder, export it from the subsystem's `index.mjs`, and register it in `initializeX()`.

### Multiplayer / sockets (`module/socket.mjs`)
Combat resolution is socket-driven over the `system.cardigan` channel: `registerInitSocketListeners` (init hook) and `registerReadySocketListeners` (ready hook) dispatch on `data.action`/`data.type` (e.g. `notifyGMEvasion`, `notifyDamage`, `applyDamage`, `notifyArmorDurability`, `applyBleeding`/`applyWeakened`/etc. for weapon-property effects). Damage/HP updates are applied by the actor's owner client, with notifications relayed to the GM and other clients.

### Applications (`module/applications/`)
Standalone `DialogV2`-based dialogs/wizards: character creation wizard, level-up wizard, trade/merchant dialogs, recipe crafting, item-type/effects/skill selection dialogs, etc. Each typically pairs with a template in `templates/dialogs/` and a SCSS partial in `src/scss/dialogs/`.

### Helpers (`module/helpers/`)
- `config.mjs` — defines `CONFIG.CARDIGAN` (abilities, ability abbreviations, skill types/classes/ranks, etc., all mapped to `lang/pt-BR.json` localization keys), `registerHandlebarsHelpers()`, and `buildRollFormula()` for advantage/disadvantage roll formulas.
- `chat-messages.mjs` — `ChatMessageHelper.createRollMessage()` builds custom roll chat cards (`templates/chat/roll-message.hbs`).
- `effects.mjs` — effect-related helpers.

### Tooltips (`module/tooltips/`)
`CardiganTooltipManager` renders rich hover tooltips (item, effect, proficiency, dice-formula) using templates in `templates/tooltips/`.

### Compendium packs
Source data for compendiums lives as individual JSON files under `src/packs/<pack-name>/` (plus `_folder_*.json` files defining compendium folders). `npm run build:packs` compiles these into LevelDB stores under `packs/<pack-name>/` via `@foundryvtt/foundryvtt-cli`'s `compilePack`. The four packs are `efeitos-cardigan` (status effects), `skills-cardigan`, `racas-cardigan`, `equipamentos-cardigan`, grouped under the `SRD` pack folder in `system.json`. **Always edit the JSON sources in `src/packs/`, never the compiled `packs/` LevelDB files directly** — they are regenerated by the build and their `CURRENT`/`LOG`/`MANIFEST-*` files will show as changed/added after every build.

### Styling
SCSS source under `src/scss/`, organized into `utils/` (variables, mixins, typography, colors), `global/` (window, flex, grid, chat, token-hud), `components/` (one partial per UI feature, with subfolders like `aside-left/`, `aside-right/`, `equipment/`, `armor/`, `proficiencies/`, `tooltips/`, `chat/`), and `dialogs/` (one partial per application dialog). Everything is imported from `src/scss/cardigan.scss` and compiled to the single `css/cardigan.css` referenced by `system.json`.

### Localization
All user-facing strings live in `lang/pt-BR.json` under the `CARDIGAN.*` namespace; `CONFIG.CARDIGAN` and DataModels reference these keys via `LOCALIZATION_PREFIXES`/localization key strings rather than hardcoded text.
