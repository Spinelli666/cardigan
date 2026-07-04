# Tarefas Pendentes (Resumo Acionável)

Este arquivo é um **resumo organizado e acionável** das investigações registradas em [`INVESTIGACOES_FUTURAS.md`](../INVESTIGACOES_FUTURAS.md) (raiz do projeto). Esse arquivo histórico contém o detalhamento completo, comparações com outros sistemas, exemplos de código e justificativas — **não foi alterado e deve ser consultado para contexto completo** antes de iniciar qualquer item abaixo marcado como tarefa grande.

Última sincronização com `INVESTIGACOES_FUTURAS.md`: última atualização registrada lá foi 14/01/2026, com adição de 28/03/2026 (backlog de extrações do `actor-sheet.mjs`). Atualizado em 30/06/2026 com conclusão da Fase 2 de `cardigan.mjs`. Atualizado em 01/07/2026 com conclusão da Fase 3 de `skill-manager.mjs`. Atualizado em 03/07/2026 com conclusão da refatoração do `actor-sheet.mjs`. Atualizado em 03/07/2026 com conclusão da Fase 4 (Weapon Properties base class).

---

## ✅ Concluído — Refatoração de `cardigan.mjs` (Fase 2) — 30/06/2026

`cardigan.mjs` foi reduzido de ~3.584 para ~350 linhas (−90%) ao longo de 6 commits cirúrgicos, extraindo cada bloco funcional para um módulo dedicado:

| Commit | Extração | Destino |
|--------|----------|---------|
| 1 | Macro hotbar | `module/helpers/macro.mjs` |
| 2 | Trade P2P handlers | `module/trade/trade-handlers.mjs` |
| 3 | Merchant trade handlers | `module/trade/merchant-trade-handlers.mjs` |
| 4 | Combat dialogs (atacante/GM/durabilidade) | `module/combat/combat-dialogs.mjs` |
| 5 | Evasion/precision click handlers | `module/combat/evasion-precision.mjs` |
| 6 | Chat hooks (renderChatMessageHTML x6) | `module/hooks/chat-hooks.mjs` |

O arquivo restante (~350 linhas) é puro bootstrap: imports, `globalThis.cardigan`, hooks `init`/`setup`/`ready`, e os hooks `preCreateActiveEffect`/`updateItem`. Ver estrutura atualizada em [arquitetura.md](arquitetura.md).

---

## ✅ Concluído — Refatoração do `actor-sheet.mjs` — 03/07/2026

`actor-sheet.mjs` foi reduzido de ~9.631 para ~1.512 linhas (−84%) ao longo de múltiplos commits cirúrgicos. Toda a lógica coesa foi extraída para módulos dedicados nas subpastas abaixo.

**`sheets/actions/`** — handlers de ação estáticos:

| Módulo | Responsabilidade |
|--------|-----------------|
| `ammunition-actions.mjs` | Gestão de munição e diálogo reativo |
| `weapon-actions.mjs` | Fluxo de ataque com arma e detecção de críticos |
| `equipment-actions.mjs` | Equipar/desequipar arma+armadura |
| `consumable-actions.mjs` | Consumo de itens, skill-check/crit, tracking de efeitos |
| `inventory-actions.mjs` | Gestão de inventário |
| `header-actions.mjs` | Ações do cabeçalho |
| `header-status-actions.mjs` | Ações de status no cabeçalho |
| `proficiencies-actions.mjs` | Gestão de proficiências |
| `money-trade-actions.mjs` | Troca de dinheiro |
| `backpack-search-actions.mjs` | Busca na mochila |
| `sheet-scroll-actions.mjs` | Scroll da sheet |
| `item-prepare-actions.mjs` | Preparação de itens |
| `profession-filter-actions.mjs` | Filtros de profissão |
| `recipe-actions.mjs` | Cozinhar/craftar receitas |
| `drag-drop-actions.mjs` | Drag & drop, sort e criação por drop |
| `context-menu-actions.mjs` | Context menu completo |
| `delete-actions.mjs` | Deleção com guards para efeitos auto-gerenciados, raças e consumíveis |

**`sheets/listeners/`** — configuração de listeners de eventos DOM:

| Módulo | Responsabilidade |
|--------|-----------------|
| `header-listeners.mjs` | Listeners do cabeçalho |
| `armor-item-listeners.mjs` | Listeners de itens de armadura |
| `common-item-listeners.mjs` | Listeners comuns de itens |
| `abilities-listeners.mjs` | Listeners de abilities e derived stats |
| `equipment-field-listeners.mjs` | Durabilidade, quantidade e munição |
| `stat-field-listeners.mjs` | XP, bônus e valores |
| `proficiency-listeners.mjs` | Proficiências |
| `enhancement-listeners.mjs` | Enhancements de skills |
| `misc-listeners.mjs` | name-input e form-enter |
| `window-controls-listeners.mjs` | Controles de janela |
| `overrides-listeners.mjs` | disableOverrides |

**`sheets/parts/`** — contexto e comportamento por parte:
`armor-context.mjs`, `header-context.mjs`, `weapon-ammunition-behavior.mjs`, `sheet-base-behavior.mjs`, `armor-sheet-behavior.mjs`, `ingredient-sheet-behavior.mjs`, `ammunition-sheet-behavior.mjs`, `item-expand.mjs` (toggle expand/collapse).

O arquivo restante (~1.512 linhas) contém lifecycle hooks, `_prepareContext`, `_preparePartContext` e wrappers finos de `DEFAULT_OPTIONS.actions`.

**Fase 1 (split base/character/npc):** Avaliada e descartada. Com o arquivo nessa escala e a diferença character/NPC resolvida em `_configureRenderOptions`, o custo de herança supera o benefício. Revisitar apenas se a sheet de NPC precisar divergir significativamente no futuro.

---

## ✅ Concluído — Refatoração de Toxicity Effects (Etapa 6)

`ToxicidadeEffect` foi criado seguindo o padrão de `ExaustaoEffect`/`FraturaEffect`:
- `module/effects/effects/toxicidade.mjs` criado e exportado em `module/effects/index.mjs`, registrado no `EffectManager`.
- Integrado ao `actor._onUpdate` hook (Opção B do leque de soluções avaliado).
- `setTimeout` removido de `prepareDerivedData()`; ~172 linhas de métodos deprecated removidas.

Nenhuma ação pendente aqui — registrado apenas para histórico/contexto (ver opções A/B/C avaliadas em `INVESTIGACOES_FUTURAS.md` caso um padrão similar seja necessário em outro efeito).

---

## ✅ Concluído — Refatoração de `skill-manager.mjs` (Fase 3) — 01/07/2026

`skill-manager.mjs` foi reduzido de ~2.029 para ~309 linhas ao longo de 4 commits cirúrgicos, extraindo cada bloco funcional para um módulo dedicado:

| Commit | Extração | Destino |
|--------|----------|---------|
| 1 | Funções de ataque padrão (`performUnifiedSkillAttack`, `performDefaultPrimaryAttack`, etc.) | `module/skills/skill-default-attacks.mjs` |
| 2 | Funções de mensagens de chat (`defaultSkillToChat`, `updateSkillChatMessage`, `spendEnergyForUnregisteredSkill`) | `module/skills/skill-chat-message.mjs` |
| 3 | Funções de expansão de UI e tooltips (`expandDefaultSkill`, `setupDefaultDynamicTooltips`, etc.) | `module/skills/skill-expand-ui.mjs` |
| 4 | Hooks de chat (`onRenderChatMessageHTML`, `setupEnhancementTooltips`, `getButtonSelectorsForSkill`) | `module/skills/skill-chat-hooks.mjs` |

O arquivo restante (~309 linhas) é puro orchestrator: registry, `initialize()`, `registerSkill`, `getSkill`, `generateSkillButtons`, `handleSkillToChat`, `updateSkillChatMessage`, `applyCustomEffectsForUnregisteredSkill` e seus wrappers públicos. A redução original planejada era para ~1.200 linhas via estrutura de profissões/racial-skills — a abordagem adotada foi mais radical (~85% redução) ao extrair por responsabilidade funcional em vez de por tipo de skill.

---

## ✅ Concluído — Fase 4: Weapon Properties base class — 03/07/2026

`base-weapon-property.mjs` foi expandido com template method completo para aplicação de efeitos de compêndio, e as 5 propriedades de efeito de compêndio foram simplificadas de ~124 para 18 linhas cada (−530 linhas no total):

| Commit | Mudança |
|--------|---------|
| 1 | `base-weapon-property.mjs`: adicionados 6 static getters de config (`effectName`, `socketApplyType`, `socketNotifyType`, `effectEmoji`, `logTag`, `defaultWeaponName`), `onCriticalHit()` default impl, `applyCompendiumEffect()` e `applyCompendiumEffectStatic()` |
| 2 | `ferir`, `incendiar`, `eletrocutar`, `traspassar`, `contundente` reescritos: apenas os 6 getters de config + alias de backward-compat |

`impacto.mjs` não foi alterado — incrementa campo numérico `system.status.fracture`, não aplica efeito de compêndio, portanto não se enquadra no template method. `certeiro.mjs` e `vorpal.mjs` são passivos sem `onCriticalHit`, não precisam de mudança.

---

## 🟡 Prioridade média — Outras refatorações planejadas (Fases 2, 5)

Detalhes completos e exemplos de código em `INVESTIGACOES_FUTURAS.md`.

- **Fase 2 — Templates Handlebars**: criar partials reutilizáveis (`item-row.hbs`, `proficiency-row.hbs`, `skill-card.hbs`, `effect-badge.hbs`, `ability-score.hbs`, `resource-bar.hbs`, `armor-slot.hbs`, `weapon-slot.hbs`) para reduzir HTML duplicado em `templates/actor/`.
- **Fase 5 — JSDoc**: adicionar JSDoc consistente em data models, helpers principais, weapon properties e effect classes (padrão pf2e).

---

## 🟢 Hipótese / investigação não confirmada — Padronização de idioma (PT→EN nos schemas)

**Status:** Documentado em 14/01/2026, **decisão atual é manter como está**. Não iniciar sem alinhamento explícito.

**Situação:**
- Classes/métodos: inglês (ok).
- Campos de schema: português (`protecao`, `bonusVida`, `bonusEnergia`, `armorType` com valores `"cabeca"`, `"torso"`, etc.) — inconsistente com classes/métodos.
- Chaves i18n: inglês (ok).
- Comentários: mistos PT/EN.

**Decisão temporária (vigente):**
- Manter campos em português (compatibilidade com dados/saves/compêndios existentes).
- Padronizar comentários novos em inglês (JSDoc).
- Métodos/constantes já seguem inglês.

**Se esta migração for retomada no futuro**, o plano completo (8 etapas: mapeamento, sistema de migração de dados, refatoração de schemas, atualização de templates, refatoração de sheets, atualização de compêndios, camada de compatibilidade com `logCompatibilityWarning`, testes) está detalhado em `INVESTIGACOES_FUTURAS.md`, incluindo tabela de riscos/mitigações. Tratar como **versão major (v2.0)**, não como tarefa incremental.

---

## Como usar este arquivo

- Antes de iniciar qualquer refatoração de sheets/skills/effects/weapon-properties, releia a seção correspondente aqui **e** em `INVESTIGACOES_FUTURAS.md` para contexto completo (exemplos de código-alvo, comparações com outros sistemas).
- Ao concluir um item, atualize tanto este arquivo (mover para "Concluído") quanto, se fizer sentido, adicionar uma nota em `INVESTIGACOES_FUTURAS.md` (sem apagar o histórico existente).
- Itens marcados como "hipótese/investigação não confirmada" exigem decisão explícita do usuário antes de virarem trabalho ativo.
