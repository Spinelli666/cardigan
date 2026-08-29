# Compatibilidade Foundry VTT v14 — Sistema Cardigan

Data da análise: 2026-06-29
Foundry atual: v14.364 (estável, lançado 10/06/2026)
Cardigan atual: v1.3.7, `compatibility: { minimum: "12", verified: "12" }`

Referências consultadas:
- API docs: https://foundryvtt.com/api/v14/
- Release notes: v13.335-351, v14.355-364
- dnd5e system.json: `minimum: "13.347", verified: "14"`
- daggerheart system.json: `minimum: "14.364", verified: "14.364"`
- pf2e system.json: `minimum: "12.328", verified: "12.331", maximum: "12"`

---

## Resumo Executivo

O Cardigan usa APIs modernas (ApplicationV2, DataModels, DialogV2) e está **bem posicionado para v14**. A maioria dos padrões usados continua funcionando. Há **3 mudanças obrigatórias** de baixo esforço e **4 mudanças recomendadas** para seguir o padrão moderno.

---

## 1. APIs Verificadas como Compatíveis com v14

| API usada pelo Cardigan | Status em v14 | Fonte |
|-------------------------|---------------|-------|
| `ApplicationV2` | ✅ Funciona | API docs v14 |
| `HandlebarsApplicationMixin` | ✅ Funciona, não deprecated | API docs v14 |
| `static PARTS` | ✅ Funciona (via mixin) | API docs v14 |
| `DialogV2` | ✅ Funciona | API docs v14 |
| `TypeDataModel` + `defineSchema()` | ✅ Funciona | API docs v14 |
| `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels` | ✅ Funciona | API docs v14 |
| `CONFIG.Actor.documentClass` / `CONFIG.Item.documentClass` | ✅ Funciona | API docs v14 |
| `render(true)` / `render(false)` | ✅ Funciona — boolean interpretado como `force` | API docs v14: "A boolean is interpreted as the 'force' option" |
| `foundry.utils.duplicate()` | ✅ Ainda existe em v14 | API docs v14 — mas deprecated, usar `deepClone()` |
| `foundry.utils.flattenObject()` | ✅ Ainda existe em v14 | API docs v14 |
| `foundry.utils.mergeObject()` | ✅ Ainda existe em v14 | API docs v14 |
| `foundry.utils.deepClone()` | ✅ Existe | API docs v14 |
| `getDocumentClass()` | ✅ Funciona | API docs v14 |
| `Hooks.on()` / `Hooks.once()` | ✅ Funciona | API docs v14 |
| `foundry.applications.ux.TextEditor` | ✅ Funciona | API docs v14 |
| `foundry.applications.ux.ContextMenu` | ✅ Funciona | API docs v14 |
| `foundry.applications.ux.DragDrop` | ✅ Funciona | API docs v14 |
| `CONFIG.statusEffects` | ✅ Funciona | API docs v14 |
| `CONFIG.TextEditor.enrichers` | ✅ Funciona | API docs v14 |

---

## 2. Mudanças Obrigatórias (vão quebrar ou já quebraram)

### 2.1 Sheet Registration — API mudou

**Situação atual no Cardigan** (`cardigan.mjs:105-113`):
```javascript
foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);
foundry.documents.collections.Actors.registerSheet('cardigan', CardiganSystemActorSheet, { ... });
foundry.documents.collections.Items.unregisterSheet('core', foundry.appv1.sheets.ItemSheet);
foundry.documents.collections.Items.registerSheet('cardigan', CardiganSystemItemSheet, { ... });
```

**API v14 (como o dnd5e faz)**:
```javascript
const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
DocumentSheetConfig.registerSheet(Actor, "cardigan", CardiganSystemActorSheet, {
  makeDefault: true,
  label: "CARDIGAN.SheetLabels.Actor",
});
DocumentSheetConfig.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
DocumentSheetConfig.registerSheet(Item, "cardigan", CardiganSystemItemSheet, {
  makeDefault: true,
  label: "CARDIGAN.SheetLabels.Item",
});
```

**Risco**: `foundry.documents.collections.Actors.registerSheet()` pode ter sido removido ou alterado em v13+. O release note do v13.341 diz: "default actor and item sheet registrations have been removed" — sugere que o padrão de fallback mudou.

**Esforço**: Baixo (4 linhas a alterar).

**Prioridade**: 🔴 Alta — verificar se o padrão antigo ainda funciona em v14 antes de publicar.

### 2.2 `foundry.appv1.sheets.ActorSheet` deprecated since v13

**Situação**: O Cardigan referencia `foundry.appv1.sheets.ActorSheet` e `foundry.appv1.sheets.ItemSheet` para fazer unregister das sheets default. Essas classes estão deprecated desde v13.

**Impacto**: Ainda existem em v14 (para backward compat), mas podem ser removidas em v15/v16.

**Ação**: Continuar usando no `unregisterSheet()` por enquanto — é o padrão que o dnd5e também usa. Mas migrar para `DocumentSheetConfig` é recomendado.

**Esforço**: Trivial (feito junto com 2.1).

### 2.3 `CONFIG.ActiveEffect.legacyTransferral`

**Situação atual** (`cardigan.mjs:102`):
```javascript
CONFIG.ActiveEffect.legacyTransferral = false;
```

**Em v14**: Esta propriedade pode não existir mais (o default já é `false` em v13+). Definir uma propriedade inexistente não causa erro em JS, mas é código morto.

**Ação**: Verificar se a propriedade existe em v14. Se não, remover a linha. Se sim, manter.

**Esforço**: Trivial (1 linha).

---

## 3. Mudanças Recomendadas (funcionam hoje, mas devem ser atualizadas)

### 3.1 `foundry.utils.duplicate()` → `deepClone()`

**Status**: `duplicate()` ainda existe em v14, mas é deprecated. Já corrigimos as 2 ocorrências em `item-sheet.mjs` no commit 6.

**Ação**: ✅ Já feito.

### 3.2 `render(true)` → `render({ force: true })`

**Status em v14**: `render(true)` **ainda funciona** — a API docs confirmam: "A boolean is interpreted as the 'force' option". Porém, o dnd5e v14 já usa `render({ force: true })`.

**Situação no Cardigan**: 70+ ocorrências de `render(true)` e `render(false)`.

**Ação**: NÃO é urgente. Manter `render(true)` funciona em v14. Migrar gradualmente durante refatorações futuras, não como mudança em massa.

**Esforço**: Alto (70+ locais, alto risco de regressão se feito de uma vez).

### 3.3 `TextEditor.implementation.enrichHTML()` vs `TextEditor.enrichHTML()`

**Situação**: O Cardigan usa ambos os padrões:
- `foundry.applications.ux.TextEditor.enrichHTML()` — 10+ locais (correto)
- `foundry.applications.ux.TextEditor.implementation.enrichHTML()` — 5 locais

**Em v14**: Ambos provavelmente funcionam, mas `.implementation` é um acesso indireto desnecessário.

**Ação**: Unificar para `TextEditor.enrichHTML()` durante refatorações. Não é urgente.

**Esforço**: Baixo (5 locais para trocar).

### 3.4 `template.json` — remoção

**Status**: `template.json` é desnecessário com `documentTypes` + DataModels desde v12. Em v14, os sistemas de referência (dnd5e, daggerheart) não usam `template.json`.

**Ação**: Já planejado como Commit 8 da Fase 1. Testar e remover.

---

## 4. Mudanças de v14 que NÃO afetam o Cardigan

| Mudança v14 | Por que não afeta |
|-------------|-------------------|
| Measured Templates removidos | Cardigan não usa Measured Templates |
| Chat Message Visibility Modes (deprecated Roll Mode) | Cardigan usa roll messages mas não customiza Roll Mode |
| Canvas Level edges | Cardigan não customiza canvas edges |
| Particle Generator | Cardigan não usa partículas |
| Scene Regions | Cardigan não usa regions |
| Token shape targeting em ActiveEffects | Cardigan não usa isso |

---

## 5. Plano de Migração para v14

### Fase A — Mudanças mínimas para rodar em v14 (1-2 horas)

```
1. Atualizar sheet registration para DocumentSheetConfig (4 linhas)
2. Verificar/remover CONFIG.ActiveEffect.legacyTransferral (1 linha)  
3. Atualizar compatibility em system.json:
   { "minimum": "12", "verified": "14" }
4. Testar no Foundry v14
```

### Fase B — Modernização gradual (durante refatorações existentes)

```
5. Unificar TextEditor.implementation.enrichHTML → TextEditor.enrichHTML (5 locais)
6. Migrar render(true) → render({ force: true }) gradualmente
7. Remover template.json
```

### Fase C — Decisão de versão mínima (quando pronto)

Se quiser seguir o dnd5e e exigir v13+:
```json
{ "minimum": "13", "verified": "14" }
```

Se quiser manter compatibilidade com v12:
```json
{ "minimum": "12", "verified": "14" }
```

**Recomendação**: Manter `minimum: "12"` até confirmar que nenhum jogador/GM usa v12. O dnd5e pode se dar ao luxo de exigir v13+ porque tem milhões de usuários que atualizam. Um sistema menor deve ser mais conservador.

---

## 6. Checklist de Teste em v14

Após as mudanças da Fase A:

- [ ] Sistema carrega sem erros no console
- [ ] Ficha de personagem abre e renderiza corretamente
- [ ] Ficha de NPC abre
- [ ] Ficha de item (cada tipo) abre
- [ ] Drag & drop de item funciona
- [ ] Compêndios carregam (efeitos, skills, raças, equipamentos)
- [ ] Status effects aparecem no token HUD
- [ ] Combate funciona (ataque, dano, evasão)
- [ ] Trade entre jogadores funciona
- [ ] Macro de hotbar funciona
- [ ] Chat messages renderizam corretamente
- [ ] Tooltip manager funciona
- [ ] Character creation wizard funciona
- [ ] Level-up wizard funciona
