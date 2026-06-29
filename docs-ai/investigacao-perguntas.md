# Investigação Arquitetural — Respostas às 6 Perguntas

Data da investigação: 2026-06-29
Repositório: https://github.com/Spinelli666/cardigan.git
Branch analisada: feat/refatoracao-css (403 commits no total, 0 tags)

---

## Pergunta 1 — Release / Distribuição

### O que foi encontrado
- **`system.json`** (linhas 60, 63, 128-129): URLs de distribuição são placeholders do boilerplate:
  - `url`: `"Replace this with a link to your public repository"`
  - `bugs`: `"Replace this with a link to file issues or tickets"`
  - `manifest`: `"Replace this with a link to the /latest release system.json..."`
  - `download`: `"This must link to a .zip file of the current version"`
- **`package.json`**: `"private": true` — impede publicação no npm.
- **Nenhum GitHub Actions** existe (`.github/` contém apenas templates de issue/PR do boilerplate, nenhum `workflows/`).
- **Nenhuma tag Git** existe (`git tag -l` retorna vazio).
- **`.gitignore`**: NÃO ignora `css/cardigan.css` (linha comentada: `# css/cardigan.css`). NÃO ignora `packs/` ou seus artefatos LevelDB.
- **`README.md`**: Ainda é o README do boilerplate CardiganSystem (referências a "Asacolips", "Vue3CardiganSystem", tutorial genérico).
- **`CHANGELOG.md`**: Última entrada é `1.2.0 - Add support for Foundry v10`. Totalmente desatualizado (versão atual é 1.3.7).
- **Git remote**: `origin https://github.com/Spinelli666/cardigan.git` — repositório GitHub existe.

### O que é inferência
- O sistema é distribuído por **cópia direta** para `Data/systems/cardigan/` no servidor Foundry, não via manifest URL nem GitHub Releases.
- O `css/cardigan.css` e os `packs/*/CURRENT|LOG|MANIFEST-*` **estão sendo versionados** porque `.gitignore` não os exclui. Isso polui commits com artefatos de build (~80 linhas de diff por build de packs).
- Não há infraestrutura de release automatizado. O autor (você) provavelmente roda `npm run build:all` localmente e usa o resultado direto.

### O que não dá para saber apenas pelo repositório
- Se há plano de distribuir via Foundry Package Manager no futuro (requer manifest URL funcional).
- Se outros GMs/jogadores precisam instalar de repositório remoto ou recebem cópia por outro meio (Discord, zip manual).

### Decisão segura recomendada
1. **Manter `css/cardigan.css` versionado** — é o arquivo que o Foundry carrega diretamente. Se alguém fizer clone do repo, precisa funcionar sem build. Porém, adicionar `packs/*/CURRENT`, `packs/*/LOG*`, `packs/*/MANIFEST-*` ao `.gitignore` é seguro, pois são recriados por `npm run build:packs`.
2. **NÃO adicionar `css/cardigan.css` ao `.gitignore`** enquanto não houver pipeline de CI/CD que faça o build automaticamente.
3. **Corrigir URLs placeholder** em `system.json` — apontar para o repo GitHub real. Isso é necessário para qualquer distribuição futura e elimina texto boilerplate.

### Impacto na refatoração
- Sem CI/CD, toda refatoração precisa ser testada manualmente no Foundry local.
- O `.gitignore` pode ser limpo agora (Fase 1 do plano) para reduzir ruído nos commits.
- O `README.md` e `CHANGELOG.md` devem ser reescritos, mas NÃO são blockers para refatoração.

### Próximas ações
- [x] Adicionar ao `.gitignore`: `packs/*/CURRENT`, `packs/*/LOG`, `packs/*/LOG.old`, `packs/*/MANIFEST-*`
- [x] Corrigir URLs placeholder no `system.json` (apontar para `https://github.com/Spinelli666/cardigan`)
- [x] Atualizar author em `package.json` de `"Asacolips"` para `"Spinelli666"`
- [x] Sincronizar versão `package.json` (3.0.0) com `system.json` (1.3.7) — usar 1.3.7 como canônica

---

## Pergunta 2 — `template.json`

### O que foi encontrado
- **`template.json` NÃO é referenciado em nenhum código JS** — grep por `template.json` encontrou apenas referências em documentação (`docs-ai/`, `README.md`).
- **`system.json`** usa `documentTypes` (campo moderno, linha 12-52) para declarar todos os tipos de Actor/Item.
- **12 classes DataModel** existem em `module/data/` com `defineSchema()` completo, re-exportadas por `_module.mjs`.
- **`template.json`** tem 254 linhas e define schemas legados para todos os tipos, mas com campos diferentes/desatualizados em relação aos DataModels. Exemplos de divergência:
  - `template.json` define `item-consumivel` com ~15 campos; o DataModel tem 60+ campos.
  - `template.json` define `armadura.resistenciaFrio`; o DataModel pode ter campos diferentes.
  - `template.json` usa `"templates": ["base"]` com herança — os DataModels usam herança de classe JS.
- **`system.json` NÃO referencia `template.json`** em nenhum campo (o Foundry v12 carrega automaticamente se o arquivo existir, mas o `documentTypes` campo tem precedência).

### O que é inferência
- **`template.json` é redundante e potencialmente perigoso.** Se estiver desatualizado em relação aos DataModels (e está), ele pode confundir o Foundry sobre quais campos existem. Com `documentTypes` + DataModels, o `template.json` não deveria ser necessário.
- **Em Foundry v12**, quando `documentTypes` e DataModels são usados, `template.json` é ignorado para definição de schema. O Foundry pode ainda lê-lo para defaults de campos legados se não houver DataModel para algum campo.
- Mundos/saves criados quando `template.json` era a fonte de verdade (antes dos DataModels serem adicionados) poderiam ter dados persistidos usando os campos do `template.json`. Porém, os DataModels agora definem `initial` values para todos os campos, o que serve como fallback.

### O que não dá para saber apenas pelo repositório
- Exatamente quando os DataModels foram introduzidos (precisaria fazer `git log -- module/data/` e correlacionar com mundos/saves existentes).
- Se há mundos/saves com dados que dependem dos defaults do `template.json` para campos que os DataModels não declaram.

### Decisão segura recomendada
1. **NÃO remover `template.json` imediatamente.** Embora seja tecnicamente redundante, a remoção pode ter efeitos colaterais sutis em mundos existentes.
2. **Estratégia de deprecação em 2 passos:**
   - **Passo 1 (agora, seguro):** Adicionar comentário no topo ou renomear para `template.json.legacy` para sinalizar que não é mais a fonte de verdade. Validar no Foundry que nada quebra.
   - **Passo 2 (após validação):** Se o sistema rodar normalmente sem `template.json`, removê-lo em commit separado. Testar com um mundo existente que tenha actors/items criados anteriormente.
3. **Teste de validação:** Criar backup do mundo, remover `template.json`, recarregar o Foundry, abrir sheets de actors/items existentes, verificar que todos os campos estão presentes.

### Impacto na refatoração
- **Baixo.** `template.json` não é importado nem referenciado no código — removê-lo não requer mudança em nenhum arquivo JS/HBS.
- A remoção é um one-liner que elimina confusão, mas não desbloqueia nenhuma refatoração.

### Próximas ações
- [ ] Fazer backup do mundo de teste
- [ ] Renomear `template.json` → `template.json.legacy` (ou mover para `docs-ai/`)
- [ ] Testar no Foundry: criar novo personagem, abrir personagem existente, verificar todos os campos
- [ ] Se OK, remover `template.json.legacy` em commit separado

---

## Pergunta 3 — Compatibilidade Foundry v13/v14

### O que foi encontrado
- **`system.json` `compatibility`** (linhas 73-76): `minimum: "12"`, `verified: "12"`. Nenhuma menção a v13 ou v14.
- **README.md** badge: `![Foundry v11]` e `![Foundry v12]` — boilerplate, não reflete realidade.
- **APIs modernas usadas (bom sinal para v13+):**
  - `ApplicationV2` + `HandlebarsApplicationMixin` (não AppV1) — em `actor-sheet.mjs`, `item-sheet.mjs`, e todos os 20 dialogs de `applications/`
  - `DialogV2` — usado consistentemente (não `Dialog` legado)
  - `TypeDataModel` com `defineSchema()` — todos os 12 data models
  - `foundry.applications.ux.TextEditor` — API moderna
  - `CONFIG.ActiveEffect.legacyTransferral = false` — já usa o sistema moderno
  - `sheets.ActorSheetV2` / `sheets.ItemSheetV2` — classes base modernas
  - `foundry.applications.ux.ContextMenu` — via `ContextMenu5e` wrapper
  - Sem padrões `actor.data.data` (v0.8-era) — usa `actor.system.*` consistentemente

- **APIs potencialmente problemáticas para v13+:**

  | API | Localização | Risco |
  |-----|-------------|-------|
  | `render(true)` / `render(false)` como booleano posicional | 70+ ocorrências em todo o projeto | **Médio**. AppV2 em v12 aceita boolean `force`, mas v13 pode mudar para `render({force: true})`. |
  | `foundry.utils.duplicate()` | `item-sheet.mjs:1765,1823` | **Alto**. Deprecated em v12, pode ser removido em v13+. Usar `foundry.utils.deepClone()`. |
  | `foundry.utils.flattenObject()` | `actor-sheet.mjs:1603,3131` | **Médio**. Pode ser renomeado em v13+. |
  | `foundry.utils.mergeObject()` | `actor-sheet.mjs:4994`, `trade-dialog.mjs`, `merchant-trade-dialog.mjs` | **Baixo**. Ainda estável, mas v13 pode exigir `foundry.utils.mergeObject` → `fu.mergeObject`. |
  | `CONFIG.ActiveEffect.legacyTransferral` | `cardigan.mjs:102` | **Baixo**. Já definido como `false`, mas o campo pode ser removido em v13 (default vira `false`). |
  | `getDocumentClass()` | 10 ocorrências | **Baixo**. API estável. |
  | `TextEditor.implementation.enrichHTML()` | `actor-sheet.mjs`, `tooltip-manager.mjs` (5 ocorrências) | **Médio**. O `.implementation` pode mudar em v13; padrão mais seguro é `TextEditor.enrichHTML()` direto. |
  | Múltiplos `Hooks.once('setup')` e `Hooks.once('ready')` | `cardigan.mjs:237,244` (setup) e `2777,2882` (ready) | **Médio**. `Hooks.once` com mesmo nome registra múltiplos callbacks, mas é fragile — v13 pode mudar a ordem de execução. |

### O que é inferência
- O projeto usa APIs modernas do Foundry v12 (AppV2, DataModels, DialogV2) — está bem posicionado para v13.
- Os riscos são concentrados em 3 padrões: `render(boolean)`, `foundry.utils.duplicate()`, e `TextEditor.implementation`.
- Como o Foundry está indo para v14 (conforme você informou), e o sistema suporta apenas v12, há um gap de compatibilidade crescente.

### O que não dá para saber apenas pelo repositório
- Quando o Foundry v13/v14 será lançado e quais APIs serão removidas/alteradas.
- Se há plano de suportar múltiplas versões simultaneamente.

### Decisão segura recomendada
1. **Manter `verified: "12"` até testar em v13.** Não aumentar o número sem validação real.
2. **Corrigir proativamente os padrões deprecated durante refatorações:**
   - `foundry.utils.duplicate()` → `foundry.utils.deepClone()` (apenas 2 ocorrências — trivial, pode fazer já)
   - `TextEditor.implementation.enrichHTML()` → `TextEditor.enrichHTML()` (5 ocorrências — verificar se funciona em v12 antes)
3. **NÃO refatorar `render(true)` agora** — são 70+ ocorrências, alto risco de regressão, e `render(true)` ainda funciona em v12. Fazer quando houver confirmação de breaking change em v13.
4. **Consolidar hooks duplicados** — juntar os dois `Hooks.once('setup')` e os dois `Hooks.once('ready')` é seguro e melhora clareza (Fase 1).

### Impacto na refatoração
- A refatoração de `cardigan.mjs` (Pergunta 6) já deve consolidar os hooks duplicados.
- Substituir `duplicate()` pode ser feito como micro-commit durante qualquer refatoração de `item-sheet.mjs`.
- O `render(boolean)` NÃO deve ser tocado agora — é uma mudança horizontal que afeta todo o projeto.

### Próximas ações
- [x] Substituir `foundry.utils.duplicate()` por `foundry.utils.deepClone()` (2 locais)
- [x] Consolidar dois `Hooks.once('setup')` em um (cardigan.mjs:237-264)
- [x] Consolidar dois `Hooks.once('ready')` em um (cardigan.mjs:2777-2891)
- [ ] Quando v13 beta disponível: testar sistema completo, focar em `render()` e `TextEditor`

---

## Pergunta 4 — Players com macros

### O que foi encontrado

**API pública exposta (`cardigan.mjs:33-47, 51`):**
```javascript
globalThis.cardigan = {
  documents: { CardiganSystemActor, CardiganSystemItem, CardiganChatMessage },
  applications: { CardiganSystemActorSheet, CardiganSystemItemSheet },
  utils: { rollItemMacro },
  models,   // todos os DataModel classes
};
game.cardigan = globalThis.cardigan;
```

**Outras exposições globais:**
- `CONFIG.CARDIGAN` — definido em `cardigan.mjs:54` com abilities, skillTypes, skillClasses, skillRanks, efeitoTypes, spellCategories.
- `globalThis.cardiganActiveTradeDialogs` — Map de diálogos de troca ativos (`cardigan.mjs:1913`).
- `globalThis.cardiganActiveMerchantTrades` — Map de trades de mercador ativos (`cardigan.mjs:1919`).
- `game.cardigan.rollItemMacro(uuid)` — usado pela hotbar macro (`cardigan.mjs:2835`).

**Classificação de APIs:**

| API / Campo | Classificação | Justificativa |
|-------------|---------------|---------------|
| `game.cardigan.rollItemMacro(uuid)` | **Público provável** | Gerado automaticamente quando jogador arrasta item para hotbar. Macros existentes usam isso. |
| `game.cardigan.documents.*` | **Interno provável** | Exposto para "downstream developers" (comentário linha 32), mas improvável que jogadores usem diretamente. |
| `game.cardigan.models.*` | **Interno provável** | Acesso a DataModel classes — útil para devs, não para macros de jogadores. |
| `CONFIG.CARDIGAN.abilities` | **Público provável** | Usado em 25+ locais no código. Macros de GM poderiam referenciar. |
| `CONFIG.CARDIGAN.skillTypes` | **Público provável** | Classificação de skills. |
| `actor.system.health.value` | **Público provável** | Campo primário de token (`primaryTokenAttribute: "health"`). Macros de HP certamente usam. |
| `actor.system.power.value` | **Público provável** | Token secundário (`secondaryTokenAttribute: "power"`). |
| `actor.system.abilities.*` | **Público provável** | Abilities são referenciadas por nome em 30+ locais. |
| `actor.system.status.*` | **Incerto** | Campos como `toxicity`, `fracture`, `sanity` — menos provável em macros, mas possível. |
| `actor.system.money` | **Incerto** | Pode ser usado em macros de comércio. |
| `globalThis.cardiganActiveTradeDialogs` | **Interno** | Estrutura de estado de diálogo — nenhum jogador deveria usar. |
| `globalThis.cardiganActiveMerchantTrades` | **Interno** | Idem. |

**Handlebars helpers registrados globalmente:**
- `concat`, `toLowerCase`, `selected`, `hasRangedWeapons`, `select`, `and`, `subtract`, `multiply`, `divide`, `add`, `abs`, `not`, `ternary`, `gt`, `gte`, `lt`, `lte`, `eq`, `ne`, `or`, `keys`, `values`, `includes`, `log` — registrados em `config.mjs:registerHandlebarsHelpers()` e duplicados parcialmente em `cardigan.mjs`.

### O que é inferência
- **A superfície de macros mais provável é pequena:** `game.cardigan.rollItemMacro()`, `actor.system.health/power/abilities/money`, e `CONFIG.CARDIGAN`.
- Jogadores provavelmente NÃO usam DataModel classes ou internal state diretamente.
- Como não há documentação de macros, jogadores dependem de caminhos de dados descobertos via console do navegador (`actor.system.*`).
- Os campos de schema PT-BR (`protecao`, `bonusVida`, etc.) são parte da superfície pública de macros — renomeá-los quebraria macros.

### O que não dá para saber apenas pelo repositório
- Quais macros os jogadores/GMs realmente criaram.
- Se há macros compartilhadas em Discord, módulos de terceiros ou worlds.

### Decisão segura recomendada
1. **NÃO renomear campos de schema** (`protecao`, `bonusVida`, etc.) sem camada de compatibilidade. Isso é a decisão já documentada em `tarefas-pendentes.md`.
2. **NÃO remover `game.cardigan.rollItemMacro()`** — é a única API que macros de hotbar usam ativamente.
3. **Tratar como público:** `game.cardigan.rollItemMacro()`, `CONFIG.CARDIGAN`, `actor.system.health/power/abilities/status/money`, todos os campos de schema atuais.
4. **Ao refatorar `cardigan.mjs`**, manter `game.cardigan` e `globalThis.cardigan` com a mesma estrutura. Se mover funções para módulos separados, re-exportar no mesmo namespace.
5. **Quando/se renomear algo público:** adicionar alias temporário com `foundry.utils.logCompatibilityWarning()`.

### Impacto na refatoração
- A refatoração de `cardigan.mjs` pode mover funções para outros arquivos, desde que `game.cardigan` continue expondo a mesma API.
- Campos de schema NÃO devem ser renomeados durante esta refatoração (decisão já documentada).
- Handlebars helpers podem ser consolidados (remover duplicatas), mas não renomeados.

### Próximas ações
- [ ] Documentar API pública em comentário JSDoc no `globalThis.cardigan` (futuro, não urgente)
- [ ] Ao extrair funções de `cardigan.mjs`, garantir que `game.cardigan` mantenha os mesmos caminhos
- [ ] NÃO renomear campos de schema em nenhuma fase da refatoração atual

---

## Pergunta 5 — Escopo do `item-consumivel`

### O que foi encontrado

**Total: ~65 campos definidos em `defineSchema()`** (1.128 linhas, `module/data/item-consumivel.mjs`).

**Inventário completo de campos e uso:**

#### Campos básicos (herdados/comuns) — TODOS USADOS
| Campo | Definido | Template HBS | Lógica JS | Status |
|-------|----------|-------------|-----------|--------|
| `quantity` | :96 | item-consumivel.hbs | consumable-actions.mjs | **Usado** |
| `weight` | :102 | item-consumivel.hbs | — | **Usado** |
| `price` | :108 | item-consumivel.hbs | — | **Usado** |

#### Campos de tipo e uso — TODOS USADOS
| Campo | Definido | Template HBS | Lógica JS | Status |
|-------|----------|-------------|-----------|--------|
| `consumableType` | :116 | item-consumivel.hbs | consumable-actions.mjs | **Usado** |
| `useTime` | :129 | item-consumivel.hbs | — | **Usado** |
| `duration` | :140 | item-consumivel.hbs | — | **Usado em template** |
| `effect` | :141 | item-consumivel.hbs | — | **Usado em template** |
| `requiresCheck` | :143 | item-consumivel.hbs | consumable-actions.mjs | **Usado** |
| `checkDifficulty` | :148 | item-consumivel.hbs | consumable-actions.mjs | **Usado** |
| `profession` | :779 | item-consumivel.hbs | item-sheet.mjs, common-item-listeners.mjs, profession-filter-actions.mjs | **Usado** |

#### Sistema de effects — USADO
| Campo | Definido | Uso | Status |
|-------|----------|-----|--------|
| `effects` (array) | :161 | consumable-actions.mjs, item-consumivel.hbs | **Usado** |
| `hasEffects` | :666 | item-consumivel-modifiers.hbs | **Usado** |
| `hasEffectsSection` | :322 | item-consumivel.hbs | **Usado (toggle UI)** |

#### Skill check system — USADO
| Campo | Definido | Uso | Status |
|-------|----------|-----|--------|
| `hasSkillCheck` | :171 | item-consumivel.hbs, consumable-actions.mjs | **Usado** |
| `skillCheckAbility` | :178 | item-consumivel.hbs, consumable-actions.mjs | **Usado** |
| `skillCheckAdvantage` | :187 | item-consumivel.hbs, consumable-actions.mjs | **Usado** |
| `skillCheckEnhancedAdvantage` | :194 | item-consumivel.hbs, consumable-actions.mjs | **Usado** |
| `skillCheckDisadvantage` | :201 | item-consumivel.hbs, consumable-actions.mjs | **Usado** |
| `skillCheckEnhancedDisadvantage` | :208 | item-consumivel.hbs, consumable-actions.mjs | **Usado** |
| `skillTestAddedEffects` (array) | :215 | consumable-actions.mjs, item-sheet.mjs | **Usado** |

#### Critical hit/failure systems — USADO
| Campo | Definido | Uso | Status |
|-------|----------|-----|--------|
| `hasCriticalFailureEffects` | :228 | consumable-actions.mjs | **Usado** |
| `criticalFailureEffects` (array) | :234 | consumable-actions.mjs, item-sheet.mjs | **Usado** |
| `hasCriticalFailureSkillLoss` | :244 | consumable-actions.mjs | **Usado** |
| `criticalFailureSkillLoss` (array) | :250 | consumable-actions.mjs | **Usado** |
| `hasCriticalHitEffects` | :268 | consumable-actions.mjs | **Usado** |
| `criticalHitEffects` (array) | :274 | consumable-actions.mjs, item-sheet.mjs | **Usado** |
| `hasCriticalHitSkillBonus` | :284 | consumable-actions.mjs | **Usado** |
| `criticalHitSkillBonus` (array) | :290 | consumable-actions.mjs | **Usado** |

#### Temporary skill bonus — USADO
| Campo | Definido | Uso | Status |
|-------|----------|-----|--------|
| `hasTemporarySkillBonus` | :308 | consumable-actions.mjs | **Usado** |
| `hasLifeEnergySection` | :315 | item-consumivel.hbs | **Usado (toggle UI)** |
| `temporarySkillBonus` (array) | :328 | consumable-actions.mjs | **Usado** |

#### Health modifier — USADO
| Campo | Definido | Uso | Status |
|-------|----------|-----|--------|
| `hasHealthModifier` | :346 | consumable-actions.mjs, actor-sheet.mjs | **Usado** |
| `healthModifierType` | :352 | consumable-actions.mjs | **Usado** |
| `healthModifierDice` | :360 | consumable-actions.mjs | **Usado** |
| `healthModifierQuantity` | :368 | consumable-actions.mjs | **Usado** |
| `healthModifierAddSkill` | :377 | consumable-actions.mjs | **Usado** |
| `healthModifierSkill` | :383 | consumable-actions.mjs | **Usado** |
| `healthModifierDoubleSkill` | :391 | consumable-actions.mjs | **Usado** |
| `healthModifierIsTemporary` | :397 | consumable-actions.mjs | **Usado** |
| `healthModifierAdditionalBonus` | :403 | consumable-actions.mjs | **Usado** |

#### Energy modifier — USADO
| Campo | Definido | Uso | Status |
|-------|----------|-----|--------|
| `hasEnergyModifier` | :412 | consumable-actions.mjs, common-item-listeners.mjs | **Usado** |
| `energyModifierType` | :418 | consumable-actions.mjs | **Usado** |
| `energyModifierDice` | :425 | consumable-actions.mjs | **Usado** |
| `energyModifierQuantity` | :432 | consumable-actions.mjs | **Usado** |
| `energyModifierAddSkill` | :441 | consumable-actions.mjs | **Usado** |
| `energyModifierSkill` | :447 | consumable-actions.mjs | **Usado** |
| `energyModifierDoubleSkill` | :454 | consumable-actions.mjs | **Usado** |
| `energyModifierIsTemporary` | :460 | consumable-actions.mjs | **Usado** |
| `energyModifierAdditionalBonus` | :466 | consumable-actions.mjs | **Usado** |

#### Armor, Status, Food/Water, Movement, Critical Hit boost — USADOS
| Campo | Definido | Uso | Status |
|-------|----------|-----|--------|
| `hasArmorBonus` | :475 | consumable-actions.mjs | **Usado** |
| `armorBonusAmount` | :481 | consumable-actions.mjs, actor-sheet.mjs | **Usado** |
| `hasStatusAilments` | :491 | item-consumivel.hbs | **Usado (toggle UI)** |
| `hasSanityModifier` | :497 | consumable-actions.mjs | **Usado** |
| `sanityModifierType` | :503 | consumable-actions.mjs | **Usado** |
| `sanityModifierAmount` | :510 | consumable-actions.mjs | **Usado** |
| `hasToxicityModifier` | :520 | consumable-actions.mjs | **Usado** |
| `toxicityModifierType` | :526 | consumable-actions.mjs | **Usado** |
| `toxicityModifierAmount` | :533 | consumable-actions.mjs | **Usado** |
| `hasFractureModifier` | :543 | consumable-actions.mjs | **Usado** |
| `fractureModifierType` | :549 | consumable-actions.mjs | **Usado** |
| `fractureModifierAmount` | :556 | consumable-actions.mjs | **Usado** |
| `hasFoodAndWater` | :566 | item-consumivel.hbs | **Usado (toggle UI)** |
| `hasFoodModifier` | :573 | consumable-actions.mjs | **Usado** |
| `foodModifierType` | :579 | consumable-actions.mjs | **Usado** |
| `foodModifierAmount` | :586 | consumable-actions.mjs | **Usado** |
| `hasWaterModifier` | :599 | consumable-actions.mjs | **Usado** |
| `waterModifierType` | :605 | consumable-actions.mjs | **Usado** |
| `waterModifierAmount` | :609 | consumable-actions.mjs | **Usado** |
| `bonusDeslocamento` | :619 | consumable-actions.mjs, actor-sheet.mjs | **Usado** |
| `hasMovementBoost` | :634 | consumable-actions.mjs | **Usado** (synced via `_syncLegacyMovementFields`) |
| `movementBoostAmount` | :640 | consumable-actions.mjs | **Usado** (synced) |
| `hasCriticalHitBoost` | :650 | consumable-actions.mjs | **Usado** (synced via `_syncLegacyCriticalHitBoostFields`) |
| `criticalHitBoostAmount` | :656 | consumable-actions.mjs | **Usado** (synced) |

#### Sistema `modifiers` (SchemaField aninhado) — PARCIALMENTE USADO
| Campo | Definido | Uso fora do DataModel | Status |
|-------|----------|----------------------|--------|
| `modifiers.statusEffects.fome` | :676 | **Não encontrado em JS ou HBS** | **⚠️ Incerto** |
| `modifiers.statusEffects.sede` | :677 | **Não encontrado em JS ou HBS** | **⚠️ Incerto** |
| `modifiers.statusEffects.fratura` | :678 | **Não encontrado em JS ou HBS** | **⚠️ Incerto** |
| `modifiers.statusEffects.sanidade` | :679 | **Não encontrado em JS ou HBS** | **⚠️ Incerto** |
| `modifiers.statusEffects.toxidade` | :680 | **Não encontrado em JS ou HBS** | **⚠️ Incerto** |
| `modifiers.skillEffects` (array) | :684 | `item-sheet.mjs:1114,1134` | **Usado (item-sheet apenas)** |
| `modifiers.rollSystem.*` | :716 | **Não encontrado em JS ou HBS** | **⚠️ Incerto** |
| `modifiers.systemEffects` (array) | :749 | `item-consumivel.mjs` (cleanup only) | **⚠️ Definido mas só limpo, não lido/escrito externamente** |
| `modifiers.usage.*` | :772 | **Não encontrado em JS ou HBS** | **⚠️ Incerto** |

#### Factory methods — NUNCA CHAMADAS
| Método | Definido | Chamado externamente | Status |
|--------|----------|---------------------|--------|
| `createHealingPotion()` | :997 | **Não** | **⚠️ Código morto provável** |
| `createEnergyPotion()` | :1020 | **Não** | **⚠️ Código morto provável** |
| `createAntidote()` | :1042 | **Não** | **⚠️ Código morto provável** |
| `createBomb()` | :1063 | **Não** | **⚠️ Código morto provável** |
| `createFoodItem()` | :1088 | **Não** | **⚠️ Código morto provável** |
| `createSkillBuffPotion()` | :1110 | **Não** | **⚠️ Código morto provável** |

### O que é inferência
- **TODOS os 60+ campos top-level estão sendo usados** em lógica ou templates. O item-consumivel é genuinamente complexo — não é bloat acidental.
- **O bloco `modifiers` (linhas 673-777) parece ser um sistema paralelo/alternativo** que duplica parcialmente os campos top-level. Os `modifiers.statusEffects` (fome, sede, fratura, etc.) parecem duplicar `hasFoodModifier`/`hasFractureModifier`/etc. Os `modifiers.rollSystem` e `modifiers.usage` não parecem ser usados em nenhuma lógica ou template.
- **Os skill names divergem entre os dois sistemas:** top-level usa `accuracy/evasion/strength/...` (en), `modifiers.skillEffects` usa `vigor/agilidade/intelecto/presenca/forca` (pt). Isso sugere que o bloco `modifiers` foi adicionado em uma fase diferente e possivelmente abandonado.
- **As 6 factory methods nunca são chamadas** — são "presets" para criação de itens que nunca foram integrados.
- **Não há itens consumíveis nos compêndios** (`grep -rl "item-consumivel" src/packs/` retorna 0 resultados).

### O que não dá para saber apenas pelo repositório
- Se o bloco `modifiers` é uma feature planejada mas não implementada, ou um vestígio de uma abordagem abandonada.
- Se existem consumíveis criados em mundos/saves que usam os campos `modifiers.*`.
- Se as factory methods eram para uso via console/macros e nunca foram formalizadas.

### Decisão segura recomendada
1. **NÃO remover nenhum campo agora.** Mesmo que pareçam não usados, podem existir dados salvos em mundos.
2. **Marcar como candidatos a remoção futura:**
   - `modifiers.statusEffects.*` (5 campos) — provavelmente redundantes com `hasSanityModifier`/etc.
   - `modifiers.rollSystem.*` — sem uso detectado.
   - `modifiers.usage.*` — sem uso detectado.
   - `modifiers.systemEffects` — só tem cleanup code, sem leitura/escrita real.
3. **Factory methods podem ser removidas com segurança** — são código morto puro, definidos no DataModel mas nunca chamados.
4. **Investigar no mundo de teste:** abrir console do Foundry, listar consumíveis existentes, verificar se algum tem `system.modifiers.statusEffects` com valores não-zero.
5. **Unificar skill names** — se o bloco `modifiers` sobreviver, corrigir `vigor/agilidade/...` para `accuracy/evasion/...` para consistência.

### Impacto na refatoração
- O tamanho do `item-consumivel.mjs` (1.128 linhas) é justificado pela complexidade real do item — não é prioridade de refatoração.
- A remoção das factory methods (linhas 986-1128 = ~142 linhas) é um quick win seguro.
- A investigação dos `modifiers.*` requer teste em um mundo real.

### Próximas ações
- [x] Remover as 6 factory methods (142 linhas de código morto)
- [ ] Verificar no mundo de teste se algum consumível usa `system.modifiers.statusEffects`
- [ ] Se confirmado não usado, marcar `modifiers.statusEffects`, `modifiers.rollSystem`, `modifiers.usage` para remoção com migração de dados
- [ ] NÃO unificar skill names (PT→EN) nesta fase — pertence à migração de idioma (não confirmada)

---

## Pergunta 6 — Prioridade: `cardigan.mjs` vs `actor-sheet.mjs`

### O que foi encontrado

| Métrica | `cardigan.mjs` | `actor-sheet.mjs` |
|---------|----------------|-------------------|
| **Linhas** | 3.750 | 5.411 |
| **Commits tocando o arquivo** | 67 | 153 |
| **Frequência relativa de edição** | 1x | 2.3x mais editado |
| **Funções/métodos** | 49 top-level functions | 91 methods (class) |
| **Exports** | 0 (tudo internal) | 1 (a classe `CardiganSystemActorSheet`) |
| **Importado por** | ninguém (é entry point) | `cardigan.mjs` (linha 6) |
| **Importa de** | 18 módulos | 13 módulos (actions, listeners, parts) |

**Composição de `cardigan.mjs`:**
```
Linhas 1-175:     Hooks init + setup (~175)
Linhas 177-231:   loadStatusEffects (~55)
Linhas 237-264:   Hooks setup duplicado (enricher) (~28)
Linhas 275-470:   Hooks (preCreateActiveEffect, updateItem) + Handlebars helpers (~196)
Linhas 471-1120:  Combat dialogs — attacker result, armor durability (~650)
Linhas 1123-1910: GM evasion, combat resolution, precision dialogs (~787)
Linhas 1913-2370: Trade system (P2P) (~457)
Linhas 2370-2770: Merchant trade system (~400)
Linhas 2777-2891: Hooks ready + system verification (~115)
Linhas 2823-2870: Macro hotbar (~48)
Linhas 2882-3089: Chat message hooks (renderChatMessageHTML x6) (~207)
Linhas 3091-3182: More chat hooks + toggle handling (~92)
Linhas 3184-3750: Evasion + precision click handlers (~567)
```

**Composição de `actor-sheet.mjs`:**
```
Classe monolítica com:
- static PARTS (7 template parts)
- static DEFAULT_OPTIONS.actions (~30 action mappings)
- _prepareContext + _preparePartContext (~600 linhas)
- _onRender com ~25 listener setup calls (~200 linhas)
- Recipe cooking (~400 linhas)
- Crafting (~300 linhas)
- Context menu (~200 linhas)
- Abilities/modal (~200 linhas)
- Drag & drop (~300 linhas)
- Skills tab preparation (~500 linhas)
- Professions tab preparation (~300 linhas)
- Equipment helpers (~300 linhas)
- Remaining action handlers (~2.000 linhas)
```

**Acoplamento:**

`cardigan.mjs`:
- **Baixo acoplamento interno.** As funções são independentes entre si (combat dialogs não chamam trade handlers, chat hooks não chamam combat logic). Cada bloco pode ser extraído como módulo separado sem afetar outros.
- **Zero dependentes externos.** Ninguém importa de `cardigan.mjs` (é entry point). Mover funções para módulos novos requer apenas atualizar os imports internos.
- **Acoplamento com sockets:** `registerInitSocketListeners` e `registerReadySocketListeners` recebem os handlers como objeto — já são injetados, fáceis de mover.

`actor-sheet.mjs`:
- **Alto acoplamento interno.** Métodos referenciam `this.actor`, `this.element`, state interno (scroll, modals, expanded sections). Extrair requer criar interfaces de passagem de contexto.
- **1 dependente externo:** `cardigan.mjs` importa `CardiganSystemActorSheet`.
- **13 dependências de módulos extraídos** (`actions/`, `listeners/`, `parts/`) — já parcialmente modularizado.

### O que é inferência
- **`cardigan.mjs` é mais fácil e mais seguro de refatorar.** Funções independentes, sem classe envolvente, zero dependentes. Cada bloco (combat, trade, chat, macros) pode ser extraído como commit isolado sem risco de quebrar o restante.
- **`actor-sheet.mjs` é mais impactante** — é onde se trabalha no dia a dia (2.3x mais editado). Mas a extração requer mais cuidado porque envolve métodos de classe com estado compartilhado.
- **Refatorar `cardigan.mjs` primeiro desbloqueia a refatoração de `actor-sheet.mjs`** — ao extrair combat dialogs, trade system e chat hooks, o entry point fica limpo, e fica mais fácil localizar onde `actor-sheet.mjs` interage com esses subsistemas.

### Decisão segura recomendada

**Começar por `cardigan.mjs`.** Razões:

1. **Menor risco:** Funções são module-scoped, sem classe, sem `this`. Extrair para arquivo novo = mover + importar, sem refatorar interfaces.
2. **Maior ganho organizacional por esforço:** 6 blocos independentes que somam ~2.800 linhas podem ser extraídos em ~6 commits simples, reduzindo `cardigan.mjs` de 3.750 para ~950 linhas.
3. **Não bloqueia desenvolvimento:** Ninguém está ativamente editando combat dialogs enquanto trabalha na sheet.
4. **Prepara terreno:** Após extrair combat/trade/chat de `cardigan.mjs`, fica mais claro quais partes de `actor-sheet.mjs` dependem desses subsistemas.

**Para `actor-sheet.mjs`:** abordar incrementalmente DEPOIS de `cardigan.mjs`, seguindo o backlog já documentado (modal de abilities → context menu → drag & drop → listeners dinâmicos).

### Impacto na refatoração
- O plano de Fase 1 (limpeza segura) + Fase 2 (separação de `cardigan.mjs`) pode começar imediatamente.
- `actor-sheet.mjs` entra como Fase 3, com abordagem mais gradual.

### Próximas ações para `cardigan.mjs`
- [ ] Extrair combat dialogs → `module/combat/combat-dialogs.mjs` (~1.400 linhas)
- [ ] Extrair trade handlers → `module/trade/trade-handlers.mjs` (~457 linhas)
- [ ] Extrair merchant trade → `module/trade/merchant-trade-handlers.mjs` (~400 linhas)
- [ ] Extrair chat hooks → `module/hooks/chat-hooks.mjs` (~300 linhas)
- [ ] Extrair evasion/precision handlers → `module/combat/evasion-precision.mjs` (~567 linhas)
- [ ] Extrair macro hotbar → `module/helpers/macro.mjs` (~48 linhas)
- [ ] Consolidar Handlebars helpers duplicados (remover de `cardigan.mjs`, manter em `config.mjs`)
- [ ] Consolidar hooks duplicados (`setup` x2, `ready` x2)

---

## Tabela de Decisões Recomendadas

| # | Decisão | Justificativa | Risco se não feito |
|---|---------|---------------|--------------------|
| 1 | Manter `css/cardigan.css` versionado | Sem CI/CD, o build artifact precisa estar no repo | Nenhum |
| 2 | Ignorar artefatos LevelDB de packs no `.gitignore` | Reduz ruído em commits | Poluição de diffs |
| 3 | NÃO remover `template.json` sem teste prévio | Pode afetar mundos criados antes dos DataModels | Perda de dados |
| 4 | Manter `verified: "12"` até testar em v13 | Evita falsa promessa de compatibilidade | Usuários com problemas |
| 5 | Substituir `foundry.utils.duplicate()` por `deepClone()` | Deprecated em v12, pode ser removido em v13 | Quebra futura |
| 6 | NÃO renomear campos de schema (PT→EN) | Quebraria macros e dados salvos | N/A |
| 7 | NÃO renomear/remover `game.cardigan.rollItemMacro()` | Usado por macros de hotbar | Macros quebram |
| 8 | Remover factory methods do `item-consumivel` (código morto) | Nunca chamadas, 142 linhas eliminadas | Nenhum |
| 9 | Investigar `modifiers.*` antes de remover | Pode ter dados em mundos | Perda de dados |
| 10 | Começar refatoração por `cardigan.mjs`, não `actor-sheet.mjs` | Menor risco, funções independentes | N/A |

## O que NÃO Fazer Ainda

1. **NÃO renomear campos de schema** (`protecao` → `protection`, etc.) — requer migração de dados, versão major, camada de compat.
2. **NÃO remover `template.json`** sem testar em mundo real primeiro.
3. **NÃO refatorar `render(true)` → `render({force: true})`** — são 70+ locais, alto risco, e v12 ainda aceita boolean.
4. **NÃO mexer no `actor-sheet.mjs`** antes de terminar `cardigan.mjs`.
5. **NÃO remover campos `modifiers.*`** do `item-consumivel` sem verificar mundos existentes.
6. **NÃO criar sistema de migração de dados** — não é necessário para nenhuma refatoração planejada na Fase 1-2.
7. **NÃO atualizar `compatibility` para v13** sem teste real.
8. **NÃO reescrever `README.md`** — não é blocker e pode distrair do trabalho real.

## Primeiro Conjunto Seguro de Mudanças (Fase 1)

Todas essas são reversíveis, não mudam comportamento, e não quebram nada:

1. ~~`.gitignore` — adicionar artefatos LevelDB de packs~~ ✅
2. ~~`package.json` — corrigir `author`, sincronizar `version` com `system.json`~~ ✅
3. ~~`system.json` — corrigir URLs placeholder~~ ✅
4. ~~`cardigan.mjs` — consolidar dois `Hooks.once('setup')` em um~~ ✅
5. ~~`cardigan.mjs` — consolidar dois `Hooks.once('ready')` em um~~ ✅
6. ~~`cardigan.mjs` — remover Handlebars helpers duplicados (manter apenas em `config.mjs`)~~ ✅
7. ~~`item-consumivel.mjs` — remover 6 factory methods (código morto)~~ ✅
8. `template.json` — renomear para `template.json.legacy` (testar antes)
9. ~~Deletar `lib/some-lib/` (placeholder vazio do boilerplate)~~ ✅
10. ~~`item-sheet.mjs:1765,1823` — substituir `foundry.utils.duplicate()` por `deepClone()`~~ ✅

## Plano de Commits Pequenos

```
Commit 1: chore: adicionar artefatos LevelDB ao .gitignore
  - .gitignore: packs/*/CURRENT, LOG, LOG.old, MANIFEST-*

Commit 2: chore: corrigir metadados do projeto (package.json, system.json)
  - package.json: author → "Spinelli666", version → "1.3.7"
  - system.json: url, bugs → GitHub repo URL

Commit 3: chore: remover placeholder boilerplate lib/some-lib/
  - Deletar lib/some-lib/ (diretório com arquivos vazios)

Commit 4: refact: consolidar hooks duplicados em cardigan.mjs
  - Juntar dois Hooks.once('setup') em um
  - Juntar dois Hooks.once('ready') em um

Commit 5: refact: remover Handlebars helpers duplicados de cardigan.mjs
  - Remover helpers registrados em cardigan.mjs que já existem em config.mjs
  - NÃO remover os de config.mjs (são chamados via registerHandlebarsHelpers())

Commit 6: refact: substituir foundry.utils.duplicate() por deepClone()
  - item-sheet.mjs linhas 1765 e 1823

Commit 7: refact: remover factory methods não utilizadas do item-consumivel
  - Remover createHealingPotion, createEnergyPotion, createAntidote,
    createBomb, createFoodItem, createSkillBuffPotion (142 linhas)

Commit 8: chore: deprecar template.json (renomear para .legacy)
  - TESTAR NO FOUNDRY ANTES DE COMMITAR
  - Se funcionar: commitar renomeação
  - Se quebrar: reverter e documentar o que falhou
```

**Estimativa total: ~1-2 horas de trabalho para os 8 commits.**
Após isso, o terreno está limpo para começar a Fase 2 (extração de blocos de `cardigan.mjs`).
