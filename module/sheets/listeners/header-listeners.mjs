/**
 * Header Listeners Module
 * Manages all event listeners for the actor sheet header
 * Handles status checkboxes, dynamic fields (movement, critical hit), and related interactions
 */
export class HeaderListeners {
  
  /**
   * Initialize all header-related event listeners
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static initialize(element, actor) {
    this.addStatusListeners(element, actor);
    this.addCriticalHitListeners(element, actor);
    this.addMovementListeners(element, actor);
  }
  
  /**
   * Add event listeners for status checkboxes (hunger, thirst, sanity, toxicity, fracture, etc.)
   * @param {HTMLElement} html - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static addStatusListeners(html, actor) {
    // Setup hunger and thirst checkboxes (accumulative independent radios)
    const hungerCheckboxes = html.querySelectorAll('.radio-group[data-field="hunger"] input[type="checkbox"]');
    const thirstCheckboxes = html.querySelectorAll('.radio-group[data-field="thirst"] input[type="checkbox"]');
    
    this.setupIndependentRadios(hungerCheckboxes, 'hunger', actor);
    this.setupIndependentRadios(thirstCheckboxes, 'thirst', actor);

    // Add listeners for sequential groups (giftOfLife, deathSentence, sanity, toxicity, fracture)
    html.querySelectorAll('.sequential-group').forEach(group => {
      const field = group.dataset.field;
      const checkboxes = group.querySelectorAll('input[type="checkbox"]');
      
      checkboxes.forEach(checkbox => {
        // Remove previous listener if exists
        if (checkbox._sequentialHandler) {
          checkbox.removeEventListener('change', checkbox._sequentialHandler);
        }
        
        // Create and store the handler
        checkbox._sequentialHandler = async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          
          const level = parseInt(ev.target.dataset.level);
          const currentValue = actor.system.status?.[field] ?? null;
          let newValue = null;
          let message = "";
          
          if (ev.target.checked) {
            // Check: set value as the checkbox level
            newValue = level;
            
            // Generate message based on field and level
            if (field === 'sanity') {
              const messages = {
                1: "Ansioso, você está estressado, tenso e desconfiado.",
                2: "Paranoico, você está desesperado, neurótico e pessimista.",
                3: "Violento, você inconsequente, você está hostil e insensível.",
                4: "Vilanesco, você está completamente insano, todos são inimigos e odiáveis.",
                5: "Perdido, o narrador assume seu personagem para guiá-lo à auto-destruição."
              };
              message = `${actor.name}: ${messages[level]}`;
            } else if (field === 'toxicity') {
              const messages = {
                1: "Levemente intoxicado, você sente náusea e tontura.",
                2: "Intoxicação moderada, você está enjoado e com visão turva.",
                3: "Severamente intoxicado, você está vomitando e com dores intensas.",
                4: "Intoxicação crítica, você está delirando e perdendo consciência.",
                5: "Envenenamento fatal, você está à beira da morte por toxinas."
              };
              message = `${actor.name}: ${messages[level]}`;
            }
          } else {
            // Uncheck: set as previous level (level - 1) or null if 1
            newValue = level > 1 ? level - 1 : null;
            
            if (field === 'sanity' && newValue === null) {
              message = `${actor.name}: Estado mental estabilizado.`;
            } else if (field === 'toxicity' && newValue === null) {
              message = `${actor.name}: Toxinas eliminadas do organismo.`;
            } else if (field === 'fracture' && newValue === null) {
              message = `${actor.name}: Fraturas completamente curadas.`;
            }
          }
          
          // Update actor value
          try {
            await actor.update({
              [`system.status.${field}`]: newValue
            });
            
            // Show info notification when fracture is reset
            if (field === 'fracture' && newValue === null) {
              ui.notifications.info("Fratura zerada.");
            }
          } catch (error) {
            console.error(`Error updating ${field}:`, error);
            if (field === 'fracture') {
              ui.notifications.error(`Erro ao zerar Fratura: ${error.message}`);
            }
            return;
          }
          
          // Send message to chat if there is one
          if (message) {
            ChatMessage.create({ 
              content: message,
              speaker: ChatMessage.getSpeaker({ actor: actor })
            });
          }
        };
        
        // Add the listener
        checkbox.addEventListener('change', checkbox._sequentialHandler);
      });
    });
  }
  
  /**
   * Setup independent radio checkboxes (for hunger and thirst)
   * @param {NodeList} checkboxes - The checkbox elements
   * @param {string} field - The field name ('hunger' or 'thirst')
   * @param {Actor} actor - The actor document
   */
  static setupIndependentRadios(checkboxes, field, actor) {
    checkboxes.forEach(checkbox => {
      let wasChecked = false;
      
      // Capture state on mousedown
      checkbox.addEventListener('mousedown', () => {
        wasChecked = checkbox.checked;
      });
      
      // Process click
      checkbox.addEventListener('click', async (ev) => {
        ev.preventDefault();
        
        const clickedLevel = parseInt(checkbox.dataset.level);
        let newValue = 0;
        
        if (wasChecked) {
          // If was checked, uncheck all (back to 0)
          checkboxes.forEach(r => r.checked = false);
          newValue = 0;
        } else {
          // If wasn't checked, check this and all previous (accumulative)
          checkboxes.forEach(r => {
            const rLevel = parseInt(r.dataset.level);
            r.checked = rLevel <= clickedLevel;
          });
          newValue = clickedLevel;
        }
        
        // Update document
        await actor.update({
          [`system.status.${field}`]: newValue
        });
        
        // Generate message for chat
        this.sendFieldMessage(field, newValue, actor);
        
        // Exhaustion effect will be managed automatically by ExaustaoEffect
      });
    });
  }
  
  /**
   * Send message to chat based on field value
   * @param {string} field - The field name
   * @param {number} value - The new value
   * @param {Actor} actor - The actor document
   */
  static sendFieldMessage(field, value, actor) {
    let message = "";
    
    if (field === 'hunger') {
      if (value === 0) {
        message = `${actor.name} não está mais com fome.`;
      } else if (value === 1) {
        message = `${actor.name} está com 1 de Fome.`;
      } else if (value === 2) {
        message = `${actor.name} está com 2 de Fome.`;
      } else if (value === 3) {
        message = `${actor.name} está com fome! [3 de Fome]`;
      }
    } else if (field === 'thirst') {
      if (value === 0) {
        message = `${actor.name} não está mais com sede.`;
      } else if (value === 1) {
        message = `${actor.name} está com 1 de Sede.`;
      } else if (value === 2) {
        message = `${actor.name} está com 2 de Sede.`;
      } else if (value === 3) {
        message = `${actor.name} está com sede! [3 de Sede]`;
      }
    }
    
    if (message) {
      ChatMessage.create({ 
        content: message,
        speaker: ChatMessage.getSpeaker({ actor: actor })
      });
    }
  }
  
  /**
   * Add event listeners for critical hit dynamic field
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static addCriticalHitListeners(element, actor) {
    const criticalHitField = element.querySelector('input[name="system.details.criticalHit"]');
    
    if (criticalHitField) {
      // Event listener for focus (show manual value)
      criticalHitField.addEventListener('focus', (event) => {
        this.handleCriticalHitFocus(event, actor);
      });
      
      // Event listener for blur (calculate and show total)
      criticalHitField.addEventListener('blur', (event) => {
        this.handleCriticalHitBlur(event, actor);
      });
      
      console.log('[CARDIGAN] Critical Hit dynamic field listener added');
    }
  }

  /**
   * Sum critical hit improvements currently granted by consumable tracking effects.
   * @param {Actor} actor - The actor document
   * @returns {number}
   */
  static getActiveConsumableCriticalHitBonus(actor) {
    return actor.items.reduce((total, item) => {
      if (item.type !== 'efeito') return total;

      const tracking = item.system?.consumableTracking;
      if (!tracking?.isTrackingEffect) return total;

      const criticalBonus = (tracking.appliedAttributeModifiers || []).reduce((acc, modifier) => {
        if (modifier?.type !== 'criticalHit') return acc;
        const amount = Number(modifier.amount) || 0;
        return acc + amount;
      }, 0);

      return total + criticalBonus;
    }, 0);
  }
  
  /**
   * Handler for when user clicks critical hit field (focus)
   * @param {Event} event - The focus event
   * @param {Actor} actor - The actor document
   */
  static handleCriticalHitFocus(event, actor) {
    const field = event.target;
    const system = actor.system;

    // criticalHitManual stores editable manual value plus active consumable improvements.
    // For editing, show only the editable manual portion.
    const criticalHitManual = Number(system.details.criticalHitManual || 0);
    const consumableBonus = this.getActiveConsumableCriticalHitBonus(actor);
    const editableManual = criticalHitManual + consumableBonus;

    field.value = editableManual === 0 ? '' : editableManual;
    field.dataset.manualValue = editableManual;
    field.dataset.consumableBonus = consumableBonus;

    console.log(`[CRITICAL HIT FOCUS] Editable Manual: ${editableManual}, Consumable Bonus: ${consumableBonus}, Stored Manual: ${criticalHitManual}`);
    field.select();
  }
  
  /**
   * Handler for when user leaves critical hit field (blur)
   * @param {Event} event - The blur event
   * @param {Actor} actor - The actor document
   */
  static handleCriticalHitBlur(event, actor) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const system = actor.system;
    const consumableBonus = Number(field.dataset.consumableBonus) || this.getActiveConsumableCriticalHitBonus(actor);
    
    // Calculate automatic value based on Dexterity
    const dexterity = system.abilities.dexterity.value || 0;
    const dexterityTotalBonus = system.abilities.dexterity.totalBonus || 0;
    const totalDexterity = dexterity + dexterityTotalBonus;
    const dexterityCriticalEffect = Math.floor(totalDexterity / 3);
    const autoValue = Math.max(1, 20 - dexterityCriticalEffect);
    
    // Persist criticalHitManual with editable manual value minus active consumable bonus.
    const criticalHitManual = userInput - consumableBonus;

    // Total value is automatic + effective manual critical value
    const totalValue = autoValue + criticalHitManual;
    
    // Show total value in field
    field.value = totalValue;
    field.dataset.manualValue = userInput;
    
    // Save manual and total values
    actor.update({
      'system.details.criticalHitManual': criticalHitManual,
      'system.details.criticalHit': totalValue
    }).catch(error => {
      console.error('[CARDIGAN] Erro ao atualizar criticalHit:', error);
    });
    
    console.log(`[CRITICAL HIT BLUR] Editable Manual: ${userInput}, Consumable Bonus: ${consumableBonus}, Stored Manual: ${criticalHitManual}, Auto: ${autoValue}, Total: ${totalValue}`);
  }
  
  /**
   * Add event listeners for movement dynamic field
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static addMovementListeners(element, actor) {
    const movementField = element.querySelector('input[name="system.details.movement"]');
    
    if (movementField) {
      // Event listener for focus (show manual value)
      movementField.addEventListener('focus', (event) => {
        this.handleMovementFocus(event, actor);
      });
      
      // Event listener for blur (calculate and show total)
      movementField.addEventListener('blur', (event) => {
        this.handleMovementBlur(event, actor);
      });
      
      console.log('[CARDIGAN] Movement dynamic field listener added');
    }
  }

  /**
   * Sum movement bonuses currently granted by consumable tracking effects.
   * @param {Actor} actor - The actor document
   * @returns {number}
   */
  static getActiveConsumableMovementBonus(actor) {
    return actor.items.reduce((total, item) => {
      if (item.type !== 'efeito') return total;

      const tracking = item.system?.consumableTracking;
      if (!tracking?.isTrackingEffect) return total;

      const movementBonus = (tracking.appliedAttributeModifiers || []).reduce((acc, modifier) => {
        if (modifier?.type !== 'movement') return acc;
        const amount = Number(modifier.amount) || 0;
        return acc + amount;
      }, 0);

      return total + movementBonus;
    }, 0);
  }
  
  /**
   * Handler for when user clicks movement field (focus)
   * @param {Event} event - The focus event
   * @param {Actor} actor - The actor document
   */
  static handleMovementFocus(event, actor) {
    const field = event.target;
    const system = actor.system;

    // movementManual stores both editable manual value and active consumable bonuses.
    // In focus mode, show only the editable manual portion.
    const movementManual = Number(system.details.movementManual || 0);
    const consumableBonus = this.getActiveConsumableMovementBonus(actor);
    const editableManual = movementManual - consumableBonus;

    field.value = editableManual === 0 ? '' : editableManual;
    field.dataset.manualValue = editableManual;
    field.dataset.consumableBonus = consumableBonus;

    console.log(`[MOVEMENT FOCUS] Editable Manual: ${editableManual}, Consumable Bonus: ${consumableBonus}, Stored Manual: ${movementManual}`);
    field.select();
  }
  
  /**
   * Handler for when user leaves movement field (blur)
   * @param {Event} event - The blur event
   * @param {Actor} actor - The actor document
   */
  static handleMovementBlur(event, actor) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const system = actor.system;
    const consumableBonus = Number(field.dataset.consumableBonus) || this.getActiveConsumableMovementBonus(actor);
    
    // Calculate automatic value based on Dexterity
    const dexterity = system.abilities.dexterity.value || 0;
    const dexterityTotalBonus = system.abilities.dexterity.totalBonus || 0;
    const totalDexterity = dexterity + dexterityTotalBonus;
    const dexterityMovement = Math.floor(totalDexterity / 2);
    
    // Calculate armor and race movement bonuses
    const armorMovementBonus = actor._armorMovementBonus || 0;
    const raceMovementBonus = actor._raceMovementBonus || 0;
    
    // Automatic value is Dexterity + Armors + Race
    const autoValue = dexterityMovement + armorMovementBonus + raceMovementBonus;
    
    // Persist movementManual with editable manual value + active consumable bonus.
    const movementManual = userInput + consumableBonus;

    // Total value is automatic + effective manual movement
    const totalValue = autoValue + movementManual;
    
    // Show total value in field
    field.value = totalValue;
    field.dataset.manualValue = userInput;
    
    // Save manual and total values
    actor.update({
      'system.details.movementManual': movementManual,
      'system.details.movement': totalValue
    }).catch(error => {
      console.error('[CARDIGAN] Erro ao atualizar movement:', error);
    });
    
    console.log(`[MOVEMENT BLUR] Editable Manual: ${userInput}, Consumable Bonus: ${consumableBonus}, Stored Manual: ${movementManual}, Auto: ${autoValue} (Dex: ${dexterityMovement} + Armor: ${armorMovementBonus} + Race: ${raceMovementBonus}), Total: ${totalValue}`);
  }
}
