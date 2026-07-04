# Projeto Cardigan — Resumo

**Cardigan** é um sistema de RPG de mesa para o Foundry VTT (system id `cardigan`, localizado em pt-BR, requer Foundry v12+). É um fork/derivado do boilerplate "CardiganSystem", fortemente customizado com seus próprios actors, items, skills, efeitos, raças e mecânicas de combate. Não há bundler de JS — o sistema roda como módulos ES nativos (`.mjs`) carregados diretamente pelo Foundry.

## Tipos de documentos

`system.json` declara os `documentTypes` modernos (fonte de verdade junto com as DataModel classes em `module/data/`). `template.json` ainda existe com o schema legado, mas não deve ser usado como referência principal de campos.

- **Actor**: `character`, `npc`
- **Item**: `item-comum`, `item-municao`, `item-consumivel`, `item-ingredient`, `item-recipe`, `race`, `efeito`, `arma`, `armadura`, `skill`

## Compêndios (packs)

Quatro packs, agrupados sob a pasta `SRD` em `system.json`:
- `efeitos-cardigan` — efeitos de status
- `skills-cardigan` — skills/perícias
- `racas-cardigan` — raças
- `equipamentos-cardigan` — armas, armaduras, itens, munições, consumíveis, ingredientes, receitas

## Documentação relacionada

- Arquitetura detalhada: [architecture.md](architecture.md)
- Comandos e fluxo de build/dev: [dev-flow.md](dev-flow.md)
- Convenções e regras do projeto: [project-conventions.md](project-conventions.md)
- Referências externas (outros sistemas Foundry): [foundry-references.md](foundry-references.md)
- Tarefas pendentes / refatorações planejadas: [pending-tasks.md](pending-tasks.md)
