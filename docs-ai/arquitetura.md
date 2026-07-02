# Arquitetura do Sistema Cardigan

## Entry point

`module/cardigan.mjs` é o bootstrap do sistema (~350 linhas). No hook `init`:
- Registra `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels`.
- Registra as sheets V2 de actor/item (via `DocumentSheetConfig`).
- Registra os helpers do Handlebars (centralizados em `module/helpers/config.mjs`).
- Define `CONFIG.ActiveEffect.legacyTransferral = false`.
- Chama as funções `initialize*` dos subsistemas Skills/Effects/Races/Weapon-Properties.

No hook `setup`:
- Carrega `CONFIG.statusEffects` a partir do compêndio `efeitos-cardigan`.
- Registra um text enricher do ProseMirror para `::path/to/image::`.

No hook `ready`:
- Inicializa `CardiganTooltipManager`.
- Registra `hotbarDrop` para criação de macros.
- Registra socket listeners de trade e combate secundário via `registerReadySocketListeners`.

Também expõe `globalThis.cardigan` / `game.cardigan` com documents, sheet classes e data models para uso externo.

A lógica que anteriormente estava em `cardigan.mjs` foi extraída para módulos dedicados:

- `module/helpers/macro.mjs` — `createDocMacro`, `rollItemMacro`
- `module/trade/trade-handlers.mjs` — handlers do sistema de troca P2P
- `module/trade/merchant-trade-handlers.mjs` — handlers do sistema de mercador
- `module/combat/combat-dialogs.mjs` — diálogos de resultado do atacante/GM, seleção de durabilidade, notificações de dano
- `module/combat/evasion-precision.mjs` — handlers de clique de evasão e precisão no chat
- `module/hooks/chat-hooks.mjs` — hooks `renderChatMessageHTML` (cores de crítico, tooltips de dados, toggles de skill/efeito, botões de evasão/precisão)

> **Ao procurar lógica de resolução de combate:** comece por `module/combat/`. Diálogos de trade ficam em `module/trade/`. Hooks de chat em `module/hooks/chat-hooks.mjs`.

## Data models (`module/data/`)

Cada tipo de Actor/Item tem uma subclasse `TypeDataModel` com `defineSchema()`, reexportada por `module/data/_module.mjs`.

- **Actor**: `character`, `npc`
- **Item**: `item-comum`, `item-municao`, `item-consumivel`, `item-ingredient`, `item-recipe`, `race`, `efeito`, `arma`, `armadura`, `skill`

`system.json` declara esses tipos via o campo moderno `documentTypes`. As DataModel classes são a fonte de verdade dos campos reais (`template.json` foi depreciado e removido).

## Documents (`module/documents/`)

`actor.mjs`, `item.mjs`, `chat-message.mjs` estendem as classes base de documento do Foundry para comportamento específico do sistema (preparo de roll data, stats derivados, etc.).

## Sheets (`module/sheets/`)

`actor-sheet.mjs` e `item-sheet.mjs` estendem `ApplicationV2`/`HandlebarsApplicationMixin` (`api.HandlebarsApplicationMixin(sheets.ActorSheetV2/ItemSheetV2)`), usando `static PARTS` para renderização multi-parte (header, tabs, proficiencies, biography, skills, equipment, professions, description, attribute parts por tipo de item, etc.) e `static DEFAULT_OPTIONS.actions` para handlers de ação declarativos.

A lógica das sheets é dividida por responsabilidade em subpastas:
- `sheets/actions/` — classes estáticas de handlers de ação (ex.: `WeaponActions`, `EquipmentActions`, `InventoryActions`, `ConsumableActions`, `HeaderActions`, `AmmunitionActions`, `MoneyTradeActions`, `ProfessionFilterActions`).
- `sheets/listeners/` — configuração de listeners de eventos DOM (ex.: `header-listeners.mjs`, `armor-item-listeners.mjs`, `common-item-listeners.mjs`).
- `sheets/parts/` — preparação de contexto e helpers de comportamento por parte (ex.: `armor-context.mjs`, `header-context.mjs`, `weapon-ammunition-behavior.mjs`).

## Subsistemas "Manager"

Quatro subsistemas paralelos seguem o mesmo padrão registry/factory: uma classe estática `Manager` com um `Map` de registro, um método `register(name, Class)`, um método factory `get*`/`apply*`, e um ponto de entrada `initializeX()` chamado no hook `init` de `cardigan.mjs`:

- `module/effects/` — `EffectManager` + `effects/effects/*.mjs` (efeitos de status como `Sangramento`, `Incendiado`, `Eletrocutado`, `Congelado`, `Petrificado`, `Lento`, `Envenenado`, etc.). Muitos registram seus próprios hooks do Foundry via `registerHooks()`.
- `module/skills/` — `SkillManager` + implementações de skills.
- `module/races/` — `RaceManager` + implementações de raças (ex.: `norsca.mjs`).
- `module/weapon-properties/` — `WeaponPropertyManager` + propriedades (`ferir`, `traspassar`, `contundente`, `incendiar`, `eletrocutar`, `impacto`, `certeiro`, `vorpal`). São invocadas pelos diálogos de combate em `module/combat/combat-dialogs.mjs` em acertos críticos.

Ao adicionar um novo efeito/skill/raça/propriedade de arma, siga o padrão existente: crie a classe na pasta `*/properties|effects|races` correspondente, exporte-a no `index.mjs` do subsistema, e registre-a em `initializeX()`.

## Multiplayer / sockets (`module/socket.mjs`)

A resolução de combate é orientada por sockets no canal `system.cardigan`:
- `registerInitSocketListeners` (hook `init`) e `registerReadySocketListeners` (hook `ready`) despacham com base em `data.action`/`data.type` (ex.: `notifyGMEvasion`, `notifyDamage`, `applyDamage`, `notifyArmorDurability`, `applyBleeding`/`applyWeakened`/etc. para efeitos de propriedades de arma).
- Atualizações de dano/HP são aplicadas pelo cliente dono do actor, com notificações repassadas ao GM e demais clientes.

## Applications (`module/applications/`)

Diálogos/wizards independentes baseados em `DialogV2`: wizard de criação de personagem, wizard de level-up, diálogos de troca/mercador, crafting de receitas, diálogos de seleção de tipo de item/efeitos/skills, etc. Cada um geralmente tem um template em `templates/dialogs/` e um partial SCSS em `src/scss/dialogs/`.

## Combate (`module/combat/`)

- `combat-dialogs.mjs` — diálogos de resolução de combate PvP: resultado do atacante, notificação de dano ao GM, seleção de durabilidade de armadura, evasão do GM. Exports: `closeAttackDialogForAttacker`, `showDamageNotification`, `showArmorDurabilityNotification`, `createAttackerResultDialog`, `showArmorDurabilityDialog`, `createGMEvasionNotification`.
- `evasion-precision.mjs` — handlers de clique nos botões de evasão e precisão que aparecem nas mensagens de chat de ataque. Exports: `handleEvasionClick`, `handlePrecisionClick`.

## Trade (`module/trade/`)

- `trade-handlers.mjs` — handlers do sistema de troca P2P entre jogadores (`handleTradeRequest`, `handleTradeAccepted`, etc.). Mantém `globalThis.cardiganActiveTradeDialogs`.
- `merchant-trade-handlers.mjs` — handlers do sistema de comércio com NPC mercador (`handleMerchantTradeRequest`, etc.). Mantém `globalThis.cardiganActiveMerchantTrades`.

## Hooks (`module/hooks/`)

- `whisper-placeholder.mjs` — hook para substituição de placeholder em mensagens de sussurro.
- `chat-hooks.mjs` — hooks `renderChatMessageHTML` registrados como side effect de import: cores de totais de crítico, tooltips ricos de fórmula de dado, toggles de descrição de skill e de título de efeito, botões de evasão em mensagens de ataque, botões de precisão em rerolls de evasão.

## Helpers (`module/helpers/`)

- `config.mjs` — define `CONFIG.CARDIGAN` (abilities, abreviações de abilities, tipos/classes/ranks de skills, etc., todos mapeados para chaves de localização de `lang/pt-BR.json`), `registerHandlebarsHelpers()`, e `buildRollFormula()` para fórmulas de rolagem com vantagem/desvantagem.
- `chat-messages.mjs` — `ChatMessageHelper.createRollMessage()` constrói os cards de chat de rolagem customizados (`templates/chat/roll-message.hbs`).
- `effects.mjs` — helpers relacionados a efeitos.
- `macro.mjs` — `createDocMacro` (hotbar drop) e `rollItemMacro` (execução via UUID).

## Tooltips (`module/tooltips/`)

`CardiganTooltipManager` renderiza tooltips ricas ao passar o mouse (item, efeito, proficiência, fórmula de dado) usando templates em `templates/tooltips/`.

## Compêndios (compendium packs)

Os dados-fonte dos compêndios ficam como arquivos JSON individuais em `src/packs/<pack-name>/` (mais arquivos `_folder_*.json` definindo pastas de compêndio). `npm run build:packs` compila esses fontes em stores LevelDB sob `packs/<pack-name>/` via `compilePack` do `@foundryvtt/foundryvtt-cli`.

Os quatro packs são `efeitos-cardigan` (efeitos de status), `skills-cardigan`, `racas-cardigan`, `equipamentos-cardigan`, agrupados sob a pasta `SRD` em `system.json`.

**Sempre edite os fontes JSON em `src/packs/`, nunca os arquivos LevelDB compilados em `packs/` diretamente** — eles são regenerados pelo build, e seus arquivos `CURRENT`/`LOG`/`MANIFEST-*` aparecerão como alterados/adicionados a cada build.

## Styling

Fontes SCSS em `src/scss/`, organizados em:
- `utils/` — variáveis, mixins, tipografia, cores
- `global/` — window, flex, grid, chat, token-hud
- `components/` — um partial por feature de UI, com subpastas como `aside-left/`, `aside-right/`, `equipment/`, `armor/`, `proficiencies/`, `tooltips/`, `chat/`
- `dialogs/` — um partial por application/dialog

Tudo é importado por `src/scss/cardigan.scss` e compilado para o arquivo único `css/cardigan.css`, referenciado em `system.json`.

## Localização

Todas as strings voltadas ao usuário ficam em `lang/pt-BR.json` sob o namespace `CARDIGAN.*`; `CONFIG.CARDIGAN` e as DataModels referenciam essas chaves via `LOCALIZATION_PREFIXES`/strings de chave de localização, em vez de texto hardcoded.
