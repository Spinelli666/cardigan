# Sistema de Efeitos Customizados do Cardigan

Este sistema permite criar efeitos customizados com lógica programática em vez de usar Active Effects do Foundry.

## Estrutura

```
module/effects/
├── base-effect.mjs           # Classe base para todos os efeitos
├── effect-manager.mjs        # Gerenciador de efeitos customizados
├── index.mjs                 # Ponto de exportação central
└── effects/                  # Implementações customizadas
    ├── imparavel.mjs        # Exemplo: Efeito Imparável
    ├── persistencia.mjs     # Exemplo: Efeito Persistência
    ├── fratura.mjs          # Exemplo: Efeito Fratura
    ├── exaustao.mjs         # Exemplo: Efeito Exaustão
    └── sangramento.mjs      # Exemplo: Efeito Sangramento
```

## Como Criar um Efeito Customizado

### 1. Criar a Classe do Efeito

Crie um novo arquivo em `module/effects/effects/` estendendo `BaseEffect`:

```javascript
import BaseEffect from '../base-effect.mjs';

export default class MeuEfeitoEffect extends BaseEffect {
  /**
   * Aplicar o efeito ao ator
   * @param {Actor} actor - O ator que receberá o efeito
   */
  async apply(actor) {
    console.log(`Aplicando Meu Efeito em ${actor.name}`);
    
    // Implementar a lógica do efeito aqui
    // Exemplo: modificar atributos do ator
    await actor.update({
      'system.algum.atributo': novoValor
    });
    
    // Opcional: notificar o usuário
    ui.notifications.info(`${actor.name} recebeu Meu Efeito!`);
  }

  /**
   * Remover o efeito do ator
   * @param {Actor} actor - O ator do qual o efeito será removido
   */
  async remove(actor) {
    console.log(`Removendo Meu Efeito de ${actor.name}`);
    
    // Reverter as mudanças feitas pelo efeito
    await actor.update({
      'system.algum.atributo': valorOriginal
    });
    
    ui.notifications.info(`${actor.name} perdeu Meu Efeito.`);
  }

  /**
   * Executado no início do turno do ator (opcional)
   * @param {Actor} actor - O ator com este efeito
   */
  async onTurnStart(actor) {
    // Lógica executada a cada turno
    // Exemplo: dano recorrente, recuperação, etc.
  }

  /**
   * Executado quando o efeito expira (opcional)
   * @param {Actor} actor - O ator com este efeito
   */
  async onExpire(actor) {
    // Lógica executada quando o efeito termina
    await this.remove(actor);
  }
}
```

### 2. Registrar o Efeito

Adicione o registro no `effect-manager.mjs`:

```javascript
static async loadEffects() {
  try {
    // ... efeitos existentes ...
    
    const MeuEfeitoEffect = (await import('./effects/meu-efeito.mjs')).default;
    this.register('Meu Efeito', MeuEfeitoEffect);
    
    console.log('Effect Manager initialized with custom effects:', Array.from(this.#registry.keys()));
  } catch (error) {
    console.error('Error loading custom effects:', error);
  }
}
```

### 3. Exportar o Efeito (Opcional)

No `index.mjs`, adicione:

```javascript
export { default as MeuEfeitoEffect } from './effects/meu-efeito.mjs';
```

### 4. Remover Active Effects do JSON

No arquivo JSON do efeito no compêndio (`src/packs/efeitos-cardigan/`), remova o array `effects`:

```json
{
  "_id": "...",
  "name": "Meu Efeito",
  "type": "efeito",
  "system": {
    "description": "<p>Descrição do efeito</p>",
    "efeitoType": "positivo"
  },
  "folder": "..."
}
```

### 5. Recompilar o Compêndio

```bash
rm -rf packs/efeitos-cardigan
npx fvtt package pack efeitos-cardigan --in src/packs/efeitos-cardigan --out packs/efeitos-cardigan
```

## Exemplo Avançado: Efeito Imparável

O efeito Imparável bloqueia e remove efeitos de controle:

```javascript
// module/effects/effects/imparavel.mjs
import BaseEffect from '../base-effect.mjs';

export default class ImparavelEffect extends BaseEffect {
  static BLOCKED_EFFECTS = [
    'Enraizado', 'Atordoado', 'Caído', 
    'Congelado • Petrificado', 'Encantado', 'Inconsciente・Sono'
  ];

  async apply(actor) {
    // Remove efeitos bloqueados que já estejam no ator
    const effectsToRemove = actor.items.filter(item => 
      item.type === 'efeito' && 
      ImparavelEffect.BLOCKED_EFFECTS.includes(item.name)
    );
    
    if (effectsToRemove.length > 0) {
      const idsToDelete = effectsToRemove.map(e => e.id);
      await actor.deleteEmbeddedDocuments('Item', idsToDelete);
      ui.notifications.info(`Imparável removeu efeitos de controle!`);
    }
  }

  // Método estático para bloquear efeitos
  static shouldBlockEffect(actor, effectName) {
    const hasImparavel = actor.items.some(item => 
      item.type === 'efeito' && item.name === 'Imparável'
    );
    
    if (hasImparavel && this.BLOCKED_EFFECTS.includes(effectName)) {
      ui.notifications.warn(`${actor.name} está Imparável!`);
      return true;
    }
    return false;
  }
}
```

**Recursos do Imparável:**
- ✅ Remove automaticamente efeitos bloqueados ao ser aplicado
- ✅ Previne adição de novos efeitos bloqueados
- ✅ Usa método estático para checagem de bloqueio

## API do EffectManager

### `register(name, effectClass)`
Registra um efeito customizado.

```javascript
EffectManager.register('Nome do Efeito', MinhaClasseEffect);
```

### `getEffect(effectItem)`
Obtém uma instância do efeito a partir de um item de efeito.

```javascript
const effect = await EffectManager.getEffect(itemDeEfeito);
```

### `applyEffect(effectItem, actor)`
Aplica um efeito a um ator.

```javascript
await EffectManager.applyEffect(itemDeEfeito, ator);
```

### `removeEffect(effectItem, actor)`
Remove um efeito de um ator.

```javascript
await EffectManager.removeEffect(itemDeEfeito, ator);
```

## Vantagens sobre Active Effects

1. **Controle Total**: Lógica completamente customizável em JavaScript
2. **Debugging Fácil**: Console logs e breakpoints funcionam normalmente
3. **Manutenibilidade**: Código fonte versionado, não dados JSON
4. **Flexibilidade**: Pode executar qualquer lógica, não apenas modificadores simples
5. **Organização**: Um arquivo por efeito, fácil de encontrar e editar

## Próximos Passos

Outros efeitos que podem ser migrados para o sistema customizado:

- **Sangramento**: Dano recorrente a cada turno
- **Envenenado**: Dano + penalidades em testes
- **Incendiado**: Dano de fogo recorrente
- **Inspirado**: Bônus em rolagens
- **Enfraquecido**: Penalidades em atributos
