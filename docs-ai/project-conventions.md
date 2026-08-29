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

## Idioma dos campos de schema (decisão atual)

- Os **campos de schema das DataModels permanecem em português** (ex.: `protecao`, `bonusVida`, `bonusEnergia`, `armorType` com valores como `"cabeca"`, `"torso"`), por compatibilidade com dados existentes.
- Classes/métodos seguem em inglês (ex.: `ArmorData`, `prepareDerivedData`).
- Comentários devem ser preferencialmente em inglês (JSDoc), embora o código atual ainda tenha mistura de PT/EN.
- Uma migração completa de campos PT→EN é uma **investigação futura, não confirmada** — ver [pending-tasks.md](pending-tasks.md) (seção "Padronização de idioma"). Não iniciar essa migração sem alinhamento explícito, dado o alto risco de quebrar saves existentes e compêndios.

## Sheets (ApplicationV2)

- `actor-sheet.mjs` e `item-sheet.mjs` usam `static PARTS` + `static DEFAULT_OPTIONS.actions`.
- Lógica nova de ação/comportamento de sheet deve, sempre que possível, ir para `sheets/actions/`, `sheets/listeners/` ou `sheets/parts/` em vez de crescer ainda mais o `actor-sheet.mjs` (que já está identificado como monolítico — ver [pending-tasks.md](pending-tasks.md)).
- Ao extrair lógica do `actor-sheet.mjs`, manter wrappers no próprio `actor-sheet` para preservar compatibilidade com `DEFAULT_OPTIONS.actions` e integrações externas, extrair por blocos coesos, e evitar mudar comportamento no mesmo commit da extração.

## Sockets / combate

- Combate é orientado por sockets no canal `system.cardigan`. Novas ações de socket devem seguir o padrão de despacho existente em `module/socket.mjs` (`data.action`/`data.type`), com handlers passados via objeto para `registerInitSocketListeners`/`registerReadySocketListeners`.
- Atualizações de dano/HP devem ser aplicadas pelo cliente dono do actor (ou GM), nunca diretamente por outro cliente.

## Build / artefatos

- Não há linter nem suite de testes configurados — não inventar comandos de `lint`/`test`.
- `css/cardigan.css` é gerado a partir de `src/scss/cardigan.scss` via `npm run build`/`npm run watch`. Não editar `css/cardigan.css` diretamente.
