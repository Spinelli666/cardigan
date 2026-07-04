# Fluxo de Desenvolvimento

## Comandos

```bash
npm install              # instala sass e @foundryvtt/foundryvtt-cli
npm run build             # compila src/scss/cardigan.scss -> css/cardigan.css (expanded, sem source map)
npm run watch             # mesmo build, mas em modo watch e com source maps
npm run build:packs       # compila os fontes JSON de src/packs/* nos compêndios LevelDB em packs/
npm run build:all          # build de CSS + packs
```

Não há suite de testes nem linter configurado neste projeto.

## SCSS

Após alterar SCSS, rode `npm run build` (ou `npm run watch` durante iteração) — `css/cardigan.css` é o arquivo que o Foundry de fato carrega.

## Compêndios (`src/packs/`)

Após editar o JSON-fonte de um compêndio em `src/packs/`, rode `npm run build:packs` para regenerar os compêndios LevelDB em `packs/`. Os arquivos `CURRENT`/`LOG`/`MANIFEST-*` de cada pack são artefatos de build — é normal aparecerem como alterados/adicionados após cada build.

**Nunca edite os arquivos LevelDB compilados em `packs/` diretamente.** Edite sempre o JSON-fonte em `src/packs/`.

## Scripts de manutenção (`scripts/`)

Scripts pontuais de migração/manutenção de dados ficam em `scripts/` (ex.: `rebuild-effects-compendium.sh`, `update-skills-enhancements.mjs`, `migrate-spell-categories.mjs`). São executados manualmente com `node scripts/<nome>.mjs` contra os dados-fonte em `src/packs/`, seguidos de `npm run build:packs`.
