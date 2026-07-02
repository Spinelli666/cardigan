# Diagnóstico Arquitetural — Sistema Cardigan

Data da análise: 2026-06-29
Referências: dnd5e, pf2e, daggerheart, olddragon2e, foundry-cli

---

## 1. Mapa da Arquitetura Atual

```
cardigan/
├── module/                          # 41.097 linhas JS total
│   ├── cardigan.mjs                 # 3.750 linhas — entry point + combate PvP + trade handlers + Handlebars helpers
│   ├── socket.mjs                   # 223 linhas — despacho de sockets (init + ready)
│   ├── data/                        # 3.458 linhas — DataModels (10 item types + 2 actor types)
│   ├── documents/                   # 1.146 linhas — Actor, Item, ChatMessage overrides
│   ├── sheets/
│   │   ├── actor-sheet.mjs          # 5.411 linhas — sheet monolítica do actor
│   │   ├── item-sheet.mjs           # 3.208 linhas — sheet monolítica do item
│   │   ├── actions/                 # 5.829 linhas — 13 arquivos de ações extraídas
│   │   ├── listeners/               # 2.373 linhas — 3 arquivos de listeners
│   │   └── parts/                   #   612 linhas — 7 arquivos de contexto/comportamento
│   ├── applications/                # 7.032 linhas — 20 diálogos independentes
│   ├── effects/                     # 1.954 linhas — EffectManager + 13 efeitos
│   ├── skills/                      # 3.704 linhas — SkillManager + base-skill
│   ├── races/                       #   205 linhas — RaceManager + norsca
│   ├── weapon-properties/           #   862 linhas — WeaponPropertyManager + 8 propriedades
│   ├── tooltips/                    #   478 linhas — tooltip manager
│   ├── helpers/                     #   341 linhas — config + chat-messages + effects
│   └── hooks/                       #   137 linhas — whisper-placeholder
├── templates/                       # ~60 arquivos .hbs
├── src/
│   ├── scss/                        # 21.767 linhas SCSS → 27.072 linhas CSS compilado
│   └── packs/                       # JSON fonte dos compêndios
├── css/cardigan.css                 # compilado (27.072 linhas)
├── lang/pt-BR.json                  # 1.175 linhas
├── scripts/                         # 19 scripts de manutenção
├── assets/                          # imagens do sistema
├── lib/some-lib/                    # placeholder vazio do boilerplate
├── system.json                      # manifest Foundry
├── template.json                    # schema legado (254 linhas)
└── package.json                     # build: sass + foundryvtt-cli
```

### Concentração de código (top 5 arquivos = 48% do JS)
| Arquivo | Linhas | % do total |
|---------|--------|-----------|
| `actor-sheet.mjs` | 5.411 | 13,2% |
| `cardigan.mjs` | 3.750 | 9,1% |
| `item-sheet.mjs` | 3.208 | 7,8% |
| `consumable-actions.mjs` | 2.386 | 5,8% |
| `skill-manager.mjs` | 2.285 | 5,6% |
| **Subtotal** | **17.040** | **41,5%** |

---

## 2. Pontos Positivos (o que já está bom)

1. **Padrão Manager**: O registry/factory pattern de `EffectManager`, `SkillManager`, `RaceManager`, `WeaponPropertyManager` é limpo, extensível e seguido com consistência. É uma decisão de design sólida.

2. **DataModels modernos**: Uso correto de `TypeDataModel` com `defineSchema()` e `documentTypes` em `system.json` — alinhado com Foundry v12 best practices. Boa separação entre actor-character e actor-npc.

3. **Extração parcial de ações**: 13 arquivos em `sheets/actions/` mostram um processo ativo e saudável de modularização. A abordagem de manter wrappers no actor-sheet é correta.

4. **Socket architecture**: A separação `registerInitSocketListeners` / `registerReadySocketListeners` em `socket.mjs` é um padrão sólido. A convenção de `data.action` / `data.type` é clara.

5. **Status effects from compendium**: Carregar `CONFIG.statusEffects` do compêndio é excelente — evita hardcoding e permite edição via compêndio.

6. **SCSS organizado**: Boa estrutura `utils/`, `global/`, `components/`, `dialogs/` com nomeação consistente. Scoping com `.cardigan {}` é correto.

7. **Hot reload**: `system.json` com `flags.hotReload` bem configurado para CSS, HBS, JSON, MJS.

8. **Compêndios com fonte JSON**: Trabalhar com `src/packs/*.json` e compilar via `build:packs` é o padrão correto (foundry-cli).

---

## 3. Problemas Encontrados

### P0 — Correções Urgentes

#### P0-1: Handlebars helpers registrados em duplicata
- **Problema**: `concat`, `toLowerCase`, `selected`, `hasRangedWeapons` são registrados DUAS vezes — uma vez em `cardigan.mjs` (linhas 117-148 + linhas 337-435) e outra em `helpers/config.mjs` (via `registerHandlebarsHelpers()`). O segundo registro silenciosamente sobrescreve o primeiro.
- **Onde**: `module/cardigan.mjs` linhas 117-148 (dentro do init) + linhas 337-435 (fora do init, no escopo global). `module/helpers/config.mjs` linhas 80-316.
- **Referência**: dnd5e registra helpers uma única vez, centralizados em `utils.mjs`.
- **Mudança**: Remover os helpers duplicados de `cardigan.mjs`, manter apenas os de `config.mjs`. Mover os helpers que só existem em `cardigan.mjs` para `config.mjs`.
- **Risco**: Baixo — testar se nenhum helper ficou faltando.
- **Esforço**: Baixo.

#### P0-2: Helpers registrados fora de hooks (escopo global)
- **Problema**: Em `cardigan.mjs`, linhas 337-466 registram Handlebars helpers no escopo do módulo (fora de `Hooks.once('init')`). Isso significa que são executados no momento do `import`, antes do Foundry estar pronto. Pode funcionar por acaso, mas é um bug latente — se a ordem de carregamento mudar, pode quebrar.
- **Onde**: `module/cardigan.mjs` linhas 337-466.
- **Referência**: dnd5e e pf2e registram todos helpers dentro do hook `init`.
- **Mudança**: Mover para dentro do `registerHandlebarsHelpers()` em `config.mjs`.
- **Risco**: Baixo.
- **Esforço**: Baixo.

#### P0-3: Dois hooks `setup` separados
- **Problema**: `cardigan.mjs` tem `Hooks.once('setup', ...)` em duas chamadas separadas (linhas 237 e 244). Embora funcione, é confuso e frágil — sugere que foram adicionados em momentos diferentes sem consolidar.
- **Onde**: `module/cardigan.mjs` linhas 237-264.
- **Mudança**: Consolidar em um único `Hooks.once('setup', ...)`.
- **Risco**: Nenhum.
- **Esforço**: Baixo.

#### P0-4: `lib/some-lib/` é placeholder vazio do boilerplate
- **Problema**: Pasta `lib/some-lib/` com arquivos vazios `some-lib.css` e `some-lib.min.js`. É lixo do boilerplate original que nunca foi removido.
- **Onde**: `lib/some-lib/`.
- **Mudança**: Deletar a pasta `lib/` inteira.
- **Risco**: Nenhum (nada referencia esses arquivos).
- **Esforço**: Trivial.

#### P0-5: `template.json` deveria ser removido ou marcado como legado
- **Problema**: `template.json` (254 linhas) replica o schema dos DataModels. Com `documentTypes` em `system.json` e DataModels em `module/data/`, o `template.json` é redundante e pode causar confusão se ficar desatualizado (e já pode estar).
- **Onde**: `template.json` (raiz).
- **Referência**: Foundry v12 documenta que `template.json` é desnecessário quando se usa `documentTypes` + DataModels. pf2e não usa `template.json`.
- **Mudança**: Testar remoção completa. Se algo depender dele, manter mas adicionar `_DEPRECATED` no nome ou um comentário no topo.
- **Risco**: Médio — precisa testar que nenhuma parte do Foundry Core ainda lê este arquivo no v12.
- **Esforço**: Baixo.

#### P0-6: `system.json` com URLs placeholder
- **Problema**: `url`, `bugs`, `manifest`, `download` são strings placeholder como `"Replace this with a link..."`. Se alguém tentar instalar o sistema via manifest, vai quebrar.
- **Onde**: `system.json` linhas 60, 63, 128-129.
- **Mudança**: Preencher com URLs reais do GitHub ou remover os campos.
- **Risco**: Nenhum.
- **Esforço**: Trivial.

#### P0-7: `package.json` com `author: "Asacolips"` do boilerplate
- **Problema**: O campo `author` em `package.json` ainda é "Asacolips" (autor do boilerplate original), não "Spinelli666".
- **Onde**: `package.json` linha 14.
- **Mudança**: Corrigir para o autor real.
- **Risco**: Nenhum.
- **Esforço**: Trivial.

#### P0-8: Versão desatualizada/inconsistente entre `system.json` e `package.json`
- **Problema**: `system.json` diz `"version": "1.3.7"`, `package.json` diz `"version": "3.0.0"`. Devem estar sincronizados.
- **Onde**: `system.json` linha 72, `package.json` linha 3.
- **Mudança**: Decidir a versão canônica e sincronizar.
- **Risco**: Nenhum.
- **Esforço**: Trivial.

---

### P1 — Melhorias Arquiteturais

#### P1-1: `cardigan.mjs` é um God Object (3.750 linhas)
- **Problema**: O entry point do sistema contém: init/setup hooks (168 linhas), status effects loader (55 linhas), Handlebars helpers duplicados (130 linhas), lógica de combate PvP completa (diálogos atacante/GM/evasão/dano — ~1.500 linhas), sistema de trade completo (~650 linhas), merchant trade (~450 linhas), macro support (60 linhas), chat message hooks (~300 linhas), evasion/precision handlers (~400 linhas).
- **Onde**: `module/cardigan.mjs` inteiro.
- **Referência**: dnd5e `dnd5e.mjs` tem ~150 linhas — é apenas bootstrap. Lógica de combate fica em `module/dice/`, dialogs em `module/applications/`, chat em `module/chat/`.
- **Mudança recomendada** (incremental):
  1. Extrair combat dialogs → `module/combat/combat-dialogs.mjs` (~1.500 linhas)
  2. Extrair trade handlers → `module/trade/trade-handlers.mjs` (~650 linhas)
  3. Extrair merchant trade → `module/trade/merchant-trade-handlers.mjs` (~450 linhas)
  4. Extrair chat hooks → `module/hooks/chat-hooks.mjs` (~300 linhas)
  5. Extrair evasion/precision → `module/combat/evasion-precision.mjs` (~400 linhas)
  6. Resultado: `cardigan.mjs` reduz para ~200 linhas (apenas bootstrap)
- **Risco**: Médio — muitas funções usam closures que referenciam outras no mesmo escopo.
- **Esforço**: Alto.
- **Prioridade**: P1 (grande impacto, mas grande esforço).

#### P1-2: `actor-sheet.mjs` ainda é monolítico (5.411 linhas)
- **Problema**: Apesar das extrações já feitas, `actor-sheet.mjs` ainda tem 5.411 linhas. Contém: preparação de contexto (~400 linhas), `_onRender` com ~25 listeners setup calls (~100 linhas), `_prepareItems` (~120 linhas), `_deleteDoc` com lógica de confirmar e exibir em chat (~380 linhas), criação de docs com seleção de tipo (~80 linhas), context menu completo (~200 linhas), `_onAction` handler (~200 linhas), abilities listeners (~200 linhas), bonus fields listeners (~200 linhas), profession table listeners (~100 linhas), enhancement checkbox listeners (~100 linhas), health/energy bars (~50 linhas), recipe cooking (~400 linhas), crafting (~300 linhas), drag & drop (~100 linhas), processar modificadores de consumíveis (~150 linhas).
- **Onde**: `module/sheets/actor-sheet.mjs`.
- **Referência**: dnd5e `ActorSheet5eCharacter` tem ~1.350 linhas.
- **Mudança**: Seguir o backlog de extrações em `tarefas-pendentes.md` — next: modal de abilities, context menu, drag & drop, listeners dinâmicos.
- **Risco**: Médio.
- **Esforço**: Alto (incremental, dividir em PRs).

#### P1-3: `item-sheet.mjs` é monolítico (3.208 linhas)
- **Problema**: Similar ao actor-sheet, `item-sheet.mjs` concentra toda a lógica de todos os 10 tipos de item em um único arquivo. Cada tipo tem lógica diferente de drop, change, render, ingredientes, receitas, skills, efeitos, armas, armaduras, consumíveis.
- **Onde**: `module/sheets/item-sheet.mjs`.
- **Referência**: dnd5e tem `ItemSheet5e` como base (~500 linhas) e sheets especializadas por tipo.
- **Mudança recomendada**: Não precisa criar 10 sheets separadas, mas deveria extrair lógica em actions/helpers por domínio (similar ao padrão já usado em `sheets/actions/`).
- **Risco**: Médio.
- **Esforço**: Alto.

#### P1-4: `socket.mjs` — duplicação de handlers e if/else gigante
- **Problema**: `registerInitSocketListeners` tem um bloco monolítico de if/else (linhas 13-109) com ~10 conditions. Os handlers de weapon properties seguem padrão idêntico (import dinâmico → apply → notify) mas cada um é escrito por extenso. Além disso, handlers de combate (notifyGMEvasion, notifyDamage, etc.) são passados como parâmetro E TAMBÉM registrados novamente em `registerReadySocketListeners` (linhas 204-220).
- **Onde**: `module/socket.mjs`.
- **Referência**: dnd5e usa um sistema de despacho baseado em objeto `{ action: handler }` ao invés de if/else chains.
- **Mudança**: Refatorar para dispatch map + generalizar o padrão de weapon property handlers.
- **Risco**: Baixo (manter interfaces idênticas).
- **Esforço**: Médio.

#### P1-5: `consumable-actions.mjs` é muito grande (2.386 linhas)
- **Problema**: Um único arquivo action com 2.386 linhas para consumíveis. Contém lógica de aplicação de efeitos, cálculo de HP/energia, processar modificadores, UI dialogs — mistura responsabilidades.
- **Onde**: `module/sheets/actions/consumable-actions.mjs`.
- **Mudança**: Separar lógica de cálculo (modifiers, HP/energy) de lógica de UI (dialog, chat).
- **Risco**: Baixo.
- **Esforço**: Médio.

#### P1-6: HTML inline em JavaScript (strings template)
- **Problema**: Múltiplos arquivos constroem HTML diretamente em strings JavaScript — `cardigan.mjs` (linhas 3413+), `actor-sheet.mjs` (linhas 4809+), `item-sheet.mjs`, `consumable-actions.mjs`, etc. Isso mistura lógica com apresentação, é difícil de manter, e é vulnerável a XSS se dados do usuário forem interpolados sem sanitização.
- **Onde**: Espalhado por `cardigan.mjs`, `actor-sheet.mjs`, `item-sheet.mjs`, vários actions.
- **Referência**: dnd5e e pf2e usam templates Handlebars para TODA geração de HTML. Até chat messages usam templates.
- **Mudança**: Migrar HTML inline para templates `.hbs` e usar `foundry.applications.handlebars.renderTemplate()`.
- **Risco**: Baixo (troca mecânica).
- **Esforço**: Alto (muitos locais).

#### P1-7: Inline styles em JavaScript
- **Problema**: `cardigan.mjs` e `actor-sheet.mjs` aplicam estilos via `element.style.*` diretamente (ex: linhas 3600-3601 de `cardigan.mjs`, linha 3413 com estilos inline em HTML). Isso é anti-pattern — dificulta temas, acessibilidade, e manutenção.
- **Onde**: Espalhado.
- **Mudança**: Mover para classes CSS.
- **Risco**: Baixo.
- **Esforço**: Médio.

---

### P2 — Organização e DX

#### P2-1: Ausência de linter/formatter
- **Problema**: Sem ESLint, Prettier ou qualquer outro linter. O código tem inconsistências de estilo: uso de `var` em alguns locais (cardigan.mjs linha 121), mix de aspas simples e duplas, indentação inconsistente.
- **Referência**: dnd5e, pf2e e daggerheart todos usam ESLint.
- **Mudança**: Adicionar ESLint + Prettier com config mínima.
- **Risco**: Nenhum (apenas DX).
- **Esforço**: Baixo.

#### P2-2: Ausência de CI/CD pipeline
- **Problema**: Existe `.github/` com templates de issue/PR, mas não há GitHub Actions para build, lint ou release. O processo de release é manual.
- **Referência**: dnd5e e olddragon2e têm workflows de CI que fazem build e geram release.
- **Mudança**: Adicionar workflow mínimo: lint + build SCSS + build packs.
- **Risco**: Nenhum.
- **Esforço**: Médio.

#### P2-3: `scripts/` — acúmulo de scripts pontuais
- **Problema**: 19 scripts de manutenção, alguns provavelmente já obsoletos (`fix-text-align-styles.mjs`, múltiplos `rebuild-*`). Não há documentação de quais ainda são úteis.
- **Onde**: `scripts/`.
- **Mudança**: Revisar, documentar os úteis, arquivar/deletar os obsoletos.
- **Risco**: Nenhum.
- **Esforço**: Baixo.

#### P2-4: `.gitignore` não ignora `packs/` (artefatos de build)
- **Problema**: Os diretórios `packs/*/` contêm artefatos LevelDB (CURRENT, LOG, MANIFEST-*) que são regenerados por `npm run build:packs`. Eles aparecem como mudanças no git status constantemente. O `.gitignore` não os ignora.
- **Onde**: `.gitignore`.
- **Referência**: dnd5e ignora o diretório `packs/` compilado.
- **Mudança**: Adicionar `packs/` ao `.gitignore`. Comitar apenas os fontes JSON em `src/packs/`.
- **Risco**: Baixo — precisa ajustar o `system.json` `path` para funcionar (ou manter `packs/` e ignorar seus artefatos).
- **Esforço**: Baixo.
- **Nota importante**: O Foundry espera encontrar os packs em `packs/` no sistema instalado. Se ignorar no git, precisa garantir que `npm run build:packs` é executado antes de usar. Alternativa: ignorar apenas `packs/*/LOG*`, `packs/*/CURRENT`, `packs/*/MANIFEST-*` (os artefatos LevelDB que mudam).

#### P2-5: CSS compilado está no repositório
- **Problema**: `css/cardigan.css` (27.072 linhas) está no git e deve ser reconstruído toda vez que SCSS muda. Idealmente seria ignorado e gerado via CI/build.
- **Onde**: `css/cardigan.css`.
- **Referência**: dnd5e e pf2e ignoram CSS compilado no git.
- **Trade-off**: Se não há CI, precisa estar no git para o sistema funcionar quando clonado. Se adicionar CI, pode ignorar.
- **Mudança**: Manter por agora, mas planejar ignorar quando tiver CI.
- **Risco**: Nenhum.
- **Esforço**: Trivial.

#### P2-6: Sem JSDoc ou tipagem mínima
- **Problema**: A maioria do código não tem JSDoc. Os DataModels não documentam seus campos, os métodos das sheets não documentam parâmetros ou retornos.
- **Referência**: pf2e tem JSDoc excelente em todos os data models.
- **Mudança**: Adicionar JSDoc progressivamente (priorizar DataModels e métodos públicos).
- **Risco**: Nenhum.
- **Esforço**: Médio (contínuo).

---

### P3 — Melhorias de Longo Prazo

#### P3-1: `skill-manager.mjs` + `base-skill.mjs` são densos (3.658 linhas total)
- **Problema**: Documentado em `tarefas-pendentes.md` como Fase 3. Profissões e skills raciais estão embutidas no skill-manager.
- **Mudança**: Conforme plano existente.
- **Esforço**: Alto.

#### P3-2: Weapon properties têm duplicação significativa
- **Problema**: 6 dos 8 arquivos de weapon properties (`contundente`, `eletrocutar`, `ferir`, `impacto`, `incendiar`, `traspassar`) seguem padrão quase idêntico: ~123 linhas cada, com `applyXxxEffect`, `getAppliedLevel`, `getEffectLevelLabel`. Já existe `base-weapon-property.mjs` mas não está sendo usado como template method.
- **Mudança**: Documentado em `tarefas-pendentes.md` como Fase 4.
- **Esforço**: Médio.

#### P3-3: Templates sem partials reutilizáveis
- **Problema**: Os templates `actor/*.hbs` são grandes e contêm HTML repetitivo para item rows, proficiency rows, etc.
- **Mudança**: Documentado em `tarefas-pendentes.md` como Fase 2.
- **Esforço**: Médio.

#### P3-4: Strings hardcoded em português no JS
- **Problema**: Apesar do arquivo i18n existir, há strings PT-BR diretamente no JS (ex: `"Leve"`, `"Pesado"` em `config.mjs`; `"Erro Crítico na re-rolagem!"` em `cardigan.mjs`; emojis com texto PT nos socket handlers).
- **Onde**: `module/helpers/config.mjs`, `module/cardigan.mjs`, `module/socket.mjs`.
- **Referência**: dnd5e e pf2e usam `game.i18n.localize()` para 100% das strings.
- **Mudança**: Substituir por chaves i18n.
- **Risco**: Baixo.
- **Esforço**: Médio.

#### P3-5: `item-consumivel.mjs` é o maior data model (1.128 linhas)
- **Problema**: O schema do consumível é muito grande, com 40+ campos para representar modificadores de vida, energia, armadura, status, toxicidade, fratura, comida, água, movimento, crítico. Pode indicar que o tipo "consumível" está fazendo coisas demais — talvez fosse melhor ter subtipos ou composição.
- **Onde**: `module/data/item-consumivel.mjs`.
- **Mudança**: Avaliar se merece subtipagem (ex: `item-potion`, `item-food`, `item-tonic`).
- **Risco**: Alto (breaking change de dados).
- **Esforço**: Alto.
- **Nota**: Não fazer sem análise de impacto completa.

---

## 4. Comparação com Referências

| Aspecto | Cardigan | dnd5e | pf2e | daggerheart | olddragon2e |
|---------|----------|-------|------|-------------|-------------|
| Entry point (linhas) | 3.750 | ~150 | ~200 | ~100 | ~150 |
| Actor sheet (linhas) | 5.411 | ~1.350 | ~940 | ~1.014 | ~800 |
| Item sheet (linhas) | 3.208 | ~500 base | ~300 base | ~200 | ~400 |
| DataModels | ✅ sim | ✅ sim | ✅ sim | ✅ sim | ✅ sim |
| `template.json` | ainda existe | removido | removido | removido | usa |
| Linter | ❌ | ESLint | ESLint | ESLint | ❌ |
| CI/CD | ❌ | ✅ GitHub Actions | ✅ GitHub Actions | ✅ | ❌ |
| Tests | ❌ | parcial | sim (Vitest) | ❌ | ❌ |
| HTML inline em JS | ❌ sim | ❌ não | ❌ não | ❌ não | parcial |
| Handlebars partials | poucos | sim | sim | sim | poucos |
| i18n coverage | ~85% | ~100% | ~100% | ~100% | ~90% |
| JSDoc | mínimo | bom | excelente | parcial | mínimo |
| Bundler | ❌ (ES modules nativos) | Rollup | Webpack | Rollup | ❌ |

---

## 5. Estrutura de Pastas Sugerida

Mudança **incremental**, sem alterar pastas que já funcionam:

```
module/
├── cardigan.mjs                     # ← reduzir para ~200 linhas (apenas bootstrap)
├── combat/                          # NOVO — extraído de cardigan.mjs
│   ├── combat-dialogs.mjs           # diálogos atacante/GM
│   ├── evasion-precision.mjs        # handlers evasão/precisão no chat
│   └── damage-calculator.mjs        # cálculos de dano puro
├── trade/                           # NOVO — extraído de cardigan.mjs
│   ├── trade-handlers.mjs           # player-to-player trade
│   └── merchant-trade-handlers.mjs  # merchant trade
├── hooks/                           # EXPANDIR
│   ├── whisper-placeholder.mjs      # existente
│   ├── chat-hooks.mjs               # NOVO — extraído de cardigan.mjs
│   └── status-effects-loader.mjs    # NOVO — extraído de cardigan.mjs
├── socket.mjs                       # refatorar para dispatch map
├── data/                            # manter como está
├── documents/                       # manter como está
├── sheets/
│   ├── actor-sheet.mjs              # continuar extrações pendentes
│   ├── item-sheet.mjs               # futura extração de lógica por tipo
│   ├── actions/                     # manter, continuar crescendo
│   ├── listeners/                   # manter
│   └── parts/                       # manter
├── applications/                    # manter como está
├── effects/                         # manter como está
├── skills/                          # futura refatoração (Fase 3)
├── races/                           # manter como está
├── weapon-properties/               # futura refatoração (Fase 4)
├── tooltips/                        # manter como está
└── helpers/
    └── config.mjs                   # consolidar TODOS os Handlebars helpers aqui
```

---

## 6. Plano de Refatoração por Fases

### Fase 1 — Limpeza segura (sem mudar comportamento)
**Estimativa: 1-2 dias**

- [ ] Deletar `lib/some-lib/` (P0-4)
- [ ] Corrigir `author` em `package.json` (P0-7)
- [ ] Sincronizar versões `system.json` ↔ `package.json` (P0-8)
- [ ] Preencher ou remover URLs placeholder de `system.json` (P0-6)
- [ ] Consolidar os dois `Hooks.once('setup')` em um só (P0-3)
- [ ] Remover helpers duplicados de `cardigan.mjs`, mover os únicos para `config.mjs` (P0-1, P0-2)
- [ ] Testar remoção do `template.json` (P0-5)
- [ ] Adicionar gitignore para artefatos de packs: `packs/*/LOG*`, `packs/*/CURRENT`, `packs/*/MANIFEST-*` (P2-4)
- [ ] Limpar scripts obsoletos em `scripts/` (P2-3)

### Fase 2 — Separação de responsabilidades de `cardigan.mjs`
**Estimativa: 3-5 dias**

- [ ] Extrair `loadStatusEffects()` → `module/hooks/status-effects-loader.mjs`
- [ ] Extrair combat dialogs (createAttackerResultDialog, createGMEvasionNotification, showArmorDurabilityDialog) → `module/combat/combat-dialogs.mjs`
- [ ] Extrair evasion/precision click handlers → `module/combat/evasion-precision.mjs`
- [ ] Extrair trade handlers → `module/trade/trade-handlers.mjs`
- [ ] Extrair merchant trade handlers → `module/trade/merchant-trade-handlers.mjs`
- [ ] Extrair chat hooks (skill description toggles, effect message toggles) → `module/hooks/chat-hooks.mjs`
- [ ] Refatorar `socket.mjs` para usar dispatch map

### Fase 3 — Melhorias de tooling/build
**Estimativa: 1-2 dias**

- [ ] Adicionar ESLint com configuração mínima (regras base, sem TypeScript)
- [ ] Adicionar Prettier
- [ ] Adicionar GitHub Actions workflow mínimo (lint + build CSS + build packs)
- [ ] Considerar `npm run build:all` como etapa de CI

### Fase 4 — Continuar modularização de sheets
**Estimativa: 5-10 dias (incremental)**

Seguir o backlog existente de `tarefas-pendentes.md`:
- [ ] Extrair modal de abilities + derived stats do `actor-sheet.mjs`
- [ ] Extrair context menu completo do `actor-sheet.mjs`
- [ ] Extrair drag & drop do `actor-sheet.mjs`
- [ ] Extrair listeners de campos dinâmicos do `actor-sheet.mjs`
- [ ] Extrair receitas/crafting do `actor-sheet.mjs`
- [ ] Iniciar extração de lógica por tipo de item do `item-sheet.mjs`

### Fase 5 — Limpeza final e documentação
**Estimativa: contínuo**

- [ ] Migrar HTML inline para templates `.hbs`
- [ ] Substituir strings hardcoded por chaves i18n
- [ ] Adicionar JSDoc nos DataModels e métodos públicos
- [ ] Criar partials Handlebars reutilizáveis (Fase 2 do plano existente)

---

## 7. Arquivos que devem ser alterados primeiro

1. `module/cardigan.mjs` — limpar helpers duplicados, consolidar hooks (Fase 1)
2. `package.json` — corrigir author e versão (Fase 1)
3. `system.json` — corrigir URLs placeholder e versão (Fase 1)
4. `.gitignore` — adicionar artefatos de packs (Fase 1)
5. `module/helpers/config.mjs` — receber helpers migrados (Fase 1)

## 8. Arquivos que NÃO devem ser mexidos ainda

1. `module/data/*.mjs` — schemas estáveis, mudar = breaking change
2. `module/effects/effects/*.mjs` — padrão estabilizado, funcional
3. `module/races/` — pequeno e estável
4. `lang/pt-BR.json` — não mudar keys existentes
5. `src/packs/*.json` — dados de compêndio, não mexer sem motivo
6. `module/skills/skill-manager.mjs` — refatoração planejada para fase posterior

---

## 9. Perguntas a Responder Antes de Refatorações Maiores

1. **Release/distribuição**: O sistema é distribuído via GitHub Releases (zip)? Via manifest URL? Via cópia direta? Isso afeta se podemos ignorar `css/` e `packs/` no git.

2. **`template.json`**: Há mundos/saves existentes que foram criados quando `template.json` era a fonte de verdade? A remoção pode afetar migração de dados?

3. **Compatibilidade Foundry v13**: Há planos de suportar v13? Isso pode afetar prioridades de refatoração (ex: v13 depreca APIs usadas no sistema).

4. **Players com macros**: Há jogadores ou GMs usando macros que referenciam `game.cardigan.*` ou campos do schema diretamente? Isso limita refatorações de API.

5. **Escopo do `item-consumivel`**: Os 40+ campos do consumível são todos necessários ou há campos que foram adicionados experimentalmente e nunca usados em dados reais?

6. **Prioridade entre `cardigan.mjs` vs `actor-sheet.mjs`**: Ambos são monolíticos, mas a refatoração de `cardigan.mjs` é mais segura (funções independentes) enquanto `actor-sheet.mjs` é mais impactante (onde mais se trabalha). Qual atacar primeiro?
