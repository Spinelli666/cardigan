# 🔬 Investigações Futuras - Refatoração actor-character.mjs

Este arquivo documenta questões técnicas que **NÃO bloqueiam** a refatoração atual (Etapas 0-5), mas devem ser investigadas em sprints futuros para melhorias adicionais.

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
