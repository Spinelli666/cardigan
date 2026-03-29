# 🔬 Investigações Futuras - Sistema Cardigan

Este arquivo documenta questões técnicas e melhorias arquiteturais identificadas através de análise profunda do sistema e comparação com sistemas de referência (dnd5e, pf2e, daggerheart, olddragon2e).

---

## 🧩 Backlog de Extrações Cirúrgicas (`actor-sheet.mjs`) — 28/03/2026

### ✅ Já extraído
- `module/sheets/actions/ammunition-actions.mjs`
  - Gestão de munição, diálogo reativo e listeners de atualização.
- `module/sheets/actions/weapon-actions.mjs`
  - Fluxo de ataque com arma e detecção de críticos.
- `module/sheets/actions/equipment-actions.mjs`
  - Equipar/desequipar arma+armadura (ações da tabela e fluxo de contexto).
- `module/sheets/actions/consumable-actions.mjs`
  - Consumo de itens, skill-check/crit, tracking effect e processadores de modificadores.

### 🎯 Próximas extrações recomendadas (ordem sugerida)
1. **Modal de abilities + derived stats**
  - ciclo de abertura/fechamento do modal e sincronização de campos.
2. **Context menu completo**
  - `_getContextOptions`, `_onAction`, exibição em chat e handlers correlatos.
3. **Drag & drop completo**
  - handlers de drag/drop, sort e criação por drop.
4. **Listeners de campos dinâmicos**
  - blocos `#add*Listeners` e `#handle*`.

### 📌 Observações de segurança para continuidade
- Manter abordagem de **wrappers no `actor-sheet`** para preservar compatibilidade com `DEFAULT_OPTIONS.actions` e integrações externas.
- Extrair por blocos coesos e validar erros após cada etapa.
- Evitar mudança de comportamento no mesmo commit da extração.

---

## ✅ ETAPA 6: Refatoração Toxicity Effects - **CONCLUÍDA**

### 🎉 Solução Implementada
Criado `ToxicidadeEffect` seguindo o padrão estabelecido por `ExaustaoEffect` e `FraturaEffect`.

**Arquitetura escolhida:** Opção B (Override _onUpdate) com adaptações

**Implementação:**
- ✅ Criado `module/effects/effects/toxicidade.mjs`
- ✅ Exportado em `module/effects/index.mjs`
- ✅ Registrado no `EffectManager`
- ✅ Integrado em `actor._onUpdate` hook
- ✅ Removido setTimeout do `prepareDerivedData()`
- ✅ Removidos ~172 linhas de métodos deprecated

**Benefícios alcançados:**
- ✅ Separação de responsabilidades (prepareDerivedData = cálculo, _onUpdate = side effects)
- ✅ Execução garantida após update completo do ator
- ✅ Sem setTimeout, sem race conditions
- ✅ Pattern consistente com outros efeitos do sistema
- ✅ Código testável e manutenível
- ✅ Previne operações concorrentes com Set de sync

---

## 🎯 REFATORAÇÃO PRINCIPAL: Actor Sheet Modularização

### 📊 Análise de Impacto

**Problema Crítico Identificado:**
- `actor-sheet.mjs`: **9.631 linhas** (MONOLÍTICO)
- `skill-manager.mjs`: **2.029 linhas** (GRANDE)
- `cardigan.mjs`: **3.822 linhas** (ACEITÁVEL, mas pode melhorar)

**Comparação com Sistemas de Referência:**
```
Sistema         | CharacterSheet | NPCSheet | BaseSheet
----------------|----------------|----------|----------
dnd5e           | ~1.350 linhas  | ~800     | ~2.100
pf2e            | ~940 linhas    | ~600     | ~1.800
daggerheart     | ~1.014 linhas  | ~450     | ~500
CARDIGAN ATUAL  | 9.631 linhas   | N/A      | N/A      ❌
```

### 📋 Plano de Refatoração em Fases

#### **FASE 1: Separar Actor Sheet (PRIORIDADE MÁXIMA)** 🔴

**Objetivo:** Reduzir `actor-sheet.mjs` de 9.631 → ~2.000 linhas (77% redução)

**Estrutura Proposta:**
```
module/sheets/
  actor/
    api/
      base-actor-sheet.mjs        (~500 linhas)
        • Drag/Drop handlers
        • Context menu base
        • Item management comum
        • Event delegation patterns
    
    character-sheet.mjs            (~600 linhas)
      • Herda de base-actor-sheet
      • Lógica específica de personagem
      • _preparePartContext por aba
    
    npc-sheet.mjs                  (~300 linhas)
      • Herda de base-actor-sheet
      • Lógica simplificada de NPC
    
    helpers/
      combat-helpers.mjs           (~400 linhas)
        • _onAttackWithWeapon
        • _onManageAmmunition
        • Weapon equip/unequip logic
        • Damage calculations
      
      equipment-helpers.mjs        (~400 linhas)
        • _prepareEquipmentContext
        • _prepareArmorSystem
        • Inventory management
        • Trade/merchant logic
      
      profession-helpers.mjs       (~300 linhas)
        • _prepareProfessionsContext
        • Recipe crafting
        • Profession filtering
        • Skill crafting bonuses
      
      ability-helpers.mjs          (~400 lineas)
        • _prepareAbilities
        • _calculateWeaponSkillBonuses
        • _updateAbilityTotals
        • Race bonus calculations
```

**Padrões a Adotar (do dnd5e):**

```javascript
// ❌ PADRÃO ATUAL (tudo em um arquivo)
export class CardiganSystemActorSheet extends ActorSheetV2 {
  async _prepareContext(options) {
    // 500+ linhas de preparação
    // Proficiencies, items, effects, todos juntos
  }
  
  async _onAttackWithWeapon(event, target) {
    // 200+ linhas de lógica de ataque
  }
  
  async _onCookRecipe(event, target) {
    // 150+ linhas de lógica de culinária
  }
  // ... mais 50+ métodos
}

// ✅ PADRÃO PROPOSTO (inspirado em dnd5e)
// base-actor-sheet.mjs
export class BaseActorSheet extends ActorSheetV2 {
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.config = CONFIG.CARDIGAN;
    context.editable = this.isEditable;
    return context;
  }
  
  async _preparePartContext(partId, context, options) {
    // Delega para métodos específicos
    switch (partId) {
      case "equipment": return this._prepareEquipmentContext(context);
      case "skills": return this._prepareSkillsContext(context);
      case "professions": return this._prepareProfessionsContext(context);
      default: return context;
    }
  }
}

// character-sheet.mjs
export class CharacterSheet extends BaseActorSheet {
  async _prepareEquipmentContext(context) {
    // Usa helper
    return EquipmentHelpers.prepareInventory(this.actor, context);
  }
  
  async _prepareSkillsContext(context) {
    // Lógica específica de character skills
    return context;
  }
}

// helpers/combat-helpers.mjs
export class CombatHelpers {
  static async handleWeaponAttack(actor, weapon, target) {
    // Lógica isolada e testável
  }
  
  static calculateDamage(weapon, bonuses) {
    // Cálculo puro, sem side effects
  }
}
```

**Benefícios Esperados:**
- ✅ **Manutenibilidade:** Cada arquivo com responsabilidade única
- ✅ **Testabilidade:** Helpers podem ser testados isoladamente
- ✅ **Reusabilidade:** Base sheet usado por character e NPC
- ✅ **Legibilidade:** 500 linhas por arquivo vs 9.631
- ✅ **Colaboração:** Múltiplos devs podem trabalhar em paralelo

---

#### **FASE 2: Refatorar Template Organization** 🟡

**Problema:** Templates grandes sem partials reutilizáveis

**Estrutura Proposta:**
```
templates/actor/
  tabs/
    character-equipment.hbs
    character-skills.hbs
    character-professions.hbs
    character-biography.hbs
  
  partials/
    item-row.hbs                 # Linha de item genérica
    proficiency-row.hbs          # Linha de proficiência
    skill-card.hbs               # Card de skill
    effect-badge.hbs             # Badge de efeito (inspirado em pf2e)
    ability-score.hbs            # Exibição de atributo
    resource-bar.hbs             # Barra de recurso (vida, energia)
    armor-slot.hbs               # Slot de armadura
    weapon-slot.hbs              # Slot de arma
```

**Pattern do dnd5e:**
```handlebars
{{!-- ❌ ATUAL: Tudo inline --}}
<div class="item">
  <img src="{{item.img}}" />
  <div class="name">{{item.name}}</div>
  <!-- 50+ linhas de HTML repetido -->
</div>

{{!-- ✅ PROPOSTO: Usar partials --}}
{{> "cardigan.item-row" item=weapon type="weapon"}}
{{> "cardigan.item-row" item=armor type="armor"}}
{{> "cardigan.resource-bar" resource=health icon="heart"}}
```

---

#### **FASE 3: Skill Manager Refactor** 🟡

**Objetivo:** Reduzir `skill-manager.mjs` de 2.029 → ~1.200 linhas (40% redução)

**Estrutura Proposta:**
```
module/skills/
  api/
    base-profession.mjs          (~150 linhas)
      • Interface comum para profissões
      • Métodos de crafting base
    
    base-racial-skill.mjs        (~150 linhas)
      • Interface para skills raciais
      • Aplicação de bônus base
  
  skill-registry.mjs             (~300 linhas)
    • Registro centralizado de skills
    • Lazy loading de profissões
    • Cache de skills carregadas
  
  skill-manager.mjs              (~500 linhas)
    • Coordenação de alto nível
    • Delegates para registry/professions
  
  professions/
    culinary.mjs
    tailoring.mjs
    tecnomagic.mjs
    # ... cada com ~100-150 linhas
  
  racial-skills/
    norsca.mjs
    # ... cada com ~50-100 linhas
```

**Pattern do pf2e (sistema modular):**
```javascript
// ❌ ATUAL: Tudo em skill-manager
export class SkillManager {
  async initializeCulinarySkills() { /* 200 linhas */ }
  async initializeTailoringSkills() { /* 200 linhas */ }
  // ... 10+ métodos similares
}

// ✅ PROPOSTO: Base classes
// api/base-profession.mjs
export class BaseProfession {
  constructor(id, config) {
    this.id = id;
    this.config = config;
  }
  
  async initialize() {
    // Template method
  }
  
  async craft(actor, recipe) {
    // Lógica comum de crafting
  }
}

// professions/culinary.mjs
export class CulinaryProfession extends BaseProfession {
  constructor() {
    super('culinary', {
      compendium: 'cardigan.skills-cardigan',
      category: 'culinary',
      icon: 'fa-utensils'
    });
  }
  
  async craft(actor, recipe) {
    // Lógica específica de culinária
    return super.craft(actor, recipe);
  }
}
```

---

#### **FASE 4: Weapon Properties Base Class** 🟢

**Problema:** 20+ arquivos com lógica duplicada de aplicação de efeitos

**Solução:**
```javascript
// weapon-properties/base-weapon-property.mjs
export class BaseWeaponProperty {
  static id = "";
  static name = "";
  static description = "";
  static effectType = ""; // "bleeding", "burning", etc.
  
  /**
   * Apply property effect to target
   * @param {Actor} target - Target actor
   * @param {Item} weapon - Weapon item
   * @param {Object} options - Additional options
   */
  async applyEffect(target, weapon, options = {}) {
    // Template method pattern
    if (!this.canApply(target, weapon, options)) return;
    
    await this._createEffect(target, weapon);
    await this._notifyPlayers(target, weapon);
  }
  
  canApply(target, weapon, options) {
    // Override in subclasses
    return true;
  }
  
  async _createEffect(target, weapon) {
    // Padrão comum de criação de efeito
  }
  
  async _notifyPlayers(target, weapon) {
    // Padrão comum de notificação via socket
  }
}

// properties/ferir.mjs
export class Ferir extends BaseWeaponProperty {
  static id = "ferir";
  static name = "Ferir";
  static effectType = "bleeding";
  
  canApply(target, weapon, options) {
    // Lógica específica: só aplica em acerto crítico
    return options.criticalHit === true;
  }
  
  async _createEffect(target, weapon) {
    // Usa EffectManager.applyEffect com tipo "bleeding"
    await game.cardigan.effectManager.applyEffect(target, this.effectType, {
      source: weapon.name
    });
  }
}
```

**Redução estimada:** ~20% de código em weapon properties

---

#### **FASE 5: Documentation & JSDoc** 🟢

**Pattern do pf2e (TypeScript JSDoc):**
```javascript
/**
 * Calculate armor totals including protection, durability and bonuses
 * @param {ActorCharacter} actor - The character actor
 * @returns {ArmorSystemData} Calculated armor data
 * @typedef {Object} ArmorSystemData
 * @property {number} protection - Total protection value
 * @property {number} durability - Current armor durability
 * @property {Object} bonuses - Health, energy, movement bonuses
 */
function _calculateArmorTotals(actor) {
  // ...
}
```

**Adicionar em:**
- Todos os data models
- Helpers principais
- Weapon properties
- Effect classes

---

## 🌍 FUTURA INVESTIGAÇÃO: Padronização Completa de Idioma (Inglês)

### 📊 Situação Atual (Análise de 14/01/2026)

**Padrão inconsistente detectado:**
- ✅ **Classes/Métodos**: Inglês (`ArmorData`, `prepareDerivedData`, `_calculateTypeOrder`)
- ❌ **Campos do Schema**: **Português** (`protecao`, `bonusVida`, `bonusEnergia`, `armorType`)
- ❌ **Valores de Enum**: **Português** (`"cabeca"`, `"torso"`, `"bracos"`, `"pernas"`, `"pes"`)
- ✅ **i18n Keys**: Inglês (`CARDIGAN.ArmorType.Cabeca`)
- ⚠️ **Comentários**: Misto (alguns em PT, alguns em EN)

**Arquivos afetados (estimativa):**
- `module/data/item-*.mjs` (10+ arquivos)
- `module/data/actor-*.mjs` (3 arquivos)
- `module/sheets/*.mjs` (2 arquivos massivos)
- `templates/**/*.hbs` (50+ templates)
- `src/packs/**/*.json` (centenas de items salvos)

### 🎯 Objetivo da Migração

**Transformar:**
```javascript
// ❌ ATUAL (mistura PT/EN)
class ArmorData extends BaseItemData {
  static schema = {
    armorType: new StringField({
      choices: ["cabeca", "torso", "bracos"] // PT
    }),
    protecao: new NumberField(),      // PT
    bonusVida: new NumberField(),     // PT
    bonusDeslocamento: new SchemaField() // PT
  }
}
```

**Para:**
```javascript
// ✅ FUTURO (100% inglês)
class ArmorData extends BaseItemData {
  static schema = {
    armorType: new StringField({
      choices: ["head", "torso", "arms", "legs", "feet"] // EN
    }),
    protection: new NumberField(),    // EN
    lifeBonus: new NumberField(),     // EN
    movementBonus: new SchemaField()  // EN
  }
}
```

### 📋 Plano de Migração (MULTI-ETAPAS)

#### ETAPA 1: Mapeamento e Análise de Impacto
- [ ] Mapear **todos** os campos em português nos schemas
- [ ] Identificar dependências (templates, macros, módulos externos)
- [ ] Estimar breaking changes (API surface alterada)
- [ ] Verificar se há macros da comunidade usando esses campos
- [ ] Analisar save games existentes (estrutura de dados)

#### ETAPA 2: Criar Sistema de Migração de Dados
- [ ] Implementar `DataMigration` handler no estilo Foundry
- [ ] Criar mapeamento PT→EN para todos os campos:
  ```javascript
  const FIELD_MIGRATION_MAP = {
    'protecao': 'protection',
    'bonusVida': 'lifeBonus',
    'bonusEnergia': 'energyBonus',
    'bonusDeslocamento': 'movementBonus',
    // ... +50 campos
  }
  ```
- [ ] Desenvolver script de migração de compendiums
- [ ] Testar migração em cópia de backup do mundo

#### ETAPA 3: Refatorar Schemas (Data Models)
- [ ] **item-armadura.mjs**: `protecao` → `protection`, `bonusVida` → `lifeBonus`
- [ ] **item-arma.mjs**: campos de armas
- [ ] **item-consumivel.mjs**: campos de consumíveis
- [ ] **item-skill.mjs**: campos de skills
- [ ] **actor-character.mjs**: habilidades, recursos
- [ ] **actor-npc.mjs**: campos de NPCs

#### ETAPA 4: Atualizar Templates Handlebars
- [ ] Buscar/substituir `{{system.protecao}}` → `{{system.protection}}`
- [ ] Atualizar `templates/item/attribute-parts/*.hbs` (10+ arquivos)
- [ ] Revisar `templates/actor/*.hbs` (5 arquivos)
- [ ] Testar renderização de todas as sheets

#### ETAPA 5: Refatorar Sheets (JavaScript)
- [ ] **actor-sheet.mjs** (9,870 linhas): substituir referências PT
- [ ] **item-sheet.mjs**: atualizar event handlers
- [ ] Verificar `_prepareItems()`, `_calculateArmorTotals()`, etc.

#### ETAPA 6: Atualizar Compendiums
- [ ] Executar script de migração em `src/packs/equipamentos-cardigan/*.json`
- [ ] Migrar `src/packs/racas-cardigan/*.json`
- [ ] Migrar `src/packs/skills-cardigan/*.json`
- [ ] Reconstruir `.ldb` files com `rebuild-*.sh` scripts

#### ETAPA 7: Backward Compatibility Layer (CRÍTICO)
- [ ] Implementar **deprecation warnings** para campos antigos:
  ```javascript
  get protecao() {
    foundry.utils.logCompatibilityWarning(
      'protecao is deprecated, use protection instead',
      { since: 'v2.0', until: 'v3.0' }
    );
    return this.protection;
  }
  ```
- [ ] Manter aliases por 2-3 versões (soft migration)
- [ ] Documentar breaking changes no CHANGELOG

#### ETAPA 8: Testing & Validation
- [ ] Validar todos os testes manuais (checklist de QA)
- [ ] Testar importação de characters antigos
- [ ] Verificar módulos compatíveis (se houver)
- [ ] Fazer playtest com mundo de produção (backup!)

### ⚠️ Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Quebra save games existentes** | Alta | Crítico | Sistema de migração automática + backup obrigatório |
| **Macros da comunidade quebram** | Média | Alto | Deprecation warnings + aliases temporários |
| **Módulos externos incompatíveis** | Baixa | Médio | Documentar API changes, versão major bump |
| **Perda de dados em compendiums** | Baixa | Crítico | Testar scripts em cópia, validação pós-migração |
| **Regressões em funcionalidades** | Média | Alto | Checklist de QA extensivo, playtest |

### 📅 Cronograma Sugerido

**Quando executar:**
- ✅ **AGORA**: Documentar problema (este documento)
- ⏳ **Após refatoração completa**: Quando todos os arquivos `module/data/*.mjs` estiverem limpos
- 🎯 **Versão Major (v2.0)**: Breaking change justificado
- 📆 **Estimativa**: 3-4 semanas de trabalho (full-time) ou 2-3 meses (part-time)

**Prioridade:** 🟡 **MÉDIA** (não urgente, mas importante para qualidade de código)

### 🔗 Referências

- [Foundry VTT Data Migration Guide](https://foundryvtt.com/article/migration/)
- [dnd5e System Migration Examples](https://github.com/foundryvtt/dnd5e/blob/master/module/migration.mjs)
- [PF2e System Deprecation Warnings](https://github.com/foundryvtt/pf2e/search?q=logCompatibilityWarning)

### ✅ Decisão Temporária (14/01/2026)

**Para refatorações atuais:**
- ✅ **Manter campos em português** (compatibilidade)
- ✅ **Padronizar comentários em inglês** (JSDoc)
- ✅ **Métodos em inglês** (já é o padrão)
- ✅ **Constantes em SCREAMING_SNAKE_CASE inglês** (já implementado)

**Revisão futura:** Ao completar todas as refatorações do `module/data/`, avaliar se vale o esforço da migração completa.

---

## 💡 Possíveis Soluções (Etapa 6)

### Opção A: Foundry Hook (updateActor)
```javascript
// Em cardigan.mjs ou hook setup
Hooks.on('updateActor', (actor, change, options, userId) => {
  // Apenas para personagens jogáveis
  if (actor.type !== 'character') return;
  
  // Se toxicity mudou para 5 (máximo)
  if (change.system?.status?.toxicity === 5) {
    actor.system._checkAndApplyToxicityEffects(5);
  }
  
  // Se toxicity reduziu de 5, remover efeitos
  if (actor.system.status.toxicity < 5) {
    actor.system._checkAndApplyToxicityEffects(actor.system.status.toxicity);
  }
});
```

**Prós:**
- ✅ Separação de responsabilidades (prepareDerivedData = cálculo, hook = side effects)
- ✅ Execução garantida após update completo
- ✅ Sem setTimeout, sem race conditions

**Contras:**
- ⚠️ Hook global (afeta todos actors)
- ⚠️ Requer lógica de detecção de mudança

### Opção B: Override _preUpdate
```javascript
// Em CardiganSystemCharacter
async _preUpdate(changed, options, user) {
  await super._preUpdate(changed, options, user);
  
  // Se toxicity está mudando
  if (changed.status?.toxicity !== undefined) {
    const newLevel = changed.status.toxicity;
    await this._checkAndApplyToxicityEffects(newLevel);
  }
}
```

**Prós:**
- ✅ Método oficial do Foundry para side effects antes de update
- ✅ Async permitido
- ✅ Acesso direto ao ator

**Contras:**
- ⚠️ _preUpdate pode não existir em todas versões Foundry v12
- ⚠️ Requer validação de compatibilidade

### Opção C: Manter setTimeout (Status Quo)
```javascript
// Manter como está, mas documentar limitações
// NOTA: setTimeout é workaround temporário. Ver INVESTIGACOES_FUTURAS.md
if (toxicityLevel === 5) {
  setTimeout(() => {
    this._checkAndApplyToxicityEffects(toxicityLevel);
  }, 100);
}
```

**Prós:**
- ✅ Funciona atualmente
- ✅ Zero refatoração necessária
- ✅ Sem riscos de quebrar

**Contras:**
- ⚠️ Anti-pattern reconhecido
- ⚠️ Possível race condition
- ⚠️ Dificulta testes unitários

---

## 📅 Cronograma Proposto

| Sprint | Investigação | Esforço | Prioridade |
|--------|-------------|---------|------------|
| **Sprint Atual** | Etapas 0-5 (refatoração segura) | 2-3 horas | 🔴 Alta |
| Sprint +1 | Performance benchmarks (Q2) | 1 hora | 🟡 Média |
| Sprint +2 | Toxicity lifecycle analysis (Q1, Q3) | 2-3 horas | 🟢 Baixa |
| Sprint +3 | i18n planning (Q4) | 1 hora | 🟢 Baixa |
| Sprint +4 | Implementar Etapa 6 (toxicity refactor) | 2 horas | 🟡 Média |

---

## ✅ Critérios de Conclusão (Etapa 6)

Antes de implementar refatoração de toxicity effects:
- [ ] Todas perguntas da seção 1 respondidas
- [ ] Performance atual medida e documentada
- [ ] Solução escolhida (A, B ou C) com justificativa
- [ ] Testes de race condition executados
- [ ] Plano de rollback definido
- [ ] Backward compatibility validada

---

## 📚 Referências

- [Foundry DataModel Docs](https://foundryvtt.com/api/classes/client.DataModel.html)
- [Foundry Hooks Reference](https://foundryvtt.com/api/modules/hookEvents.html)
- [DnD5e System Source](https://github.com/foundryvtt/dnd5e) - Referência de patterns
- [Foundry Best Practices](https://foundryvtt.com/article/system-development/)

---

**Última atualização:** 14 de janeiro de 2026  
**Responsável:** Dash (Spinelli666)  
**Status:** 📝 Documentado, aguardando investigação futura
