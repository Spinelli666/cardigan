# Cardigan

![Foundry v12](https://img.shields.io/badge/foundry-v12-green) ![Foundry v14](https://img.shields.io/badge/foundry-v14%20verified-green) ![Idioma](https://img.shields.io/badge/idioma-pt--BR-blue)

Sistema de RPG de mesa **Cardigan** para o [Foundry VTT](https://foundryvtt.com), em português do Brasil.

## Instalação

No Foundry, vá em **Game Systems → Install System** e cole a URL do manifesto:

```
https://github.com/Spinelli666/cardigan/releases/latest/download/system.json
```

**Requisitos:** Foundry VTT v12 ou superior (verificado no v14).

## Funcionalidades

- **Ficha de personagem e de NPC** com atributos, proficiências, skills, equipamento, profissões e biografia.
- **Classes** Andarilho, Guerreiro, Ladino e Feiticeiro, além de skills raciais e skills únicas.
- **Raças** Humano, Anão, Elfo, Gnomo e Norsca, com bônus e skills raciais aplicados automaticamente.
- **Wizards de criação de personagem e de level-up.**
- **Combate** com resolução multiplayer: ataque, evasão, precisão, dano, críticos e durabilidade de armadura por região do corpo.
- **Propriedades de arma** com efeitos no crítico: Ferir, Traspassar, Contundente, Incendiar, Eletrocutar, Impacto, Certeiro e Vorpal.
- **Efeitos de status automatizados**, como Sangramento, Incendiado, Eletrocutado, Congelado, Petrificado, Lento, Envenenado, Amaldiçoado, Exaustão, Fratura e Toxicidade.
- **Sobrevivência:** fome, sede, toxicidade e sanidade.
- **Mochila** com peso, munição, consumíveis, ingredientes, caixa expansível e tooltips de preview de item.
- **Profissões e crafting:** culinária, costura e tecnomagia, via receitas.
- **Troca** entre jogadores e **comércio** com NPC mercador.
- **Enrichers de texto:** `@Teste[atributo]` e `@Pericia[...]` viram botões de rolagem em qualquer descrição.
- **Compêndios SRD:** Efeitos, Skills, Raças e Equipamentos.

## Desenvolvimento

O sistema roda como módulos ES nativos (`.mjs`), sem bundler. As ferramentas de build servem só para o SCSS e os compêndios.

```bash
npm install          # instala sass e @foundryvtt/foundryvtt-cli
npm run build        # compila src/scss → css/cardigan.css
npm run watch        # idem, em modo watch com source maps
npm run build:packs  # compila src/packs/*.json → packs/ (LevelDB)
npm run build:all    # CSS + packs
```

- Edite sempre os fontes em `src/scss/` e `src/packs/`, nunca `css/cardigan.css` nem os arquivos LevelDB em `packs/`.
- Feche o Foundry antes de rodar `build:packs` ou de trocar de branch, porque os packs ficam bloqueados enquanto ele está aberto.
- A documentação técnica (arquitetura, convenções, tarefas pendentes) está em [`docs-ai/`](docs-ai/project-overview.md).

## Créditos e licença

Desenvolvido por **Spinelli666** ([GitHub](https://github.com/Spinelli666)).

Baseado originalmente no boilerplate [BoilerplateSystem](https://gitlab.com/asacolips-projects/foundry-mods/boilerplate) da Asacolips Projects. Licença MIT, veja [LICENSE.txt](LICENSE.txt).

Problemas e sugestões: [issues no GitHub](https://github.com/Spinelli666/cardigan/issues).
