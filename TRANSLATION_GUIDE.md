# 🌍 Guia de Tradução - Cardigan System

Este guia explica como funciona o sistema de tradução do Cardigan e as melhores práticas para adicionar novas traduções.

## 📋 Estrutura de Tradução

### Hierarquia do arquivo `lang/en.json`:

```
CARDIGAN
├── Common (traduções reutilizáveis)
├── Compendium (nomes de compêndios)
├── Ability (atributos do personagem)
├── Item
│   ├── base (propriedades comuns de itens)
│   ├── Skill (skills/habilidades)
│   ├── Arma (armas)
│   ├── Armadura (armaduras)
│   └── ... (outros tipos de itens)
├── Actor (propriedades de personagens)
└── Dialog (diálogos e janelas)
```

## ✅ Traduções Comuns (CARDIGAN.Common)

Use estas traduções sempre que possível para evitar duplicação:

### Ações Gerais:
- `CARDIGAN.Common.Save` - "Salvar"
- `CARDIGAN.Common.Cancel` - "Cancelar"
- `CARDIGAN.Common.Delete` - "Deletar"
- `CARDIGAN.Common.Edit` - "Editar"
- `CARDIGAN.Common.Configure` - "Configurar"
- `CARDIGAN.Common.Apply` - "Aplicar"
- `CARDIGAN.Common.Create` - "Criar"
- `CARDIGAN.Common.Add` - "Adicionar"
- `CARDIGAN.Common.Remove` - "Remover"
- `CARDIGAN.Common.Close` - "Fechar"
- `CARDIGAN.Common.Confirm` - "Confirmar"

### Confirmações:
- `CARDIGAN.Common.Yes` - "Sim"
- `CARDIGAN.Common.No` - "Não"

### Propriedades:
- `CARDIGAN.Common.Description` - "Descrição"
- `CARDIGAN.Common.Name` - "Nome"
- `CARDIGAN.Common.Cost` - "Custo"
- `CARDIGAN.Common.Type` - "Tipo"
- `CARDIGAN.Common.Level` - "Nível"
- `CARDIGAN.Common.Value` - "Valor"
- `CARDIGAN.Common.Quantity` - "Quantidade"
- `CARDIGAN.Common.Weight` - "Peso"
- `CARDIGAN.Common.Price` - "Preço"
- `CARDIGAN.Common.Details` - "Detalhes"
- `CARDIGAN.Common.Effects` - "Efeitos"
- `CARDIGAN.Common.Properties` - "Propriedades"
- `CARDIGAN.Common.Requirements` - "Requisitos"
- `CARDIGAN.Common.Actions` - "Ações"

### Estados:
- `CARDIGAN.Common.None` - "Nenhum"
- `CARDIGAN.Common.Unknown` - "Desconhecido"
- `CARDIGAN.Common.Active` - "Ativo"
- `CARDIGAN.Common.Inactive` - "Inativo"
- `CARDIGAN.Common.Enabled` - "Habilitado"
- `CARDIGAN.Common.Disabled` - "Desabilitado"
- `CARDIGAN.Common.Equipped` - "Equipado"
- `CARDIGAN.Common.Unequipped` - "Desequipado"

### Ferramentas:
- `CARDIGAN.Common.Search` - "Buscar"
- `CARDIGAN.Common.Filter` - "Filtrar"
- `CARDIGAN.Common.Sort` - "Ordenar"
- `CARDIGAN.Common.Select` - "Selecionar"
- `CARDIGAN.Common.Selected` - "Selecionado"
- `CARDIGAN.Common.Available` - "Disponível"

## 🎯 Quando Usar Traduções Comuns vs Específicas

### ✅ Use Traduções Comuns quando:
- O texto é genérico (ex: "Salvar", "Cancelar")
- Múltiplas partes do sistema usam o mesmo texto
- É uma ação padrão de interface

**Exemplo:**
```handlebars
<!-- ✅ BOM -->
<button>{{localize "CARDIGAN.Common.Save"}}</button>
<button>{{localize "CARDIGAN.Common.Cancel"}}</button>
```

### ✅ Use Traduções Específicas quando:
- O texto é único para aquele contexto
- Há necessidade de customização futura
- O significado muda dependendo do contexto

**Exemplo:**
```handlebars
<!-- ✅ BOM -->
<button>{{localize "CARDIGAN.Item.Skill.ConfigureEffects"}}</button>
<!-- "Configurar Efeitos" é específico de skills -->
```

## 📝 Como Adicionar Novas Traduções

### 1. Verifique se já existe uma tradução comum:
```javascript
// ❌ EVITE duplicar
"CARDIGAN.Item.Skill.Save": "Salvar"  // Já existe em Common!

// ✅ USE a tradução comum
{{localize "CARDIGAN.Common.Save"}}
```

### 2. Adicione traduções específicas apenas quando necessário:
```json
{
  "CARDIGAN": {
    "Item": {
      "Skill": {
        "ConfigureEffects": "Configurar Efeitos",  // ✅ Específico
        "EnhancementConfig": {
          "ModifyEnergyCost": "Modificar Custo de Energia",  // ✅ Específico
          "ApplyEffects": "Aplicar Efeitos"  // ✅ Específico
        }
      }
    }
  }
}
```

### 3. Use nomes semânticos:
```json
// ✅ BOM - nome descreve o que é
"HasEnergyCost": "Gasta Energia?"
"EnergyCost": "Custo de Energia"
"CustomEffects": "Efeitos Customizados"

// ❌ EVITE - nome muito genérico
"Label1": "Gasta Energia?"
"Text2": "Custo de Energia"
```

## 🔄 Refatoração de Traduções Existentes

Se você encontrar duplicatas no código:

### Antes:
```json
{
  "CARDIGAN.Item.Skill.Save": "Salvar",
  "CARDIGAN.Item.Arma.Save": "Salvar",
  "CARDIGAN.Dialog.Recipe.Save": "Salvar"
}
```

### Depois:
```json
{
  "CARDIGAN.Common.Save": "Salvar"
}
```

E atualizar os templates:
```handlebars
<!-- Antes -->
{{localize "CARDIGAN.Item.Skill.Save"}}
{{localize "CARDIGAN.Item.Arma.Save"}}
{{localize "CARDIGAN.Dialog.Recipe.Save"}}

<!-- Depois -->
{{localize "CARDIGAN.Common.Save"}}
{{localize "CARDIGAN.Common.Save"}}
{{localize "CARDIGAN.Common.Save"}}
```

## 🌐 Adicionando Novos Idiomas

Para adicionar um novo idioma (ex: inglês):

1. Crie `lang/en-US.json`
2. Copie a estrutura de `lang/en.json`
3. Traduza os valores (mantenha as chaves iguais!)
4. Registre em `system.json`:

```json
{
  "languages": [
    {
      "lang": "en",
      "name": "Português (Brasil)",
      "path": "lang/en.json"
    },
    {
      "lang": "en-US",
      "name": "English (US)",
      "path": "lang/en-US.json"
    }
  ]
}
```

## 📊 Convenções de Nomenclatura

### Padrão de Chaves:
```
CARDIGAN.[Categoria].[Subcategoria].[Propriedade]
```

**Exemplos:**
```
CARDIGAN.Common.Save
CARDIGAN.Item.Skill.EnergyCost
CARDIGAN.Dialog.Enhancement.ApplyEffects
CARDIGAN.Ability.Strength.long
```

### Sufixos Comuns:
- `.Label` - Rótulo de campo
- `.Hint` - Texto de ajuda
- `.Placeholder` - Texto de exemplo em inputs
- `.long` - Versão longa
- `.abbr` - Abreviação

## 🎓 Dicas e Boas Práticas

1. **Sempre use `localize`** nos templates em vez de texto hardcoded
2. **Prefira traduções comuns** quando possível
3. **Use nomes descritivos** para as chaves
4. **Mantenha hierarquia** consistente
5. **Documente traduções complexas** com comentários no código
6. **Teste em múltiplos idiomas** se aplicável

## 🔍 Ferramentas Úteis

### Buscar traduções no código:
```bash
# Buscar uso de uma chave específica
grep -r "CARDIGAN.Common.Save" templates/

# Listar todas as chaves usadas
grep -roh "CARDIGAN\.[^\"']*" templates/ | sort | uniq
```

### Validar JSON:
```bash
# Verificar se o JSON está válido
cat lang/en.json | jq . > /dev/null && echo "✅ JSON válido"
```

---

**Última atualização:** 14 de novembro de 2025  
**Versão do sistema:** 3.0.7
