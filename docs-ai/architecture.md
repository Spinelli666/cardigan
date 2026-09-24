# Arquitetura do Sistema Cardigan

## Entry point

`module/cardigan.mjs` é o bootstrap do sistema (~390 linhas). No hook `init`:
- Registra `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels`.
- Registra as sheets V2 de actor/item (via `foundry.applications.apps.DocumentSheetConfig`).
- Registra os socket listeners de init (`registerInitSocketListeners`).
- Registra a setting `schemaVersion` (usada pelo sistema de migração — ver abaixo).
- Registra os helpers do Handlebars (centralizados em `module/helpers/config.mjs`) e pré-carrega os partials de `templates/actor/partials/` via `foundry.applications.handlebars.loadTemplates()`.
- Chama as funções `initialize*` dos subsistemas Skills/Effects/Races/Weapon-Properties.

No hook `setup`:
- Carrega `CONFIG.statusEffects` a partir do compêndio `effects-cardigan`.
- Registra um text enricher do ProseMirror para `::path/to/image::`.
- Registra os enrichers de rolagem `@Teste`/`@Pericia` (`initializeRollEnrichers()` — ver [text-enrichers.md](text-enrichers.md)).

No hook `ready`:
- Executa as migrações de dados pendentes do mundo (`migrateWorldData()`, só no GM).
- Inicializa `CardiganTooltipManager`.
- Registra `hotbarDrop` para criação de macros.
- Registra socket listeners de trade e combate secundário via `registerReadySocketListeners`.

Também registra os hooks globais `preCreateActiveEffect` e `updateItem`, e expõe `globalThis.cardigan` / `game.cardigan` com documents, sheet classes e data models para uso externo.

A lógica que anteriormente estava em `cardigan.mjs` foi extraída para módulos dedicados:

- `module/helpers/macro.mjs` — `createDocMacro`, `rollItemMacro`
- `module/trade/trade-handlers.mjs` — handlers do sistema de troca P2P
- `module/trade/merchant-trade-handlers.mjs` — handlers do sistema de mercador
- `module/combat/combat-dialogs.mjs` — diálogos de resultado do atacante/GM, seleção de durabilidade, notificações de dano
- `module/combat/evasion-precision.mjs` — handlers de clique de evasão e precisão no chat
- `module/hooks/chat-hooks.mjs` — hooks `renderChatMessageHTML` (cores de crítico, tooltips de dados, toggles de skill/efeito, botões de evasão/precisão)

> **Ao procurar lógica de resolução de combate:** comece por `module/combat/`. Diálogos de trade ficam em `module/trade/`. Hooks de chat em `module/hooks/chat-hooks.mjs`.

## Data models (`module/data/`)

Cada tipo de Actor/Item tem uma subclasse `TypeDataModel` com `defineSchema()`, reexportada por `module/data/_module.mjs`. Os arquivos têm nomes em inglês, mas mapeiam para os ids de tipo em português:

| Tipo (id) | Arquivo |
|-----------|---------|
| `character` / `npc` | `actor-character.mjs` / `actor-npc.mjs` (base: `base-actor.mjs`) |
| `item-comum` | `item-common.mjs` |
| `item-municao` | `item-ammunition.mjs` |
| `item-consumivel` | `item-consumable.mjs` |
| `item-ingredient` | `item-ingredient.mjs` |
| `item-recipe` | `item-recipe.mjs` |
| `efeito` | `item-effect.mjs` |
| `arma` | `item-weapon.mjs` |
| `armadura` | `item-armor.mjs` |
| `skill` | `item-skill.mjs` |
| `race` | `item-race.mjs` |

Todos os itens herdam de `base-item.mjs`. `system.json` declara esses tipos via o campo moderno `documentTypes`. As DataModel classes são a fonte de verdade dos campos reais (`template.json` foi removido).

## Migração de dados (`module/migration/`)

`migrate-world.mjs` exporta `migrateWorldData()`, chamada no hook `ready` (só executa no GM). Compara a setting `cardigan.schemaVersion` com a constante `SCHEMA_VERSION` e aplica os lotes pendentes sobre actors do mundo, itens embutidos e itens do mundo.

- **Schema v1** — renomeações PT→EN de campos e valores de choices (armadura, efeito, skill, arma, consumível, receita, peso, classes e flags `showSkills*` do character).
- Para adicionar uma nova migração: incremente `SCHEMA_VERSION`, crie `_migrateSchemaVN()` e chame-a em `migrateWorldData()` com `if (currentVersion < N)`. Leia sempre de `document._source` e use a sintaxe `-=campo` para remover chaves antigas.
- A migração **não** altera compêndios — os fontes em `src/packs/` devem ser atualizados à parte (via script em `scripts/` + `npm run build:packs`).

## Documents (`module/documents/`)

`actor.mjs`, `item.mjs`, `chat-message.mjs` estendem as classes base de documento do Foundry para comportamento específico do sistema (preparo de roll data, stats derivados, etc.).

## Sheets (`module/sheets/`)

`actor-sheet.mjs` e `item-sheet.mjs` estendem `ApplicationV2`/`HandlebarsApplicationMixin` (`api.HandlebarsApplicationMixin(sheets.ActorSheetV2/ItemSheetV2)`), usando `static PARTS` para renderização multi-parte (header, tabs, proficiencies, biography, skills, equipment, professions, description, attribute parts por tipo de item, etc.) e `static DEFAULT_OPTIONS.actions` para handlers de ação declarativos.

A lógica das sheets é dividida por responsabilidade em subpastas:
- `sheets/actions/` — classes estáticas de handlers de ação: `WeaponActions`, `EquipmentActions`, `AmmunitionActions`, `ConsumableActions`, `InventoryActions`, `HeaderActions`, `HeaderStatusActions`, `ProficienciesActions`, `MoneyTradeActions`, `BackpackSearchActions`, `SheetScrollActions`, `ItemPrepareActions`, `ProfessionFilterActions`, `RecipeActions`, `DragDropActions`, `ContextMenuActions`, `DeleteActions`.
- `sheets/listeners/` — configuração de listeners de eventos DOM: `header-listeners.mjs`, `armor-item-listeners.mjs`, `weapon-item-listeners.mjs`, `common-item-listeners.mjs`, `abilities-listeners.mjs`, `equipment-field-listeners.mjs`, `stat-field-listeners.mjs`, `proficiency-listeners.mjs`, `enhancement-listeners.mjs`, `life-energy-dialog-listeners.mjs` (diálogo "Vida & Energia" do consumível), `misc-listeners.mjs`, `window-controls-listeners.mjs`, `overrides-listeners.mjs`.
- `sheets/parts/` — preparação de contexto e helpers de comportamento por parte:
  - Contexto: `header-context.mjs`, `armor-context.mjs`, `weapon-context.mjs`.
  - Comportamento de sheet de item: `sheet-base-behavior.mjs`, `armor-sheet-behavior.mjs`, `ingredient-sheet-behavior.mjs`, `ammunition-sheet-behavior.mjs`, `weapon-ammunition-behavior.mjs`.
  - Caixa expansível da mochila: `item-expand.mjs` (toggle expand/collapse + render dos summaries por tipo).
  - Tooltip de preview + mensagem de chat por tipo de item: `consumable-preview-tooltip.mjs`, `armor-preview-tooltip.mjs`, `common-preview-tooltip.mjs`, `ammunition-preview-tooltip.mjs`, `ingredient-preview-tooltip.mjs`. Todos usam o tooltip nativo do Foundry (`data-tooltip-html`) e o template compartilhado `templates/tooltips/item-preview-tooltip.hbs`.
  - Posicionamento: `pixel-snap-position.mjs` (`snapPositionToDevicePixels`), usado no override de `_updatePosition` das duas sheets para manter a janela na grade de pixels físicos. Evita o tremor sub-pixel em telas com escala do Windows fracionária.
  - Builders compartilhados entre caixa expansível e tooltip/chat: `armor-property-rows.mjs`, `armor-info-badges.mjs`, `consumable-header-badges.mjs`.

## Subsistemas "Manager"

Quatro subsistemas paralelos seguem o mesmo padrão registry/factory: uma classe estática `Manager` com um `Map` de registro, um método `register(...)`, um método factory `get*`/`apply*`, e um ponto de entrada `initializeX()` chamado no hook `init` de `cardigan.mjs`.

> **Nomenclatura:** os **arquivos** estão em inglês, mas as **classes** e as **chaves de registro** de efeitos continuam em português (ex.: arquivo `bleeding.mjs` → classe `SangramentoEffect` → registrada como `'Sangramento'`, que é o nome do item no compêndio).

- `module/effects/` — `EffectManager` + `effects/effects/*.mjs`: `bleeding` (Sangramento), `burning` (Incendiado), `electrocuted` (Eletrocutado), `frozen` (Congelado), `petrified` (Petrificado), `slowed` (Lento), `poisoned` (Envenenado), `cursed` (Amaldiçoado), `exhaustion` (Exaustão), `fracture` (Fratura), `toxicity` (Toxicidade), `persistence` (Persistência), `unstoppable` (Imparável). Muitos registram seus próprios hooks do Foundry via `registerHooks()`.
- `module/skills/` — `SkillManager` (orquestrador) + `base-skill.mjs` e módulos por responsabilidade: `skill-default-attacks.mjs`, `skill-chat-message.mjs`, `skill-expand-ui.mjs`, `skill-chat-hooks.mjs`.
- `module/races/` — `RaceManager` + implementações de raças em `races/races/` (ex.: `norsca.mjs` → `NorscaRace`).
- `module/weapon-properties/` — `WeaponPropertyManager` + `base-weapon-property.mjs` + propriedades em `properties/`. O `id` salvo em `system.properties` da arma é em inglês: `wound` (Ferir), `pierce` (Traspassar), `blunt` (Contundente), `ignite` (Incendiar), `electrocute` (Eletrocutar), `impact` (Impacto), `precise` (Certeiro), `vorpal`. São invocadas pelos diálogos de combate em `module/combat/combat-dialogs.mjs` em acertos críticos. As que aplicam efeito de compêndio só declaram getters de config (`effectName`, `socketApplyType`, etc.) e herdam `onCriticalHit()` da base.

Ao adicionar um novo efeito/skill/raça/propriedade de arma, siga o padrão existente: crie a classe na pasta correspondente, exporte-a no `index.mjs` do subsistema, e registre-a em `initializeX()`.

## Multiplayer / sockets (`module/socket.mjs`)

A resolução de combate é orientada por sockets no canal `system.cardigan`:
- `registerInitSocketListeners` (hook `init`) e `registerReadySocketListeners` (hook `ready`) despacham com base em `data.action`/`data.type` (ex.: `notifyGMEvasion`, `notifyDamage`, `applyDamage`, `notifyArmorDurability`, `applyBleeding`/`applyWeakened`/etc. para efeitos de propriedades de arma).
- Atualizações de dano/HP são aplicadas pelo cliente dono do actor, com notificações repassadas ao GM e demais clientes.

## Applications (`module/applications/`)

Diálogos/wizards independentes baseados em `DialogV2`: wizard de criação de personagem, wizard de level-up, diálogos de troca/mercador, crafting de receitas, descanso, seleção de mão/vantagem/peso/tipo de item/efeitos/skills, configuração de enhancements e skills vinculadas, context menu customizado, etc. Cada um geralmente tem um template em `templates/dialogs/` e um partial SCSS em `src/scss/dialogs/`.

## Combate (`module/combat/`)

- `combat-dialogs.mjs` — diálogos de resolução de combate PvP: resultado do atacante, notificação de dano ao GM, seleção de durabilidade de armadura, evasão do GM. Exports: `closeAttackDialogForAttacker`, `showDamageNotification`, `showArmorDurabilityNotification`, `createAttackerResultDialog`, `showArmorDurabilityDialog`, `createGMEvasionNotification`.
- `evasion-precision.mjs` — handlers de clique nos botões de evasão e precisão que aparecem nas mensagens de chat de ataque. Exports: `handleEvasionClick`, `handlePrecisionClick`.

## Trade (`module/trade/`)

- `trade-handlers.mjs` — handlers do sistema de troca P2P entre jogadores (`handleTradeRequest`, `handleTradeAccepted`, etc.). Mantém `globalThis.cardiganActiveTradeDialogs`.
- `merchant-trade-handlers.mjs` — handlers do sistema de comércio com NPC mercador (`handleMerchantTradeRequest`, etc.). Mantém `globalThis.cardiganActiveMerchantTrades`.

## Hooks (`module/hooks/`)

- `whisper-placeholder.mjs` — hook para substituição de placeholder em mensagens de sussurro.
- `chat-hooks.mjs` — hooks `renderChatMessageHTML` registrados como side effect de import: cores de totais de crítico, tooltips ricos de fórmula de dado, toggles de descrição de skill e de título de efeito, botões de evasão em mensagens de ataque, botões de precisão em rerolls de evasão.

## Text enrichers (`module/text-enrichers/`)

Transformam `@Teste[...]` e `@Pericia[...]` em descrições enriquecidas em botões clicáveis de rolagem. Detalhes em [text-enrichers.md](text-enrichers.md).

## Helpers (`module/helpers/`)

- `config.mjs` — define `CONFIG.CARDIGAN` (abilities, abreviações de abilities, tipos/classes/ranks de skills, etc., todos mapeados para chaves de localização de `lang/pt-BR.json`), `registerHandlebarsHelpers()`, e `buildRollFormula()` para fórmulas de rolagem com vantagem/desvantagem.
- `chat-messages.mjs` — `ChatMessageHelper.createRollMessage()` constrói os cards de chat de rolagem customizados (`templates/chat/roll-message.hbs`).
- `effects.mjs` — helpers relacionados a efeitos.
- `macro.mjs` — `createDocMacro` (hotbar drop) e `rollItemMacro` (execução via UUID).
- `roll-mode.mjs` — camada de compatibilidade v12–v14 para roll mode (`core.rollMode` → `core.messageMode`, `applyRollMode` → `applyMode`). Use `getCoreRollMode()` / `applyRollModeToMessageData()` em vez das APIs do core diretamente.
- `gradient-text.mjs` — `wrapWordsInGradientSpans()`: envolve cada palavra em um `<span>` para que texto com gradiente (`background-clip: text`) fique uniforme em várias linhas.

## Tooltips (`module/tooltips/`)

`CardiganTooltipManager` renderiza tooltips ricas ao passar o mouse (item, efeito, proficiência, fórmula de dado) usando templates em `templates/tooltips/`. Os tooltips de preview de item da mochila usam o tooltip nativo do Foundry — ver `sheets/parts/*-preview-tooltip.mjs` acima.

## Dev tools (`module/dev-tools/`) — temporário

`style-lab.mjs` — ferramenta **temporária** para inspecionar e ajustar estilos da ficha ao vivo no Foundry (nada é persistido). Botão flutuante 🖌 visível só para o GM, atalho `Ctrl+Shift+L`, ou `game.cardigan.styleLab.open()`. Para remover: apague o arquivo e as linhas marcadas com `[STYLELAB]` em `module/cardigan.mjs`.

## Templates (`templates/`)

- `actor/` — partes da ficha de actor + `actor/partials/` (partials reutilizáveis registrados no `init`).
- `item/` — ficha de item e `attribute-parts` por tipo.
- `armors/`, `consumables/`, `common-items/`, `ammunitions/`, `ingredients/` — summaries da caixa expansível da mochila, por tipo de item.
- `tooltips/`, `chat/`, `dialogs/`, `skills/`, `recipes/`, `weapons/`, `partials/`.

## Compêndios (compendium packs)

Os dados-fonte dos compêndios ficam como arquivos JSON individuais em `src/packs/<pack-name>/` (mais arquivos `_folder_*.json` definindo pastas de compêndio). `npm run build:packs` compila esses fontes em stores LevelDB sob `packs/<pack-name>/` via `compilePack` do `@foundryvtt/foundryvtt-cli`.

Os quatro packs são `effects-cardigan` (efeitos de status), `skills-cardigan`, `races-cardigan`, `equipment-cardigan`, agrupados sob a pasta `SRD` em `system.json`.

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
