# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cardigan** is a tabletop RPG system for Foundry VTT (system id `cardigan`, pt-BR localized, Foundry v12+, verified on v14). It is a fork/derivative of the "CardiganSystem" boilerplate, heavily customized with its own actors, items, skills, effects, races and combat mechanics. There is no JS bundler — the system runs as native ES modules (`.mjs`) loaded directly by Foundry. There is no test suite or linter configured.

## Documentação (docs-ai/)

A documentação detalhada do projeto foi organizada em `docs-ai/` para economizar contexto. Leia o arquivo relevante conforme a tarefa:

- @docs-ai/project-overview.md — visão geral do projeto, tipos de Actor/Item, compêndios.
- @docs-ai/architecture.md — arquitetura completa (entry point, data models, documents, sheets, subsistemas Manager, sockets, applications, helpers, tooltips, compêndios, styling, localização).
- @docs-ai/dev-flow.md — comandos de build/watch/build:packs e fluxo de edição de SCSS/compêndios/scripts.
- @docs-ai/project-conventions.md — convenções e regras do projeto (padrão Manager, idioma do código/schemas, padrão de sheets/sockets, compatibilidade v12–v14).
- docs-ai/text-enrichers.md — enrichers de rolagem `@Teste[...]` / `@Pericia[...]` (sintaxe, arquivos, fluxo de clique). Ler ao mexer em `module/text-enrichers/` ou em descrições que usam esses comandos.
- docs-ai/v14-compatibility.md — análise de compatibilidade com Foundry v14 e status das mudanças. Ler ao lidar com APIs deprecated ou ao subir a versão mínima.
- @docs-ai/foundry-references.md — repositórios externos de referência (foundryvtt, dnd5e, pf2e, daggerheart, olddragon2e, foundryvtt-cli) — apenas para consulta de padrões, nunca copiar código diretamente.
- @docs-ai/pending-tasks.md — **resumo acionável** das refatorações e investigações pendentes.
- @FUTURE_INVESTIGATIONS.md — arquivo **histórico/original** de investigações, hipóteses e anotações detalhadas (na raiz do projeto). Não editar seu conteúdo existente sem necessidade.

## Git

- Branch de trabalho: **`develop`** (a `main` recebe merges via PR). Não commitar direto na `main`.
- Os arquivos LevelDB em `packs/` ficam bloqueados enquanto o Foundry está aberto — trocar de branch ou fazer stash que toque `packs/` falha nesse estado. Feche o Foundry antes.

**Antes de iniciar tarefas complexas** (refatorações de sheets, effects, skills, weapon-properties, ou qualquer mudança estrutural), consulte `docs-ai/pending-tasks.md` e, quando relevante, `FUTURE_INVESTIGATIONS.md` para entender o contexto e decisões já tomadas.
