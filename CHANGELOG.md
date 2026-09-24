# CHANGELOG

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

Mudanças acumuladas desde a importação do projeto (jul/2025) com `system.json` em 1.3.7. Defina o número da versão no próximo release.

### Adicionado
- Tooltip de preview, mensagem de chat e caixa expansível na mochila para consumíveis, armaduras, itens comuns, munições e ingredientes.
- Enrichers de rolagem `@Teste[...]` e `@Pericia[...]` em descrições.
- Sistema de migração automática de dados do mundo (`module/migration/`, setting `schemaVersion`).
- Compêndio de equipamentos (`equipment-cardigan`).
- Diálogo "Vida & Energia" para consumíveis.
- Efeitos Imparável, Persistência e Veloz.
- Style Lab (ferramenta de dev temporária, só para o GM).

### Alterado
- **Campos de schema e valores de choices renomeados de PT para EN** (ex.: `protecao` → `protection`, `armorType: "cabeca"` → `"head"`, propriedade `ferir` → `wound`). Mundos existentes são migrados automaticamente quando o GM entra.
- Compêndios renomeados: `effects-cardigan`, `races-cardigan`, `equipment-cardigan`.
- Compatibilidade verificada com Foundry v14: registro de sheets via `DocumentSheetConfig` e camada de compatibilidade para roll mode.
- Grande refatoração interna: `cardigan.mjs`, `actor-sheet.mjs` e `skill-manager.mjs` divididos em módulos, weapon properties com classe base, partials Handlebars.

### Removido
- Item do tipo Spell e Features.
- `template.json`, substituído por `documentTypes` + DataModels.
