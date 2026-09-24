# Projeto Cardigan — Resumo

**Cardigan** é um sistema de RPG de mesa para o Foundry VTT (system id `cardigan`, localizado em pt-BR, compatibilidade `minimum: "12"` / `verified: "14"`). É um fork/derivado do boilerplate "CardiganSystem", fortemente customizado com seus próprios actors, items, skills, efeitos, raças e mecânicas de combate. Não há bundler de JS — o sistema roda como módulos ES nativos (`.mjs`) carregados diretamente pelo Foundry.

## Tipos de documentos

`system.json` declara os `documentTypes` modernos; as DataModel classes em `module/data/` são a fonte de verdade dos campos. (`template.json` foi removido.)

- **Actor**: `character`, `npc`
- **Item**: `item-comum`, `item-municao`, `item-consumivel`, `item-ingredient`, `item-recipe`, `race`, `efeito`, `arma`, `armadura`, `skill`

> Os **ids de tipo** acima continuam em português (são persistidos em todos os documentos). Já os **campos de schema, valores de choices e nomes de arquivo** foram migrados para inglês — ver [project-conventions.md](project-conventions.md#idioma-do-código-e-dos-schemas).

## Compêndios (packs)

Quatro packs, agrupados sob a pasta `SRD` em `system.json`:
- `effects-cardigan` — efeitos de status (label "Efeitos")
- `skills-cardigan` — skills/perícias (label "Skills")
- `races-cardigan` — raças (label "Raças")
- `equipment-cardigan` — armas, armaduras, itens, munições, consumíveis, ingredientes, receitas (label "Equipamentos")

## Documentação relacionada

- Arquitetura detalhada: [architecture.md](architecture.md)
- Comandos e fluxo de build/dev: [dev-flow.md](dev-flow.md)
- Convenções e regras do projeto: [project-conventions.md](project-conventions.md)
- Referências externas (outros sistemas Foundry): [foundry-references.md](foundry-references.md)
- Tarefas pendentes / refatorações planejadas: [pending-tasks.md](pending-tasks.md)
- Enrichers de rolagem `@Teste` / `@Pericia`: [text-enrichers.md](text-enrichers.md)
- Compatibilidade com Foundry v14: [v14-compatibility.md](v14-compatibility.md)
