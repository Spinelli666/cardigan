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

## Estabilidade de renderização (microdeslocamentos / sub-pixel)

Há relatos de texto e ícones da ficha "tremendo" cerca de 1px ao rolar ou mudar o zoom, só em algumas telas: DPR fracionário, como escala do Windows em 125%/150%, ou zoom do navegador ≠ 100%. A causa não é usar `px`, e sim coordenadas fracionárias somadas a camadas de composição da GPU. Diagnóstico completo e plano de correção em [pending-tasks.md](pending-tasks.md#-em-andamento--microdeslocamentos-sub-pixel-na-ficha). **Todo SCSS novo ou alterado deve seguir estas regras:**

1. **Nada de `will-change` permanente.** Não deixar `will-change: transform/filter` em estado de repouso, principalmente em elementos repetidos, como linhas de mochila e ícones. Cada um vira uma camada de GPU, rasterizada em posição sub-pixel, que "treme" no scroll. A transição de `:hover` funciona sem ele.
2. **Nada de `transform: translateZ(0)` / `translate3d` como "hack de performance"** em containers da ficha.
3. **Centralizar com flex/grid, não com `position: absolute` + `translate(-50%, -50%)`.** O `-50%` de uma caixa com tamanho ímpar resulta em `.5px`. Use `display: flex; align-items: center; justify-content: center;` no pai (ou `display: grid; place-items: center;`).
4. **`transform` só para interação transitória** (`:hover`, `:active`, animações). Nunca para posicionar ou ajustar alinhamento no estado de repouso (ex.: `translateY(-1px)` para "subir um pouco"). Para alinhar, use `margin`, `padding`, `gap` ou o alinhamento do flex.
5. **Medidas de layout em px inteiros.** `width`, `height`, `margin`, `padding`, `top`/`left`, `gap` e `font-size` sem decimais: nada de `155.54px`, `0.5px` ou `8.4px`. Decimais só em `box-shadow`, `text-shadow` e `blur()`.
6. **`line-height` em px inteiros** nos componentes compactos (ex.: `font-size: 12px; line-height: 16px;`), e não multiplicadores que dão fração (`11px × 1.2 = 13.2px`).
7. **Evitar `filter`/`backdrop-filter`/`drop-shadow` permanentes em texto** e em áreas que rolam. Eles também criam camada de composição. Em `:hover`, tudo bem.
8. **Texto com gradiente (`background-clip: text`)**: usar `wrapWordsInGradientSpans()` (`module/helpers/gradient-text.mjs`) quando o texto pode quebrar linha, e não combinar com `transform`/`filter` no mesmo elemento ou em ancestrais.
8b. **Imagens de fundo em tamanho inteiro:** evitar `background-size: contain`/`cover`/`%` em bitmaps de tamanho fixo. Calcular o tamanho em px inteiros mantendo a proporção, de forma que `center` também resulte em inteiro (ex.: `(132 - 68) / 2 = 32`). `contain` gera largura/posição fracionárias, e bitmaps muito maiores que a exibição (ex.: 1526px mostrado em 68px) "deslizam" quando a janela se move.
9. **Janelas novas** (sheets e applications próprias com `window.positioned`): sobrescrever `_updatePosition` com `snapPositionToDevicePixels(super._updatePosition(position))` (`module/sheets/parts/pixel-snap-position.mjs`), como já fazem `actor-sheet.mjs` e `item-sheet.mjs`.
10. **Correções de bugs visuais: diagnosticar antes de corrigir.** Rodar `$0.getBoundingClientRect()` durante scroll/zoom. Se as coordenadas mudam, é layout (CSS/JS). Se ficam fixas e o texto ainda treme, é composição (camadas/transform/filter). Corrigir um componente por vez, nunca com substituição global.

## Build / artefatos

- Não há linter nem suite de testes configurados — não inventar comandos de `lint`/`test`.
- `css/cardigan.css` é gerado a partir de `src/scss/cardigan.scss` via `npm run build`/`npm run watch`. Não editar `css/cardigan.css` diretamente.
