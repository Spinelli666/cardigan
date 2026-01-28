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
    existingTooltips.forEach(tooltip => tooltip.remove());
    
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
    
    // Calcular posição baseada no elemento que disparou
    const rect = element.getBoundingClientRect();
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
    tooltipEl.style.top = `${rect.bottom + 8}px`;
    tooltipEl.style.zIndex = '10000';
    tooltipEl.style.pointerEvents = 'auto';
    tooltipEl.style.opacity = '1';
    tooltipEl.style.visibility = 'visible';
    
    // Adicionar classe para centralizar horizontalmente (via CSS)
    tooltipEl.classList.add('tooltip-centered');
    
    // Adicionar ao body
    document.body.appendChild(tooltipEl);
    
    // Adicionar listener para fechar ao clicar fora
    const closeTooltip = (event) => {
      if (!tooltipEl.contains(event.target) && !element.contains(event.target)) {
        tooltipEl.remove();
        document.removeEventListener('click', closeTooltip);
      }
    };
    
    // Pequeno delay para não fechar imediatamente com o mesmo click
    setTimeout(() => {
      document.addEventListener('click', closeTooltip);
    }, 100);
  }
}
