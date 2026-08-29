# Text Enrichers de Rolagem (`@Teste` / `@Pericia`)

Sistema de enriquecimento de texto que transforma comandos escritos em descrições de Item/Skill/Actor em **botões clicáveis** que disparam rolagens reais, no estilo dos enrichers do dnd5e (`@Check[...]`, `@Damage[...]`).

## Onde funciona

Qualquer campo que passe por `TextEditor.enrichHTML()` — descrição de item, descrição de skill, biografia do actor, descrição expandida na mochila, tooltips. O clique funciona em qualquer lugar em que o HTML enriquecido seja renderizado (ficha, chat, tooltip), porque o listener é um único listener delegado registrado em `document` (não precisa reconfigurar por tela).

## Comandos disponíveis

### `@Teste[atributo]` — teste de atributo

Rola `1d20 + @{atributo}.total` para o ator, usando a mesma infraestrutura das rolagens de atributo da ficha: abre o diálogo de vantagem/desvantagem (sem opção de mão/rolagem em conjunto, já que não é um ataque), aplica a penalidade de Congelado se houver, dispara sangramento se aplicável, detecta crítico e posta o resultado no chat.

**Sintaxe:**
```
@Teste[atributo]
@Teste[atributo dc=NN]
```

O `atributo` aceita o nome em português (como escrito no jogo), a chave em inglês do schema, ou a abreviação de 3 letras — todos case-insensitive e sem acento:

| Português    | Inglês (schema) | Abreviação |
|--------------|------------------|------------|
| forca        | strength         | str        |
| destreza     | dexterity        | dex        |
| vigor        | stamina          | sta        |
| furtividade  | stealth          | ste        |
| persuasao    | persuasion       | per        |
| inteligencia | intelligence     | int        |
| psionismo    | psionics         | psi        |
| precisao     | accuracy         | acc        |
| evasao       | evasion          | eva        |

**Exemplos:**
```
Ao tocar essa poção, faça um @Teste[vigor] ou fique enjoado por 1 minuto.

Se tirar um Acerto Crítico em Agarrar, pode causar Desarmado com um @Teste[destreza dc=16] no alvo.
```

Quando há `dc=`, o card do chat mostra "CD 16 — Sucesso/Falha" comparando com o total rolado. Sem `dc=`, só mostra o resultado da rolagem normalmente.

### `@Pericia[Nome da Skill]` — ativar uma skill

**Não rola dado nenhum sozinho.** Os Items do tipo `skill` no Cardigan não têm rank/bônus numérico (são "poderes" com custo de energia e efeitos, não testes), então esse comando só ativa a skill exatamente como clicar nela na ficha ativaria — mesmo fluxo de `skillManager.handleSkillToChat(nome, actorId)`.

**Sintaxe:**
```
@Pericia[Nome Exato da Skill]
```

O nome precisa bater exatamente (case-sensitive) com o nome do Item de skill que o ator possui — mesma regra que o fluxo padrão de clique na ficha já usa.

**Exemplo:**
```
Combinado com Fôlego Extra, você pode usar @Pericia[Investida Selvagem] duas vezes por combate.
```

## Resolução do ator (quem rola?)

1. Se o botão foi gerado a partir de uma descrição com contexto conhecido (item/skill/actor específico), ele carrega o `uuid` desse documento e resolve o ator dono automaticamente.
2. Se não houver contexto (ex.: texto sem `relativeTo`, como em alguns diálogos de criação de personagem), cai para o token atualmente selecionado no canvas.
3. Se também não houver token selecionado, cai para o personagem atribuído ao usuário (`game.user.character`).
4. Se nada disso resolver, mostra um aviso (`ui.notifications.warn`) e não faz nada — não quebra a tela.

## O que NÃO existe (ainda)

- `@Pericia[nome dc=NN]` — sem sentido hoje porque skills não têm bônus para comparar com uma DC.
- `@Damage[...]`, `@Save[...]` ou qualquer outro comando estilo dnd5e — não implementado, pode ser adicionado depois seguindo o mesmo padrão.

## Arquivos envolvidos

- `module/text-enrichers/roll-check-enricher.mjs` — regex, parsing dos comandos, geração do `<a class="cardigan-roll-link">`.
- `module/text-enrichers/roll-enricher-actions.mjs` — resolução do ator e execução da rolagem/ativação ao clicar.
- `module/text-enrichers/index.mjs` — registro do enricher em `CONFIG.TextEditor.enrichers` e do listener de clique; chamado por `initializeRollEnrichers()` no hook `setup` de `module/cardigan.mjs`.
- `module/helpers/chat-messages.mjs` (`ChatMessageHelper.createRollMessage`) — parâmetro `dc` opcional, calcula sucesso/falha.
- `templates/chat/roll-message.hbs` + `src/scss/components/_chat-rolls.scss` — bloco visual de CD/Sucesso/Falha no card do chat.
- `src/scss/components/_roll-enricher-links.scss` — estilo do botão inline nas descrições.
