/**
 * Dialog for selecting advantage/disadvantage type for attack rolls
 */
export class AdvantageSelectionDialog extends foundry.applications.api.DialogV2 {
  constructor(options = {}) {
    super(options);
  }

  static DEFAULT_OPTIONS = {
    tag: "dialog",
    window: {
      title: "Tipo de Rolagem",
      icon: "fas fa-dice-d20",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 400,
      height: "auto"
    },
    modal: true,
    classes: ["cardigan-advantage-dialog"]
  };

  static PARTS = {
    content: {
      template: "systems/cardigan/templates/dialogs/advantage-selection.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  /**
   * Show the advantage selection dialog
   * @param {Object} options - Dialog options
   * @returns {Promise<string>} Selected advantage type: 'normal', 'advantage', 'disadvantage'
   */
  static async show(options = {}) {
    return new Promise((resolve) => {
      const dialog = new this({
        ...options,
        buttons: [
          {
            action: "normal",
            label: "Normal",
            icon: "fas fa-dice-d20",
            callback: () => resolve("normal")
          },
          {
            action: "advantage", 
            label: "Vantagem",
            icon: "fas fa-arrow-up",
            callback: () => resolve("advantage")
          },
          {
            action: "disadvantage",
            label: "Desvantagem", 
            icon: "fas fa-arrow-down",
            callback: () => resolve("disadvantage")
          },
          {
            action: "cancel",
            label: "Cancelar",
            icon: "fas fa-times",
            callback: () => resolve(null)
          }
        ]
      });
      
      dialog.render(true);
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    context.content = `
      <div style="text-align: center; padding: 20px;">
        <p style="margin-bottom: 20px; font-size: 16px; font-weight: bold; color: #333;">
          Escolha o tipo de rolagem para o ataque:
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start; max-width: 300px; margin: 0 auto;">
          <div style="display: flex; align-items: center; gap: 12px; padding: 8px; width: 100%; background: rgba(0,0,0,0.05); border-radius: 4px;">
            <i class="fas fa-dice-d20" style="color: #666; width: 24px; text-align: center;"></i>
            <span><strong>Normal:</strong> Rola 1d20</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; padding: 8px; width: 100%; background: rgba(76,175,80,0.1); border-radius: 4px;">
            <i class="fas fa-arrow-up" style="color: #4caf50; width: 24px; text-align: center;"></i>
            <span><strong>Vantagem:</strong> Rola 2d20, usa o maior</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; padding: 8px; width: 100%; background: rgba(244,67,54,0.1); border-radius: 4px;">
            <i class="fas fa-arrow-down" style="color: #f44336; width: 24px; text-align: center;"></i>
            <span><strong>Desvantagem:</strong> Rola 2d20, usa o menor</span>
          </div>
        </div>
      </div>
    `;
    
    return context;
  }
}