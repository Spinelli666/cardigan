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

## ❓ Questões Respondidas (ETAPA 6)

#### 1. Toxicity Effects Lifecycle
- [ ] **Como Foundry gerencia aplicação de efeitos durante prepareDerivedData?**
  - Documentação: https://foundryvtt.com/api/classes/client.DataModel.html#prepareDerivedData
  - Verificar se prepareDerivedData deve ser **sempre síncrono**
  - Checar outros sistemas oficiais (dnd5e, pf2e) para patterns

- [ ] **Existe risco de race condition ao aplicar efeitos assíncronos?**
  - Testar: Alterar toxicity rapidamente (0→5→0→5)
  - Verificar: Efeitos duplicados no ator
  - Analisar: Timing entre prepareDerivedData e render da sheet

- [ ] **Outros sistemas usam setTimeout ou há pattern melhor?**
  - Investigar: Foundry Hooks (updateActor, preUpdateActor)
  - Analisar: Override de `_preUpdate()` no DataModel
  - Verificar: ActiveEffect application lifecycle

#### 2. Performance Impact
- [ ] **Qual tempo médio de execução de prepareDerivedData atualmente?**
  ```javascript
  // Script de medição (rodar no console)
  const actor = game.actors.getName("Personagem Teste");
  console.time('prepareDerivedData');
  for (let i = 0; i < 100; i++) {
    actor.system.prepareDerivedData();
  }
  console.timeEnd('prepareDerivedData');
  // Tempo esperado: <10ms para 100 iterações
  ```

- [ ] **Há limite de performance aceitável para cálculos derivados?**
  - Foundry best practices: ~5ms por actor
  - Testar com 10 actors simultâneos na cena
  - Medir impacto no render time da sheet

- [ ] **Foundry faz cache ou recalcula a cada render?**
  - Verificar quando prepareDerivedData é chamado:
    - A cada update?
    - A cada render da sheet?
    - Apenas quando dados base mudam?

#### 3. Backward Compatibility
- [ ] **Há módulos/macros que acessam diretamente actor.system.abilities?**
  - Buscar no Discord da comunidade
  - Verificar macros do mundo atual
  - Checar módulos instalados (API Usage Scanner)

- [ ] **Algum código externo depende de ordem de execução específica?**
  - Revisar macros customizados
  - Verificar módulos que extendem CardiganSystemCharacter
  - Testar com módulos comuns (Simple Calendar, etc)

- [ ] **Há saved games/characters de versões antigas para testar?**
  - Criar backup do mundo atual
  - Testar importação de characters antigos
  - Validar migração de dados

#### 4. i18n Future
- [ ] **Mensagens de status devem ser localizadas agora ou depois?**
  - Decisão de produto: Suporte a EN/ES/FR?
  - Quando: Versão 1.1 ou 2.0?
  - Estrutura atual (lookup tables) já prepara para i18n

- [ ] **Há plano de suportar outros idiomas além de PT-BR?**
  - Verificar demanda da comunidade
  - Estimar esforço de tradução
  - Definir estrutura de chaves i18n

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
