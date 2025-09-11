# 🔄 Sistema de Recarga de Munição - Implementação Atualizada

## ✅ Funcionalidades Implementadas

### 🎯 **Botão de Recarga**
- **Localização**: **À ESQUERDA** da coluna de munição na tabela de equipamentos
- **Visibilidade**: Aparece apenas para armas de fogo (`isFirearm: true`) e armas à distância (`ranged: true`)
- **Título da Coluna**: **SEM TÍTULO** - apenas o botão é exibido
- **Condicionais**: Usa helper `hasRangedWeapons` para mostrar/ocultar coluna

### 🎮 **Modal de Recarga**
- **Título**: "Reload Ammunition"
- **Prompt**: "How much ammunition do you want to reload?"
- **Campo**: Input numérico com validação
- **Valores**: Min: 1, Max: munição máxima disponível
- **Botões**: "Reload" (verde) e "Cancel"

### 🔧 **Lógica de Recarga**
```javascript
// Exemplo: munição 0/10, jogador quer recarregar 1
currentAmmo = 0
maxAmmo = 10
reloadAmount = 1

// Resultado após recarga:
newCurrent = 0 + 1 = 1  // Munição atual
newMax = 10 - 1 = 9     // Munição máxima reduzida
// Display: 1/9
```

### 📱 **Layout da Tabela**
```
| Hand | Name    | [🔄] | Ammunition | Durability | Controls |
|------|---------|------|------------|------------|----------|
|  P   | Pistol  |  🔄   |    8/12    |    3/3     |  [Edit]  |
|  S   | Rifle   |  🔄   |    0/30    |    2/3     |  [Edit]  |
| -    | Sword   |      |            |    3/3     |  [Edit]  |
```

- **Coluna Recarga**: Sem título, apenas ícone 🔄
- **Posicionamento**: Antes da coluna "Ammunition"
- **Comportamento**: 
  - ✅ **Armas de fogo**: Mostram botão 🔄
  - ✅ **Armas corpo a corpo**: Células vazias (sem "-")
  - ✅ **Armas à distância não-fogo**: Células vazias (sem "-")
```
| Hand | Name | [🔄] | Ammunition | Durability | Controls |
|------|------|------|------------|------------|----------|
|  P   | AK47 |  🔄   |    5/25    |    3/3     |  [Edit]  |
|  S   | Sword|  -   |     -      |    2/3     |  [Edit]  |
```

- **Coluna Recarga**: Sem título, apenas ícone 🔄
- **Posicionamento**: Antes da coluna "Ammunition"
- **Comportamento**: Botão visível apenas para armas de fogo

### 📱 **UX/UI Features**
- **Auto-focus**: Campo de entrada focado automaticamente
- **Enter**: Confirma recarga com tecla Enter
- **Validação**: Não permite valores inválidos
- **Feedback**: Notificações de sucesso/erro
- **Hover Effects**: Botão com animações CSS

## 📁 **Arquivos Modificados**

### 1. **Templates** 
- `templates/actor/equipamentos.hbs`:
  - Adicionada coluna "Reload" no cabeçalho
  - Adicionado botão de recarga com ícone `fa-sync-alt`
  - Condicionais para armas de fogo

### 2. **Localização**
- `lang/en.json`:
  - `ReloadAmmunition`: "Reload Ammunition"
  - `ReloadPrompt`: "How much ammunition do you want to reload?"
  - `CurrentAmmunition`: "Current Ammunition"
  - `ReloadButton`: "Reload"

### 3. **JavaScript**
- `module/sheets/actor-sheet.mjs`:
  - Nova ação `reloadAmmunition`
  - Método `_onReloadAmmunition` com dialog personalizado
  - Validações e cálculos de munição

### 4. **Estilos CSS**
- `src/scss/components/_equipamentos.scss`:
  - Classe `.item-ammunition` para coluna de munição
  - Classe `.item-reload` para botão de recarga
  - Hover effects e transições

## 🎭 **Comportamento Condicional**

### ✅ **Botão Aparece Quando:**
- Existe pelo menos uma arma à distância na tabela
- A arma é marcada como "ranged" e "isFirearm"
- A ficha está no modo editável

### ❌ **Botão NÃO Aparece Quando:**
- Apenas armas corpo a corpo na tabela
- Arma não é de fogo (isFirearm: false)
- Arma não é à distância (ranged: false)
- Ficha em modo somente leitura

## 🔄 **Sincronização Bidirecionaal**
- Atualiza tanto na tabela quanto no template do item
- Mantém sincronização existente intacta
- Usa sistema de eventos do FoundryVTT

## 🚀 **Próximos Passos para Teste**
1. Abrir ficha de personagem no FoundryVTT
2. Adicionar uma arma à distância
3. Marcar como "Is Firearm"
4. Verificar aparição da coluna "Reload"
5. Testar funcionalidade de recarga com diferentes valores
