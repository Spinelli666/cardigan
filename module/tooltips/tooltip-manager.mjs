/**
 * Gerenciador de tooltips customizado para o sistema Cardigan
 * Implementa tooltips ricos com click para fixar (lock)
 */
export default class CardiganTooltipManager {
  /**
   * Inicializa o gerenciador de tooltips
   * Como o hook renderTooltip não existe no Foundry V12+,
   * usamos uma abordagem diferente: anexar listeners diretamente
   * nos elementos durante a renderização da sheet
   */
  static initialize() {
    console.log('[CARDIGAN] Tooltip Manager initialized (listeners will be attached on sheet render)');
  }

  /**
   * Remove tooltip com animação de fade out
   * @param {HTMLElement} tooltip - Elemento do tooltip a ser removido
   * @param {number} duration - Duração da animação em ms (padrão: 200)
   */
  static _removeTooltipWithFade(tooltip, duration = 200) {
    if (!tooltip) return;
    
    tooltip.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`;
    tooltip.style.opacity = '0';
    tooltip.style.transform = tooltip.classList.contains('tooltip-flipped') 
      ? 'translate(-50%, calc(-100% - 5px)) scale(0.95)'
      : 'translateX(-50%) translateY(5px) scale(0.95)';
    
    setTimeout(() => {
      tooltip.remove();
    }, duration);
  }

  /**
   * Anexa event listeners para tooltips ricos de proficiências
   * @param {HTMLElement} html - Elemento HTML da sheet renderizada
   * @param {Actor} actor - Actor da sheet
   */
  static attachProficiencyTooltips(html, actor) {
    // Encontrar todas as labels de proficiências com data-tooltip-type="proficiency"
    const proficiencyLabels = html.querySelectorAll('[data-tooltip-type="proficiency"]');
    
    proficiencyLabels.forEach(label => {
      const ability = label.dataset.ability;
      
      // Click para fixar tooltip rico
      label.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Desativar tooltip nativo se estiver ativo
        if (game.tooltip) {
          game.tooltip.deactivate();
        }
        
        // Mostrar tooltip rico fixado
        await this._showRichProficiencyTooltip(label, ability, actor);
      });
    });
  }

  /**
   * Anexa event listeners para tooltips ricos de efeitos
   * @param {HTMLElement} html - Elemento HTML da sheet renderizada
   * @param {Actor} actor - Actor da sheet
   */
  static attachEffectTooltips(html, actor) {
    // Encontrar todos os efeitos com data-tooltip-type="effect"
    const effectElements = html.querySelectorAll('[data-tooltip-type="effect"]');
    
    effectElements.forEach(element => {
      const effectName = element.dataset.effectName;
      const effectDescription = element.dataset.effectDescription;
      const effectImg = element.dataset.effectImg;
      const effectType = element.dataset.effectType; // 'active' or 'item'
      
      // Hover para mostrar tooltip rico
      element.addEventListener('mouseenter', async (event) => {
        // Desativar tooltip nativo se estiver ativo
        if (game.tooltip) {
          game.tooltip.deactivate();
        }
        
        // Remover tooltips não-fixados anteriores com fade
        const existingHoverTooltips = document.querySelectorAll('.locked-tooltip.effect-tooltip:not(.tooltip-pinned)');
        existingHoverTooltips.forEach(tooltip => this._removeTooltipWithFade(tooltip, 150));
        
        // Pequeno delay para suavizar a transição entre tooltips
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Mostrar tooltip rico
        await this._showRichEffectTooltip(element, effectName, effectDescription, effectImg, false);
      });
      
      // Mouseleave para fechar tooltip (se não estiver fixado)
      element.addEventListener('mouseleave', async (event) => {
        // Apenas remove tooltips não-fixados com fade
        const hoverTooltips = document.querySelectorAll('.locked-tooltip.effect-tooltip:not(.tooltip-pinned)');
        hoverTooltips.forEach(tooltip => this._removeTooltipWithFade(tooltip, 200));
      });
      
      // Click para fixar tooltip rico
      element.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Desativar tooltip nativo se estiver ativo
        if (game.tooltip) {
          game.tooltip.deactivate();
        }
        
        // Verificar se já existe um tooltip de hover visível para este efeito
        const existingHoverTooltip = document.querySelector('.locked-tooltip.effect-tooltip:not(.tooltip-pinned)');
        
        if (existingHoverTooltip) {
          // Se já existe tooltip de hover, apenas adicionar classe pinned
          existingHoverTooltip.classList.add('tooltip-pinned');
          
          // Adicionar listener para fechar ao clicar fora
          const closeTooltip = (evt) => {
            if (!existingHoverTooltip.contains(evt.target) && !element.contains(evt.target)) {
              this._removeTooltipWithFade(existingHoverTooltip, 200);
              document.removeEventListener('click', closeTooltip);
            }
          };
          
          // Pequeno delay para não fechar imediatamente com o mesmo click
          setTimeout(() => {
            document.addEventListener('click', closeTooltip);
          }, 100);
        } else {
          // Se não existe, criar novo tooltip fixado
          await this._showRichEffectTooltip(element, effectName, effectDescription, effectImg, true);
        }
      });
    });
  }

  /**
   * Anexa event listeners para tooltips ricos de fórmulas de dados
   * @param {HTMLElement} html - Elemento HTML da mensagem de chat renderizada
   */
  static attachDiceFormulaTooltips(html) {
    // Encontrar todos os elementos com data-tooltip-type="dice-formula"
    const diceElements = html.querySelectorAll('[data-tooltip-type="dice-formula"]');
    
    diceElements.forEach(element => {
      const diceFormulaJson = element.dataset.diceFormula;
      
      if (!diceFormulaJson) return;
      
      let diceFormulaData;
      try {
        diceFormulaData = JSON.parse(diceFormulaJson);
      } catch (error) {
        console.warn('[CARDIGAN] Failed to parse dice formula data:', error);
        return;
      }
      
      // Hover para mostrar tooltip rico
      element.addEventListener('mouseenter', async (event) => {
        // Desativar tooltip nativo se estiver ativo
        if (game.tooltip) {
          game.tooltip.deactivate();
        }
        
        // Remover tooltips anteriores com fade rápido
        const existingTooltips = document.querySelectorAll('.locked-tooltip.dice-formula-tooltip');
        existingTooltips.forEach(tooltip => this._removeTooltipWithFade(tooltip, 100));
        
        // Delay mínimo para suavizar transição
        if (existingTooltips.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Mostrar tooltip rico
        await this._showRichDiceFormulaTooltip(element, diceFormulaData);
      });
      
      // Mouseleave para fechar tooltip
      element.addEventListener('mouseleave', async (event) => {
        // Remove todos os tooltips de fórmula de dados com fade
        const hoverTooltips = document.querySelectorAll('.locked-tooltip.dice-formula-tooltip');
        hoverTooltips.forEach(tooltip => this._removeTooltipWithFade(tooltip, 150));
      });
    });
  }

  /**
   * Anexa listeners de tooltip (hover apenas, sem pin) aos badges "Vida & Energia",
   * "Efeitos" e "Teste de Perícia" mostrados no resumo do item consumível na mochila.
   * O conteúdo é montado a partir dos mesmos dados usados pela aba Propriedades do
   * form do item (system.effectsSectionAddedEffects, system.skillTestAddedEffects,
   * flag "skillTestAddedSkills" e os campos de fórmula de Vida/Energia).
   * @param {HTMLElement} container - Elemento raiz onde procurar os badges
   * @param {Item} item - O item consumível (fonte dos dados)
   */
  static attachConsumableBadgeTooltips(container, item) {
    if (!container || !item) return;

    const badges = container.querySelectorAll('[data-tooltip-type^="consumable-"]');

    badges.forEach(element => {
      const type = element.dataset.tooltipType;

      element.addEventListener('mouseenter', async () => {
        const existing = document.querySelectorAll('.locked-tooltip.consumable-badge-tooltip:not(.tooltip-pinned)');
        existing.forEach(tooltip => this._removeTooltipWithFade(tooltip, 100));

        const built = await this._buildConsumableBadgeTooltipData(type, item);
        if (!built) return;

        await this._showConsumableBadgeTooltip(element, built.templatePath, built.context, false);
      });

      element.addEventListener('mouseleave', () => {
        const tooltips = document.querySelectorAll('.locked-tooltip.consumable-badge-tooltip:not(.tooltip-pinned)');
        tooltips.forEach(tooltip => this._removeTooltipWithFade(tooltip, 150));
      });

      // Click para fixar o tooltip (temporário — remover quando o usuário pedir)
      element.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const existingHoverTooltip = document.querySelector('.locked-tooltip.consumable-badge-tooltip:not(.tooltip-pinned)');

        if (existingHoverTooltip) {
          existingHoverTooltip.classList.add('tooltip-pinned');
          existingHoverTooltip.style.pointerEvents = 'auto';

          const closeTooltip = (evt) => {
            if (!existingHoverTooltip.contains(evt.target) && !element.contains(evt.target)) {
              this._removeTooltipWithFade(existingHoverTooltip, 200);
              document.removeEventListener('click', closeTooltip);
            }
          };

          setTimeout(() => {
            document.addEventListener('click', closeTooltip);
          }, 100);
        } else {
          const built = await this._buildConsumableBadgeTooltipData(type, item);
          if (!built) return;
          await this._showConsumableBadgeTooltip(element, built.templatePath, built.context, true);
        }
      });
    });
  }

  /**
   * Monta template + contexto do tooltip de um badge do resumo de item consumível.
   * @param {string} type - "consumable-life-energy" | "consumable-effects" | "consumable-skill-test"
   * @param {Item} item
   * @returns {Promise<{templatePath: string, context: object}|null>}
   */
  static async _buildConsumableBadgeTooltipData(type, item) {
    if (type === 'consumable-life-energy') {
      const entries = this._buildConsumableLifeEnergyEntries(item.system);
      if (!entries.length) return null;
      return { templatePath: 'systems/cardigan/templates/tooltips/consumable-life-energy-tooltip.hbs', context: { entries } };
    }

    if (type === 'consumable-effects') {
      const effects = Array.isArray(item.system.effectsSectionAddedEffects) ? item.system.effectsSectionAddedEffects : [];
      if (!effects.length) return null;
      return { templatePath: 'systems/cardigan/templates/tooltips/consumable-effects-tooltip.hbs', context: { effects } };
    }

    if (type === 'consumable-skill-test') {
      const context = await this._buildConsumableSkillTestContext(item);
      if (!context) return null;
      return { templatePath: 'systems/cardigan/templates/tooltips/consumable-skill-test-tooltip.hbs', context };
    }

    return null;
  }

  /**
   * Monta as entradas de Vida/Energia (fórmula + sinal + temporário) a partir do
   * system do item consumível — mesma lógica de life-energy-dialog-listeners.mjs.
   * @param {object} sys - item.system do item consumível
   * @returns {Array<object>}
   */
  static _buildConsumableLifeEnergyEntries(sys) {
    const getAbilityAbbreviation = (ability) => {
      const key = CONFIG.CARDIGAN.abilities[ability];
      return key ? game.i18n.localize(key) : '';
    };

    const buildFormula = (dice, quantity, bonus, addSkill, skill, doubleSkill) => {
      const diceFaces = (dice || '1d20').replace(/^1/, '');
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      let formula = `${qty}${diceFaces}`;

      const bonusValue = Number(bonus) || 0;
      if (bonusValue !== 0) formula += ` + ${bonusValue}`;

      if (addSkill) {
        const abbr = getAbilityAbbreviation(skill);
        formula += ` + (${abbr}${doubleSkill ? ' * 2' : ''})`;
      }

      return formula;
    };

    const entries = [];

    if (sys.hasHealthModifier) {
      entries.push({
        icon: 'icon-health.svg',
        alt: 'Vida',
        formula: buildFormula(sys.healthModifierDice, sys.healthModifierQuantity, sys.healthModifierAdditionalBonus, sys.healthModifierAddSkill, sys.healthModifierSkill, sys.healthModifierDoubleSkill),
        isTemporary: sys.healthModifierIsTemporary ?? false,
        isDecrease: sys.healthModifierType === 'subtract',
        tempLabel: 'PVT'
      });
    }

    if (sys.hasEnergyModifier) {
      entries.push({
        icon: 'icon-energy.svg',
        alt: 'Energia',
        formula: buildFormula(sys.energyModifierDice, sys.energyModifierQuantity, sys.energyModifierAdditionalBonus, sys.energyModifierAddSkill, sys.energyModifierSkill, sys.energyModifierDoubleSkill),
        isTemporary: sys.energyModifierIsTemporary ?? false,
        isDecrease: sys.energyModifierType === 'subtract',
        tempLabel: 'PET'
      });
    }

    return entries;
  }

  /**
   * Monta o contexto (efeitos + bônus de perícia) do "Teste de Perícia" do item
   * consumível. Retorna null quando não há nada configurado.
   * @param {Item} item
   * @returns {Promise<object|null>}
   */
  static async _buildConsumableSkillTestContext(item) {
    const skillOptions = [
      { key: 'accuracy', label: 'Precisão' },
      { key: 'evasion', label: 'Evasão' },
      { key: 'strength', label: 'Força' },
      { key: 'dexterity', label: 'Destreza' },
      { key: 'stamina', label: 'Vigor' },
      { key: 'persuasion', label: 'Persuasão' },
      { key: 'intelligence', label: 'Inteligência' },
      { key: 'stealth', label: 'Furtividade' }
    ];

    const effects = Array.isArray(item.system.skillTestAddedEffects) ? item.system.skillTestAddedEffects : [];

    const rawSkills = await item.getFlag('cardigan', 'skillTestAddedSkills');
    const skills = (Array.isArray(rawSkills) ? rawSkills : [])
      .map(entry => {
        const key = typeof entry === 'string' ? entry : entry?.key;
        const skillData = skillOptions.find(option => option.key === key);
        if (!skillData) return null;

        const value = Number(entry?.skillValue ?? entry?.value ?? 0) || 0;
        return {
          label: skillData.label,
          displayValue: value > 0 ? `+${value}` : `${value}`,
          criticalFailure: Boolean(entry?.criticalFailure),
          criticalHit: Boolean(entry?.criticalHit)
        };
      })
      .filter(Boolean);

    if (!effects.length && !skills.length) return null;

    return { effects, skills };
  }

  /**
   * Renderiza e posiciona um tooltip de hover (sem pin) para os badges do resumo
   * de item consumível na mochila.
   * @param {HTMLElement} element - Elemento que disparou o hover
   * @param {string} templatePath - Caminho do template do tooltip
   * @param {object} context - Contexto pro template
   */
  static async _showConsumableBadgeTooltip(element, templatePath, context, pinned = false) {
    const template = await foundry.applications.handlebars.getTemplate(templatePath);
    const html = await template(context);

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'locked-tooltip consumable-badge-tooltip cardigan-tooltip tooltip-centered';
    if (pinned) tooltipEl.classList.add('tooltip-pinned');
    tooltipEl.innerHTML = html;

    tooltipEl.style.position = 'fixed';
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.opacity = '0';
    document.body.appendChild(tooltipEl);

    const position = this._calculateTooltipPosition(element, tooltipEl);
    tooltipEl.style.left = `${position.left}px`;
    tooltipEl.style.top = `${position.top}px`;
    tooltipEl.style.zIndex = '10000';
    tooltipEl.style.pointerEvents = pinned ? 'auto' : 'none';

    if (position.shouldFlip) {
      tooltipEl.classList.add('tooltip-flipped');
    }

    tooltipEl.style.visibility = 'visible';
    tooltipEl.style.opacity = '1';

    if (pinned) {
      const closeTooltip = (event) => {
        if (!tooltipEl.contains(event.target) && !element.contains(event.target)) {
          this._removeTooltipWithFade(tooltipEl, 200);
          document.removeEventListener('click', closeTooltip);
        }
      };

      setTimeout(() => {
        document.addEventListener('click', closeTooltip);
      }, 100);
    }
  }

  /**
   * Calcula a melhor posição para o tooltip (acima ou abaixo do elemento)
   * @param {HTMLElement} element - Elemento de referência
   * @param {HTMLElement} tooltipEl - Elemento do tooltip
   * @returns {Object} - Objeto com as propriedades { top, left, shouldFlip }
   */
  static _calculateTooltipPosition(element, tooltipEl) {
    const rect = element.getBoundingClientRect();
    const tooltipHeight = tooltipEl.offsetHeight || 300; // estimativa se ainda não renderizado
    const viewportHeight = window.innerHeight;
    const gap = 8; // espaço entre elemento e tooltip
    
    // Espaço disponível abaixo do elemento
    const spaceBelow = viewportHeight - rect.bottom;
    // Espaço disponível acima do elemento
    const spaceAbove = rect.top;
    
    // Se não há espaço suficiente abaixo E há mais espaço acima, mostrar acima
    const shouldFlip = (spaceBelow < tooltipHeight + gap) && (spaceAbove > spaceBelow);
    
    let top;
    if (shouldFlip) {
      // Posicionar acima do elemento
      top = rect.top - gap;
    } else {
      // Posicionar abaixo do elemento (padrão)
      top = rect.bottom + gap;
    }
    
    return {
      top: top,
      left: rect.left + rect.width / 2,
      shouldFlip: shouldFlip
    };
  }

  /**
   * Mostra um tooltip rico fixado com todas as informações da proficiência
   * @param {HTMLElement} element - Elemento que disparou o tooltip
   * @param {string} ability - ID da habilidade (strength, dexterity, etc.)
   * @param {Actor} actor - Actor da proficiência
   */
  static async _showRichProficiencyTooltip(element, ability, actor) {
    if (!actor) {
      console.warn('[CARDIGAN] No actor provided for rich tooltip');
      return;
    }
    
    // Remover qualquer tooltip existente antes de criar um novo
    const existingTooltips = document.querySelectorAll('.locked-tooltip.proficiency-tooltip');
    existingTooltips.forEach(tooltip => this._removeTooltipWithFade(tooltip, 150));
    if (existingTooltips.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // Pegar dados da habilidade
    const abilityData = actor.system.abilities[ability];
    if (!abilityData) {
      console.warn('[CARDIGAN] Ability data not found for:', ability);
      return;
    }
    
    // Mapear ability ID para chave de tradução
    const abilityKeyMap = {
      accuracy: 'Accuracy',
      evasion: 'Evasion',
      strength: 'Strength',
      dexterity: 'Dexterity',
      stamina: 'Stamina',
      stealth: 'Stealth',
      persuasion: 'Persuasion',
      intelligence: 'Intelligence',
      psionics: 'Psionics'
    };
    
    const abilityKey = abilityKeyMap[ability];
    
    // Preparar contexto para o template
    const context = {
      name: game.i18n.localize(`CARDIGAN.Ability.${abilityKey}.full`),
      subtitle: game.i18n.localize(`CARDIGAN.Ability.${abilityKey}.long`),
      description: game.i18n.localize(`CARDIGAN.Tooltip.Proficiency.${abilityKey}.Description`),
      icon: `systems/cardigan/assets/images/decorative/icons/icon-d20.svg`,
      value: abilityData.value,
      bonus: abilityData.totalBonus,
      total: abilityData.value + abilityData.totalBonus,
      labels: {
        currentValue: game.i18n.localize('CARDIGAN.Tooltip.Proficiency.CurrentValue'),
        bonus: game.i18n.localize('CARDIGAN.Tooltip.Proficiency.Bonus'),
        total: game.i18n.localize('CARDIGAN.Tooltip.Proficiency.Total'),
        clickToLock: game.i18n.localize('CARDIGAN.Tooltip.ClickToLock')
      }
    };
    
    // Renderizar template
    const template = await foundry.applications.handlebars.getTemplate('systems/cardigan/templates/tooltips/proficiency-tooltip.hbs');
    const html = await template(context);
    
    // Criar elemento do tooltip fixado
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'locked-tooltip proficiency-tooltip cardigan-tooltip';
    tooltipEl.innerHTML = html;
    
    // Adicionar classe para centralizar horizontalmente (via CSS)
    tooltipEl.classList.add('tooltip-centered');
    
    // Adicionar ao body temporariamente para medir altura
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.opacity = '0';
    document.body.appendChild(tooltipEl);
    
    // Calcular posição inteligente
    const position = this._calculateTooltipPosition(element, tooltipEl);
    
    // Aplicar posição
    tooltipEl.style.left = `${position.left}px`;
    tooltipEl.style.top = `${position.top}px`;
    tooltipEl.style.zIndex = '10000';
    tooltipEl.style.pointerEvents = 'auto';
    
    // Adicionar classe se tooltip foi invertido (acima)
    if (position.shouldFlip) {
      tooltipEl.classList.add('tooltip-flipped');
    }
    
    // Tornar visível com animação
    tooltipEl.style.visibility = 'visible';
    tooltipEl.style.opacity = '1';
    
    // Adicionar listener para fechar ao clicar fora
    const closeTooltip = (event) => {
      if (!tooltipEl.contains(event.target) && !element.contains(event.target)) {
        this._removeTooltipWithFade(tooltipEl, 200);
        document.removeEventListener('click', closeTooltip);
      }
    };
    
    // Pequeno delay para não fechar imediatamente com o mesmo click
    setTimeout(() => {
      document.addEventListener('click', closeTooltip);
    }, 100);
  }

  /**
   * Mostra um tooltip rico fixado com informações de um efeito
   * @param {HTMLElement} element - Elemento que disparou o tooltip
   * @param {string} name - Nome do efeito
   * @param {string} description - Descrição do efeito
   * @param {string} icon - URL da imagem do efeito
   * @param {boolean} pinned - Se true, tooltip fica fixado (click). Se false, desaparece ao sair (hover)
   */
  static async _showRichEffectTooltip(element, name, description, icon, pinned = false) {
    if (!name) {
      console.warn('[CARDIGAN] No effect name provided for rich tooltip');
      return;
    }
    
    // Se for pinned, remover qualquer tooltip existente com fade antes de criar um novo
    if (pinned) {
      const existingTooltips = document.querySelectorAll('.locked-tooltip.effect-tooltip');
      existingTooltips.forEach(tooltip => this._removeTooltipWithFade(tooltip, 150));
      // Aguardar fade out antes de criar novo
      if (existingTooltips.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    // Processar a descrição para converter ::path:: em imagens
    const enrichedDescription = description ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(description, {async: true}) : 'Sem descrição disponível';
    
    // Preparar contexto para o template
    const context = {
      name: name,
      description: enrichedDescription,
      icon: icon
    };
    
    // Renderizar template
    const template = await foundry.applications.handlebars.getTemplate('systems/cardigan/templates/tooltips/effect-tooltip.hbs');
    const html = await template(context);
    
    // Criar elemento do tooltip fixado
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'locked-tooltip effect-tooltip cardigan-tooltip';
    if (pinned) {
      tooltipEl.classList.add('tooltip-pinned');
    }
    tooltipEl.innerHTML = html;
    
    // Adicionar classe para centralizar horizontalmente (via CSS)
    tooltipEl.classList.add('tooltip-centered');
    
    // Adicionar ao body temporariamente para medir altura
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.opacity = '0';
    document.body.appendChild(tooltipEl);
    
    // Calcular posição inteligente
    const position = this._calculateTooltipPosition(element, tooltipEl);
    
    // Aplicar posição
    tooltipEl.style.left = `${position.left}px`;
    tooltipEl.style.top = `${position.top}px`;
    tooltipEl.style.zIndex = '10000';
    tooltipEl.style.pointerEvents = 'auto';
    
    // Adicionar classe se tooltip foi invertido (acima)
    if (position.shouldFlip) {
      tooltipEl.classList.add('tooltip-flipped');
    }
    
    // Tornar visível com animação
    tooltipEl.style.visibility = 'visible';
    tooltipEl.style.opacity = '1';
    
    // Se for pinned, adicionar listener para fechar ao clicar fora
    if (pinned) {
      const closeTooltip = (event) => {
        if (!tooltipEl.contains(event.target) && !element.contains(event.target)) {
          this._removeTooltipWithFade(tooltipEl, 200);
          document.removeEventListener('click', closeTooltip);
        }
      };
      
      // Pequeno delay para não fechar imediatamente com o mesmo click
      setTimeout(() => {
        document.addEventListener('click', closeTooltip);
      }, 100);
    }
  }

  /**
   * Mostra um tooltip rico com fórmulas de dados coloridas (hover apenas)
   * @param {HTMLElement} element - Elemento que disparou o tooltip
   * @param {Object} data - Dados das fórmulas (formulas array e rollType)
   */
  static async _showRichDiceFormulaTooltip(element, data) {
    if (!data || !data.formulas) {
      console.warn('[CARDIGAN] No dice formula data provided for rich tooltip');
      return;
    }
    
    // Preparar contexto para o template
    const context = {
      formulas: data.formulas.map(f => {
        return {
          formula: f.formula,
          isKept: f.isKept,
          rollType: data.rollType
        };
      })
    };
    
    // Renderizar template
    const template = await foundry.applications.handlebars.getTemplate('systems/cardigan/templates/tooltips/dice-formula-tooltip.hbs');
    const html = await template(context);
    
    // Criar elemento do tooltip
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'locked-tooltip dice-formula-tooltip cardigan-tooltip tooltip-centered';
    tooltipEl.innerHTML = html;
    
    // Adicionar ao body invisível para medir
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.opacity = '0';
    document.body.appendChild(tooltipEl);
    
    // Calcular posição
    const position = this._calculateTooltipPosition(element, tooltipEl);
    
    // Aplicar posição
    tooltipEl.style.left = `${position.left}px`;
    tooltipEl.style.top = `${position.top}px`;
    tooltipEl.style.zIndex = '10000';
    tooltipEl.style.pointerEvents = 'auto';
    
    // Adicionar classe se invertido
    if (position.shouldFlip) {
      tooltipEl.classList.add('tooltip-flipped');
    }
    
    // Tornar visível com animação (como outros tooltips)
    tooltipEl.style.visibility = 'visible';
    tooltipEl.style.opacity = '1';
  }
}
