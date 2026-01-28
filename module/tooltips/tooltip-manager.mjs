/**
 * Gerenciador de tooltips customizado para o sistema Cardigan
 * Intercepta e estiliza tooltips do Foundry VTT
 */
export default class CardiganTooltipManager {
  
  /**
   * Inicializa o gerenciador de tooltips
   * Adiciona interceptação para tooltips do Cardigan
   */
  static initialize() {
    // Hook para customizar tooltips antes de renderizar
    Hooks.on('renderTooltip', (tooltip, element) => {
      // Adicionar classe customizada para tooltips do Cardigan
      if (element.dataset.tooltip?.startsWith('CARDIGAN.')) {
        tooltip.classList.add('cardigan-tooltip');
      }
      
      // Detectar tooltips de itens via UUID
      if (element.dataset.tooltip?.startsWith('#item#')) {
        tooltip.classList.add('cardigan-tooltip', 'item-tooltip');
      }
    });
    
    console.log('[CARDIGAN] Tooltip manager initialized');
  }
  
  /**
   * Ativa um tooltip manualmente para um elemento
   * @param {HTMLElement} element - Elemento que terá o tooltip
   * @param {string} text - Texto ou chave de localização
   * @param {object} options - Opções adicionais
   */
  static activateTooltip(element, text, options = {}) {
    const tooltipText = game.i18n.localize(text);
    game.tooltip.activate(element, {
      text: tooltipText,
      cssClass: options.cssClass || 'cardigan-tooltip',
      ...options
    });
  }
}
