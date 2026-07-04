# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cardigan** is a tabletop RPG system for Foundry VTT (system id `cardigan`, pt-BR localized, requires Foundry v12+). It is a fork/derivative of the "CardiganSystem" boilerplate, heavily customized with its own actors, items, skills, effects, races and combat mechanics. There is no JS bundler — the system runs as native ES modules (`.mjs`) loaded directly by Foundry. There is no test suite or linter configured.

## Documentação (docs-ai/)

A documentação detalhada do projeto foi organizada em `docs-ai/` para economizar contexto. Leia o arquivo relevante conforme a tarefa:

- @docs-ai/project-overview.md — visão geral do projeto, tipos de Actor/Item, compêndios.
- @docs-ai/architecture.md — arquitetura completa (entry point, data models, documents, sheets, subsistemas Manager, sockets, applications, helpers, tooltips, compêndios, styling, localização).
- @docs-ai/dev-flow.md — comandos de build/watch/build:packs e fluxo de edição de SCSS/compêndios/scripts.
- @docs-ai/project-conventions.md — convenções e regras do projeto (padrão Manager, idioma dos campos de schema, padrão de sheets/sockets).
- @docs-ai/foundry-references.md — repositórios externos de referência (foundryvtt, dnd5e, pf2e, daggerheart, olddragon2e, foundryvtt-cli) — apenas para consulta de padrões, nunca copiar código diretamente.
- @docs-ai/pending-tasks.md — **resumo acionável** das refatorações e investigações pendentes.
- @INVESTIGACOES_FUTURAS.md — arquivo **histórico/original** de investigações, hipóteses e anotações detalhadas (na raiz do projeto). Não editar seu conteúdo existente sem necessidade.

**Antes de iniciar tarefas complexas** (refatorações de sheets, effects, skills, weapon-properties, ou qualquer mudança estrutural), consulte `docs-ai/pending-tasks.md` e, quando relevante, `INVESTIGACOES_FUTURAS.md` para entender o contexto e decisões já tomadas.
