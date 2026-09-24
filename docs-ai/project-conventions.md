# Regras e Convenções do Projeto Cardigan

## Compêndios

- **Sempre edite os fontes JSON em `src/packs/`, nunca os arquivos LevelDB compilados em `packs/` diretamente.** Os arquivos `CURRENT`/`LOG`/`MANIFEST-*` de cada pack são artefatos de build.
- Após editar `src/packs/`, rode `npm run build:packs`.

## Padrão "Manager" (effects, skills, races, weapon-properties)

Ao adicionar um novo efeito, skill, raça ou propriedade de arma:
1. Crie a classe na pasta correspondente (`module/effects/effects/`, `module/skills/`, `module/races/`, `module/weapon-properties/properties/`).
2. Exporte a classe no `index.mjs` do subsistema.
3. Registre a classe na função `initializeX()` correspondente, chamada no hook `init` de `cardigan.mjs`.
4. Siga o padrão registry/factory já existente: `Manager` estático com `Map`, `register(name, Class)`, e método `get*`/`apply*`.
5. Se o efeito precisar reagir a eventos do Foundry, registre os hooks via `registerHooks()` (padrão usado por vários efeitos existentes).

## Localização (i18n)

- Toda string voltada ao usuário deve estar em `lang/pt-BR.json` sob o namespace `CARDIGAN.*`.
- `CONFIG.CARDIGAN` (em `module/helpers/config.mjs`) e as DataModels referenciam essas chaves via `LOCALIZATION_PREFIXES`/strings de chave — não usar texto hardcoded em PT ou EN no código.

## Idioma do código e dos schemas

A migração PT→EN foi feita em 04/07/2026 (commits `refact(schema): ... (C1–C11)`), com migração automática de mundos em `module/migration/migrate-world.mjs`. Estado atual:

| O quê | Idioma | Exemplo |
|-------|--------|---------|
| Campos de schema das DataModels | **Inglês** | `protection`, `lifeBonus`, `energyBonus`, `movementBonus`, `backpackBonus`, `effectType`, `rounds` |
| Valores de choices | **Inglês** | `armorType: "head"`, `weight: "very-heavy"`, `skillClass: "warrior"`, `properties: ["wound"]` |
| Nomes de arquivos (`module/`, `templates/`, `src/scss/`, `scripts/`, `docs-ai/`) | **Inglês** | `item-armor.mjs`, `bleeding.mjs`, `wound.mjs` |
| **Ids de tipo** de Actor/Item | Português (mantido) | `arma`, `armadura`, `efeito`, `item-comum`, `item-consumivel`, `item-municao` |
| Nomes de classes de efeitos/propriedades/raças | Português (mantido) | `SangramentoEffect`, `Ferir`, `NorscaRace` |
| Chaves de registro do `EffectManager` | Português (= nome do item no compêndio) | `'Sangramento'`, `'Amaldiçoado'` |
| Chaves i18n | Majoritariamente inglês; algumas ainda em PT | `CARDIGAN.ArmorType.Cabeca` (valor salvo `"head"` → chave PT) |
| Texto para o usuário | Português (em `lang/pt-BR.json`) | — |

Regras:
- **Campos e valores novos: sempre em inglês.**
- Renomear um campo ou valor já persistido exige um novo lote de migração em `migrate-world.mjs` (incrementar `SCHEMA_VERSION`) **e** atualizar os fontes em `src/packs/`.
- Renomear **ids de tipo** ou **chaves do `EffectManager`** não é trivial (afeta `system.json`, todos os documentos salvos e o compêndio de efeitos) — não fazer sem alinhamento explícito.
- Comentários novos preferencialmente em inglês (JSDoc); o código existente ainda mistura PT/EN.

## Sheets (ApplicationV2)

- `actor-sheet.mjs` e `item-sheet.mjs` usam `static PARTS` + `static DEFAULT_OPTIONS.actions`.
- Lógica nova de ação/comportamento de sheet deve, sempre que possível, ir para `sheets/actions/`, `sheets/listeners/` ou `sheets/parts/` em vez de crescer `actor-sheet.mjs` ou `item-sheet.mjs` (hoje o maior arquivo do sistema — ver [pending-tasks.md](pending-tasks.md)).
- Ao extrair lógica do `actor-sheet.mjs`, manter wrappers no próprio `actor-sheet` para preservar compatibilidade com `DEFAULT_OPTIONS.actions` e integrações externas, extrair por blocos coesos, e evitar mudar comportamento no mesmo commit da extração.

## Sockets / combate

- Combate é orientado por sockets no canal `system.cardigan`. Novas ações de socket devem seguir o padrão de despacho existente em `module/socket.mjs` (`data.action`/`data.type`), com handlers passados via objeto para `registerInitSocketListeners`/`registerReadySocketListeners`.
- Atualizações de dano/HP devem ser aplicadas pelo cliente dono do actor (ou GM), nunca diretamente por outro cliente.

## Compatibilidade v12–v14

- Para roll mode, use os helpers de `module/helpers/roll-mode.mjs` em vez de `core.rollMode` / `ChatMessage.applyRollMode` diretamente (renomeados no v14).
- Prefira `render({ force: true })` a `render(true)` e `foundry.utils.deepClone()` a `duplicate()` em código novo. Ver [v14-compatibility.md](v14-compatibility.md).

## Build / artefatos

- Não há linter nem suite de testes configurados — não inventar comandos de `lint`/`test`.
- `css/cardigan.css` é gerado a partir de `src/scss/cardigan.scss` via `npm run build`/`npm run watch`. Não editar `css/cardigan.css` diretamente.
