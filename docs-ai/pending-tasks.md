# Tarefas Pendentes (Resumo Acionável)

Este arquivo é um **resumo organizado e acionável** das investigações registradas em [`FUTURE_INVESTIGATIONS.md`](../FUTURE_INVESTIGATIONS.md) (raiz do projeto). Esse arquivo histórico contém o detalhamento completo, comparações com outros sistemas, exemplos de código e justificativas — **não foi alterado e deve ser consultado para contexto completo** antes de iniciar qualquer item abaixo marcado como tarefa grande.

Última sincronização com `FUTURE_INVESTIGATIONS.md`: última atualização registrada lá foi 14/01/2026, com adição de 28/03/2026 (backlog de extrações do `actor-sheet.mjs`). Atualizado em 30/06/2026 com conclusão da Fase 2 de `cardigan.mjs`. Atualizado em 01/07/2026 com conclusão da Fase 3 de `skill-manager.mjs`. Atualizado em 03/07/2026 com conclusão da refatoração do `actor-sheet.mjs`. Atualizado em 03/07/2026 com conclusão da Fase 4 (Weapon Properties base class). Atualizado em 04/07/2026 com conclusão da Fase 2 (Templates Handlebars). Atualizado em 23/09/2026: migração PT→EN dos schemas registrada como concluída, status de v14 e novos itens (`item-sheet.mjs`, style-lab, `render(true)`, i18n de `ArmorType`).

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

O arquivo restante (~350 linhas) é puro bootstrap: imports, `globalThis.cardigan`, hooks `init`/`setup`/`ready`, e os hooks `preCreateActiveEffect`/`updateItem`. Ver estrutura atualizada em [architecture.md](architecture.md).

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

Nenhuma ação pendente aqui — registrado apenas para histórico/contexto (ver opções A/B/C avaliadas em `FUTURE_INVESTIGATIONS.md` caso um padrão similar seja necessário em outro efeito).

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

## ✅ Concluído — Fase 2: Templates Handlebars — 04/07/2026

9 partials reutilizáveis criados em `templates/actor/partials/` ao longo de 9 commits cirúrgicos, eliminando HTML duplicado em `templates/actor/`:

| Commit | Partial | Extraído de |
|--------|---------|-------------|
| 1 | `skill-row.hbs` | `professions.hbs` — linha de skill em listas de profissão |
| 2 | `recipe-row.hbs` | `professions.hbs` — linha de receita (cozinha/costura/tecnomagia) |
| 3 | `durability-display.hbs` | `equipment.hbs` — exibição de durabilidade de armadura |
| 4 | `armor-info-badges.hbs` | `equipment.hbs` — badges de proteção, tipo, peso e slot |
| 5 | `equipped-armor-item.hbs` | `equipment.hbs` — item de armadura equipado (compõe commits 3+4) |
| 6 | `proficiency-item.hbs` | `proficiencies.hbs` — linha de proficiência por habilidade |
| 7 | `sequential-status-field.hbs` | `header.hbs` — campo de status sequencial (fome, sede, vida, energia) |
| 8 | `weapon-reload-ammo.hbs` | `equipment.hbs` — wrapper de reload e display de munição |
| 9 | `armor-section-container.hbs` | `equipment.hbs` — container de seção de armadura por tipo de corpo (6 slots) |

Todos os partials registrados via `foundry.applications.handlebars.loadTemplates()` no hook `init` de `module/cardigan.mjs`. Os partials originalmente planejados em `FUTURE_INVESTIGATIONS.md` (`item-row.hbs`, `effect-badge.hbs`, etc.) foram substituídos pelos listados acima, que refletem a duplicação real encontrada nos templates.

---

## ✅ Concluído — Padronização de idioma PT→EN (schemas, valores e arquivos) — 04/07/2026

Executada ao longo de ~20 commits cirúrgicos (`refact(schema): ... (C1–C11)` + renomeações de arquivos):

| Escopo | Exemplos |
|--------|----------|
| Campos de schema | armadura: `protecao→protection`, `bonusVida→lifeBonus`, `bonusEnergia→energyBonus`, `bonusDeslocamento→movementBonus`, `bonusEspacoMochila→backpackBonus`; efeito: `efeitoType→effectType`, `rodadas→rounds`; consumível: `statusEffects.fome→hunger` etc.; receita: `customProperties.protecao→protection`; character: `classes.guerreiro→warrior`, flags `showSkills*` |
| Valores de choices | `armorType` (`cabeca→head`…), `weight` (`muito-pesado→very-heavy`…), `skillClass`, `skillActionTypes`, `spellCategories`, `effectType`, `properties` de arma (`ferir→wound`…) |
| Arquivos | `module/data/`, `module/effects/effects/`, `module/weapon-properties/properties/`, `templates/item/attribute-parts/`, SCSS, `scripts/`, `docs-ai/` |
| Compêndios | fontes de `src/packs/` migrados; packs renomeados para `effects-cardigan`, `races-cardigan`, `equipment-cardigan` |

- Migração automática de mundos existentes em `module/migration/migrate-world.mjs` (`SCHEMA_VERSION = 1`, roda no `ready`, só GM).
- A camada de aliases com `logCompatibilityWarning` prevista no plano original **não** foi implementada — a migração é direta via `migrateWorldData()`.
- **Mantidos em português de propósito:** ids de tipo de Actor/Item (`arma`, `armadura`, `efeito`, `item-comum`…), nomes de classes (`SangramentoEffect`, `Ferir`…) e chaves de registro do `EffectManager` (`'Sangramento'`…). Ver tabela completa em [project-conventions.md](project-conventions.md#idioma-do-código-e-dos-schemas).

---

## 🔴 Em andamento — Microdeslocamentos (sub-pixel) na ficha

**Relato (23/09/2026):** textos e pequenos elementos da ficha "tremem" cerca de 1px ao rolar e ao mudar o zoom, só em algumas telas/máquinas. Análise externa: `analise_microdeslocamentos_interface_web.docx`. Conclusão dela: a causa não é `px` em si, e sim coordenadas fracionárias + camadas de composição. Os sistemas de referência (dnd5e, pf2e, daggerheart, olddragon2e) não apresentam o problema. Regras preventivas em [project-conventions.md](project-conventions.md#estabilidade-de-renderização-microdeslocamentos--sub-pixel).

Por que só em algumas telas: com DPR inteiro (escala do Windows em 100%, zoom 100%), valores `.5px` e camadas de GPU caem em pixels físicos exatos. Com escala de 125%/150% ou zoom ≠ 100%, tudo vira fração e cada camada é arredondada de forma independente durante o scroll.

**Mapa de pontos quentes em `src/scss/` (levantado em 23/09/2026):**

| Padrão | Ocorrências | Onde | Risco |
|--------|-------------|------|-------|
| `will-change: transform, filter` permanente | 12 | `equipment/_backpack.scss` (5), `equipment/_equipament-banner.scss` (7) — em `img` de **cada linha** da mochila/banner | 🔴 Alto — uma camada de GPU por ícone, dentro de área que rola |
| `will-change: width/opacity` | 6 | `_health-bar.scss`, `_energy-bar.scss` | 🟡 Médio — header, fora da área que rola |
| `transform: translateZ(0)` permanente | 2 | `aside-left/_death-fields.scss:13`, `_forms.scss:64` | 🔴 Alto — promove containers inteiros a camada |
| `translate(-50%…)` para centralizar | 46 | `aside-left/*`, `aside-right/*` (death-fields, movement-crit, fracture, hunger-thirst…) | 🟡 Médio — gera `.5px` em caixas de tamanho ímpar |
| px fracionário em propriedade de layout | 81 | pior: `_consumable-form.scss` (10), `_movement-crit.scss`, `_ingredient-form.scss`, `_health-bar.scss`, `_energy-bar.scss` (5 cada); ex.: `width: 155.54px`, `width: 400.444px`, `margin: 0.5px` | 🟡 Médio |
| `line-height` sem unidade fracionário | 60 | 33 arquivos | 🟢 Baixo |
| `background-clip: text` (gradiente) | 335 | 40 arquivos | 🟡 Médio se combinado com transform/filter em ancestral |
| `filter:` / `backdrop-filter` | 167 / 12 | 46 / 9 arquivos (grande parte em `:hover`) | 🟢–🟡 depende se é permanente |

**Plano (cirúrgico, um passo por commit, testar em escala 125%/150% do Windows e zoom 90%/110%):**
1. **Diagnóstico nas máquinas afetadas:** identificar a área que treme e rodar `getBoundingClientRect()` durante o scroll (roteiro no docx, seção 6). Se possível, anotar escala do Windows, zoom e GPU de quem tem o problema.
2. **Fase 1 — camadas de composição (maior chance de resolver):** remover os 12 `will-change` da mochila/banner e os 2 `translateZ(0)`. A transição de hover continua funcionando. ⏳ **Aplicada em 23/09/2026, aguardando teste.** Área relatada: nomes dos itens da tabela do inventário e contador de espaço "0|0". Também incluído nesta fase: `_inventory-banner.scss`, onde `.status-current`/`.status-next` (o "0|0") perderam o `top: -0.3px` e `font-size: 0.8rem` (12,8px) virou `13px`.
   - **Resultado (vídeo gravado depois da Fase 1, arrastando a janela, Windows em 125%):** medido quadro a quadro com OpenCV:
     - Texto contra texto: estável (~0,06px).
     - Texto contra ícone, imagem ou borda: oscila ~0,4px, com picos de ~1px.

     Conclusão: o texto se alinha ao pixel físico, e imagens, SVG, fundos e bordas são desenhados na posição fracionária da janela. Causa-raiz: o core (`ApplicationV2#_updatePosition` / `#applyPosition`, v14.367) aplica `left`/`top`/`width`/`height` sem arredondar. Com DPR 1,25 as coordenadas do mouse são fracionárias, e a centralização inicial também gera `.5px`.
2b. **Fase 1b — posição da janela na grade de pixels físicos:** ⏳ **aplicada em 23/09/2026, aguardando novo vídeo.** `module/sheets/parts/pixel-snap-position.mjs` (`snapPositionToDevicePixels`) arredonda `left`/`top`/`width`/`height` para múltiplos de `1/devicePixelRatio`. É usado via override de `_updatePosition` em `actor-sheet.mjs` e `item-sheet.mjs`.
2c. **Fase 1c — imagens de fundo com `contain`:** ⏳ **aplicada só no `.status-display` do inventário ("0|0"/"5|15") em 23/09/2026, aguardando teste.** Foi o usuário que apontou esse elemento como o indicador mais claro: o fundo "desliza" ao arrastar a ficha. `back-space.webp` (1526×444) com `contain` em 132×20 resultava em 68,74×20 a x=31,63px. Trocado por `background-size: 68px 20px`. Restam **21** `background-size: contain/cover/%` em `src/scss/`: `_advantage-selection-dialog`, `_money-business-banner` (3 cada); `global/_window`, `_rich-tooltips`, `_tabs-legacy`, `_backpack` (2 cada); e outros. Se o teste confirmar, corrigir um por um. Também vale considerar gerar versões reduzidas dos bitmaps gigantes (ex.: 2× o tamanho exibido).
3. **Fase 2 — centralização:** trocar `absolute + translate(-50%)` por centralização via flex/grid no pai, componente por componente (começar por `aside-left/`).
4. **Fase 3 — medidas fracionárias:** arredondar os px fracionários de layout, começando pelos arquivos da tabela.
5. **Fase 4 — tipografia:** `line-height` em px inteiros nos componentes compactos afetados.

---

## 🟡 Prioridade média — Outras refatorações planejadas

Detalhes completos e exemplos de código em `FUTURE_INVESTIGATIONS.md`.

- **Fase 5 — JSDoc**: adicionar JSDoc consistente em data models, helpers principais, weapon properties e effect classes (padrão pf2e).
- **`item-sheet.mjs` (~2.850 linhas)**: hoje é o maior arquivo do sistema, maior que o `actor-sheet.mjs` pós-refatoração. Candidato a extrações no mesmo padrão cirúrgico (listeners/parts por tipo de item, wrappers mantidos). Outros arquivos grandes: `sheets/actions/consumable-actions.mjs` (~2.400), `sheets/listeners/common-item-listeners.mjs` (~1.500), `combat/combat-dialogs.mjs` (~1.450), `skills/base-skill.mjs` (~1.370). **Não planejado ainda** — requer decisão.

---

## 🟢 Pequenos itens / limpeza

- **Style Lab (`module/dev-tools/style-lab.mjs`)**: ferramenta de dev marcada como temporária. Remover antes de um release público (apagar o arquivo + linhas `[STYLELAB]` em `cardigan.mjs`).
- **`render(true)` / `render(false)`**: 79 ocorrências em `module/`. Funciona no v14; migrar gradualmente para `render({ force: true })` durante outras mudanças, nunca em massa.
- **`TextEditor.implementation.enrichHTML`**: 29 ocorrências (o doc de v14 estimava 5). Unificar para `foundry.applications.ux.TextEditor.enrichHTML` durante refatorações.
- **i18n de `ArmorType` em `lang/pt-BR.json`**: as chaves continuam em PT (`CARDIGAN.ArmorType.Cabeca`) e os **valores estão em inglês** (`"Head"`, `"Arms"`, `"Legs"`, `"Feet"`, `"Accessories"`) desde o commit `bd5fff7` (21/01/2026). Aparece em inglês para o usuário (diálogo de seleção de tipo de armadura, choices do item). **Confirmar se é intencional** antes de corrigir.

---

## 🟢 Hipótese / investigação não confirmada — Redução de `!important` no SCSS de equipamento

**Status:** Documentado em 10/08/2026, **decisão atual é não agir agora**. Feedback recebido de terceiros (fórum), sem ligação com bug ativo.

**Situação:**
- `src/scss/components/equipment/` tem 68 ocorrências de `!important`.
- `src/scss/` inteiro tem 55 arquivos com pelo menos um `!important` (59 na recontagem de 23/09/2026, após a extração de mixins em `utils/_mixins.scss` na `develop`).
- Origem provável: mesmas classes (`.item-ammunition`, `.item-quantity`, etc.) redefinidas em múltiplos arquivos para contextos visuais diferentes (mochila em `_backpack.scss` vs. arma equipada em `_equipament-banner.scss`), gerando conflitos de especificidade resolvidos com `!important` em vez de seletores mais específicos.

**Decisão temporária (vigente):**
- Não fazer refatoração ampla agora — 55 arquivos é escopo grande, alto risco de regressão visual, sem relação com o bug de "pulo" de sub-pixel investigado no mesmo dia (`!important` afeta apenas especificidade de cascata, não arredondamento/renderização).
- Se retomada, seguir o padrão cirúrgico já usado no projeto (ver refatorações concluídas acima): um componente/arquivo por vez, nunca reescrita geral.
- Antes de remover qualquer `!important`, mapear por que foi introduzido (provável conflito de especificidade entre `_backpack.scss` e `_equipament-banner.scss` reaplicando a mesma classe) para não quebrar overrides intencionais.

---

## Como usar este arquivo

- Antes de iniciar qualquer refatoração de sheets/skills/effects/weapon-properties, releia a seção correspondente aqui **e** em `FUTURE_INVESTIGATIONS.md` para contexto completo (exemplos de código-alvo, comparações com outros sistemas).
- Ao concluir um item, atualize tanto este arquivo (mover para "Concluído") quanto, se fizer sentido, adicionar uma nota em `FUTURE_INVESTIGATIONS.md` (sem apagar o histórico existente).
- Itens marcados como "hipótese/investigação não confirmada" exigem decisão explícita do usuário antes de virarem trabalho ativo.
