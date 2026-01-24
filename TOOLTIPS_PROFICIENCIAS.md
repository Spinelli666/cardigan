# Sistema de Tooltips de Proficiências

## Resumo
Implementação de tooltips interativos para as proficiências do personagem usando o sistema nativo do Foundry VTT v12. Os tooltips mostram informações básicas no hover e informações expandidas ao clicar.

## Comportamento
1. **Hover (passar o mouse)**: Mostra tooltip simples com o nome da proficiência (ex: "PRECISÃO")
2. **Click**: Fixa o tooltip e exibe informações expandidas (título + descrição completa)
3. **Click fora**: Desafixa e fecha o tooltip

## Arquivos Modificados

### 1. Template HTML (`templates/actor/proficiencies.hbs`)

**Estrutura implementada:**
```handlebars
<label 
  class='proficiency-clickable-label' 
  data-tooltip='PRECISÃO'
  data-tooltip-class='cardigan-proficiency-tooltip'
  data-tooltip-direction='DOWN'
  data-tooltip-title='PRECISÃO'
  data-tooltip-description='Usado para ataques físicos e à distância'>
  {{localize "CARDIGAN.Ability.Accuracy.long"}}
</label>
```

**Atributos data utilizados:**
- `data-tooltip`: Texto simples para o hover (tooltip nativo do Foundry)
- `data-tooltip-class`: Classe CSS customizada para estilização
- `data-tooltip-direction`: Direção de exibição do tooltip (DOWN, UP, LEFT, RIGHT)
- `data-tooltip-title`: Título para o tooltip expandido
- `data-tooltip-description`: Descrição completa para o tooltip expandido

**Proficiências implementadas:**
- ✅ PRECISÃO (Accuracy) - com descrição
- ✅ FORÇA (Strength) - com descrição
- ⏳ Demais proficiências (EVA, DES, VIG, FUR, PER, INT, PSI) - estrutura antiga ainda presente

### 2. JavaScript (`module/sheets/actor-sheet.mjs`)

**Método criado: `#addTooltipPinListener()`**

Localização: Linha ~6989

```javascript
#addTooltipPinListener() {
  const labels = this.element.querySelectorAll('.proficiency-clickable-label');
  
  labels.forEach(label => {
    // Click para fixar tooltip expandido
    label.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Pegar o título e descrição do tooltip
      const tooltipTitle = label.dataset.tooltipTitle;
      const tooltipDescription = label.dataset.tooltipDescription;
      
      if (!tooltipTitle || !tooltipDescription) {
        console.warn('[CARDIGAN] No tooltip title or description found for label');
        return;
      }
      
      // Criar elemento DOM para o tooltip expandido
      const contentElement = document.createElement('div');
      contentElement.className = 'proficiency-tooltip-content';
      
      const titleElement = document.createElement('h3');
      titleElement.textContent = tooltipTitle;
      
      const descElement = document.createElement('p');
      descElement.textContent = tooltipDescription;
      
      contentElement.appendChild(titleElement);
      contentElement.appendChild(descElement);
      
      // Se já existe um tooltip locked, fechar todos
      game.tooltip.dismissLockedTooltips();
      
      // Ativar e fixar (lock) o tooltip expandido com elemento DOM
      game.tooltip.activate(label, {
        html: contentElement,  // Usa 'html' ao invés de 'content' (deprecado na v13)
        direction: label.dataset.tooltipDirection || 'DOWN',
        cssClass: label.dataset.tooltipClass || '',
        locked: true
      });
    });
  });
  
  // Adicionar listener global para fechar tooltip ao clicar fora
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.proficiency-clickable-label') && 
        !event.target.closest('#tooltip') &&
        !event.target.closest('.locked-tooltip')) {
      game.tooltip.dismissLockedTooltips();
    }
  });
}
```

**Chamada do método:**
O método `#addTooltipPinListener()` deve ser chamado no `_onRender()` da actor sheet para vincular os eventos.

### 3. Estilos SCSS (`src/scss/components/tooltips/_proficiency-tooltips.scss`)

**Arquivo criado:** `/src/scss/components/tooltips/_proficiency-tooltips.scss`

```scss
// Proficiency Tooltips using Foundry's native tooltip system
#tooltip.cardigan-proficiency-tooltip,
.locked-tooltip.cardigan-proficiency-tooltip {
  // Aparência customizada do Cardigan
  background: linear-gradient(180deg, rgba(71, 155, 181, 0.60) 8.69%, rgba(35, 85, 102, 0.60) 51.12%, rgba(25, 53, 66, 0.60) 86.06%) !important;
  border: 2px solid #b07b36 !important;
  border-radius: 14px !important;
  padding: 12px 16px !important;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6) !important;
  color: #FFB75C !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;

  .proficiency-tooltip-content {
    color: #FFB75C !important;
    font-family: var(--font-primary);
    
    h3 {
      margin: 0 0 8px 0;
      color: #FFB75C !important;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      border-bottom: 1px solid #b07b36;
      padding-bottom: 6px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;
    }

    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.4;
      color: #FFB75C !important;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;
    }
  }
  
  // Garantir que todo texto tenha a cor correta
  * {
    color: #FFB75C !important;
  }
}

// Locked tooltip gets a visual indicator
.locked-tooltip.cardigan-proficiency-tooltip {
  border-color: #d4a244 !important;
  box-shadow: 0 0 20px rgba(212, 162, 68, 0.4), 0 4px 12px rgba(0, 0, 0, 0.6) !important;
}

// Make label cursor pointer to indicate it's clickable
.proficiency-clickable-label {
  cursor: pointer;
  
  &:hover {
    text-shadow: 0 0 8px var(--color-text-light-highlight);
  }
}
```

**Import no arquivo principal:**
Adicionado no `src/scss/cardigan.scss` linha 13:
```scss
@import 'components/tooltips/proficiency-tooltips';
```

## Tecnologia Utilizada

### Sistema Nativo do Foundry VTT
- **`game.tooltip.activate()`**: API nativa para ativar tooltips
- **`game.tooltip.dismissLockedTooltips()`**: Fecha tooltips fixados
- **Parâmetro `locked: true`**: Cria tooltip persistente que não fecha no mouse out
- **Parâmetro `html`**: Aceita elemento DOM (melhor que `content` que está deprecado desde v13)

### Vantagens da Abordagem Nativa
1. ✅ **Posicionamento automático**: Foundry calcula a melhor posição
2. ✅ **Sem problemas de clipping**: Não é cortado pelos limites da ficha
3. ✅ **Responsivo**: Ajusta posição se não couber na tela
4. ✅ **Compatível**: Usa APIs estáveis do Foundry
5. ✅ **Performático**: Não requer cálculos manuais de coordenadas

## Estilização Visual

### Paleta de Cores Cardigan
- **Fundo**: Gradiente azul `linear-gradient(180deg, rgba(71, 155, 181, 0.60) → rgba(25, 53, 66, 0.60))`
- **Borda**: Dourada `#b07b36` (normal) / `#d4a244` (fixado)
- **Texto**: Laranja `#FFB75C`
- **Sombras**: Preta com opacidade para profundidade

### Estados Visuais
- **Normal (hover)**: Borda dourada padrão
- **Locked (clicado)**: Borda dourada mais clara com brilho adicional
- **Label hover**: Efeito de brilho no texto

## Compilação

Após modificar os arquivos SCSS, executar:
```bash
npm run build
```

Isso compila `src/scss/cardigan.scss` → `css/cardigan.css`

## Próximos Passos

### Para aplicar em todas as proficiências:
1. Aplicar a mesma estrutura de `data-tooltip-*` para:
   - EVASÃO (Evasion)
   - DESTREZA (Dexterity)
   - VIGOR (Stamina)
   - FURTIVIDADE (Stealth)
   - PERSUASÃO (Persuasion)
   - INTELIGÊNCIA (Intelligence)
   - PSIONISMO (Psionics)

2. Remover a estrutura antiga de tooltip customizado:
   - Remover `.proficiency-tooltip` divs
   - Remover `.tooltip-preview` e `.tooltip-expanded`
   - Limpar CSS relacionado

### Exemplo de conversão:
**Antes:**
```handlebars
<label>{{localize "CARDIGAN.Ability.Evasion.long"}}</label>
<div class='proficiency-tooltip'>
  <div class='tooltip-preview'><span>EVASÃO</span></div>
  <div class='tooltip-expanded'>...</div>
</div>
```

**Depois:**
```handlebars
<label 
  class='proficiency-clickable-label' 
  data-tooltip='EVASÃO'
  data-tooltip-class='cardigan-proficiency-tooltip'
  data-tooltip-direction='DOWN'
  data-tooltip-title='EVASÃO'
  data-tooltip-description='Usado para esquivar de ataques e reduzir dano'>
  {{localize "CARDIGAN.Ability.Evasion.long"}}
</label>
```

## Notas Técnicas

### Decisões de Design
1. **Elemento DOM vs String HTML**: Usamos `document.createElement()` para evitar problemas de escape de HTML
2. **Event delegation**: Listener global para fechar tooltip ao clicar fora
3. **Prevent default**: `event.preventDefault()` evita comportamentos indesejados
4. **Stop propagation**: `event.stopPropagation()` evita que o click global feche imediatamente

### Compatibilidade
- ✅ Foundry VTT v12+
- ✅ ApplicationV2 architecture
- ⚠️ Parâmetro `html` ao invés de `content` (deprecado na v13, removido na v15)

### Debug
Console logs implementados:
- `[CARDIGAN] Tooltip locked` - Quando tooltip é fixado
- `[CARDIGAN] No tooltip title or description found` - Quando falta data attributes
- `[CARDIGAN] Tooltip pin listener added` - Quando listeners são registrados

---

**Data de Implementação:** 24 de Janeiro de 2026  
**Sistema:** Cardigan v3.0.0  
**Foundry VTT:** v12
