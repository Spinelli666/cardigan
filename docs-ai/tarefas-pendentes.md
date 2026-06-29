# Tarefas Pendentes (Resumo Acionável)

Este arquivo é um **resumo organizado e acionável** das investigações registradas em [`INVESTIGACOES_FUTURAS.md`](../INVESTIGACOES_FUTURAS.md) (raiz do projeto). Esse arquivo histórico contém o detalhamento completo, comparações com outros sistemas, exemplos de código e justificativas — **não foi alterado e deve ser consultado para contexto completo** antes de iniciar qualquer item abaixo marcado como tarefa grande.

Última sincronização com `INVESTIGACOES_FUTURAS.md`: última atualização registrada lá foi 14/01/2026, com adição de 28/03/2026 (backlog de extrações do `actor-sheet.mjs`).

---

## 🔴 Prioridade alta — Refatoração do `actor-sheet.mjs`

**Contexto:** `actor-sheet.mjs` está com ~9.631 linhas (monolítico), muito acima de sistemas de referência (dnd5e ~1.350, pf2e ~940, daggerheart ~1.014). Ver detalhes e exemplos de padrão alvo (inspirado no dnd5e) em `INVESTIGACOES_FUTURAS.md`, seção "REFATORAÇÃO PRINCIPAL: Actor Sheet Modularização" / "Backlog de Extrações Cirúrgicas".

### Já extraído (concluído)
- `module/sheets/actions/ammunition-actions.mjs` — gestão de munição, diálogo reativo, listeners de atualização.
- `module/sheets/actions/weapon-actions.mjs` — fluxo de ataque com arma e detecção de críticos.
- `module/sheets/actions/equipment-actions.mjs` — equipar/desequipar arma+armadura.
- `module/sheets/actions/consumable-actions.mjs` — consumo de itens, skill-check/crit, tracking de efeitos.

### Próximas extrações recomendadas (ordem sugerida)
1. **Modal de abilities + derived stats** — ciclo de abertura/fechamento do modal e sincronização de campos.
2. **Context menu completo** — `_getContextOptions`, `_onAction`, exibição em chat e handlers correlatos.
3. **Drag & drop completo** — handlers de drag/drop, sort e criação por drop.
4. **Listeners de campos dinâmicos** — blocos `#add*Listeners` e `#handle*`.

### Diretrizes para continuidade (válidas para todas as extrações)
- Manter wrappers no `actor-sheet.mjs` para preservar compatibilidade com `DEFAULT_OPTIONS.actions` e integrações externas.
- Extrair por blocos coesos e validar erros após cada etapa.
- Evitar mudança de comportamento no mesmo commit da extração.

### Refatoração estrutural maior (Fase 1 do plano completo, ainda não iniciada)
Estrutura proposta em `INVESTIGACOES_FUTURAS.md` (`module/sheets/actor/api/base-actor-sheet.mjs`, `character-sheet.mjs`, `npc-sheet.mjs`, `helpers/combat-helpers.mjs`, `equipment-helpers.mjs`, `profession-helpers.mjs`, `ability-helpers.mjs`). Objetivo: reduzir `actor-sheet.mjs` de ~9.631 para ~2.000 linhas. Esta é uma refatoração grande — tratar como projeto à parte, com plano próprio antes de executar.

---

## ✅ Concluído — Refatoração de Toxicity Effects (Etapa 6)

`ToxicidadeEffect` foi criado seguindo o padrão de `ExaustaoEffect`/`FraturaEffect`:
- `module/effects/effects/toxicidade.mjs` criado e exportado em `module/effects/index.mjs`, registrado no `EffectManager`.
- Integrado ao `actor._onUpdate` hook (Opção B do leque de soluções avaliado).
- `setTimeout` removido de `prepareDerivedData()`; ~172 linhas de métodos deprecated removidas.

Nenhuma ação pendente aqui — registrado apenas para histórico/contexto (ver opções A/B/C avaliadas em `INVESTIGACOES_FUTURAS.md` caso um padrão similar seja necessário em outro efeito).

---

## 🟡 Prioridade média — Outras refatorações planejadas (Fases 2-5)

Detalhes completos e exemplos de código em `INVESTIGACOES_FUTURAS.md`.

- **Fase 2 — Templates Handlebars**: criar partials reutilizáveis (`item-row.hbs`, `proficiency-row.hbs`, `skill-card.hbs`, `effect-badge.hbs`, `ability-score.hbs`, `resource-bar.hbs`, `armor-slot.hbs`, `weapon-slot.hbs`) para reduzir HTML duplicado em `templates/actor/`.
- **Fase 3 — `skill-manager.mjs`**: reduzir de ~2.029 para ~1.200 linhas, extraindo `api/base-profession.mjs`, `api/base-racial-skill.mjs`, `skill-registry.mjs`, e movendo profissões/skills raciais para `professions/*.mjs` e `racial-skills/*.mjs`.
- **Fase 4 — Weapon Properties base class**: criar `weapon-properties/base-weapon-property.mjs` com template method (`applyEffect`, `canApply`, `_createEffect`, `_notifyPlayers`) para eliminar duplicação entre os 20+ arquivos de propriedades.
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
