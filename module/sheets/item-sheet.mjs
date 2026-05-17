import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import SkillEnhancementConfigDialog from '../applications/skill-enhancement-config-dialog.mjs';
import SkillLinkedSkillsDialog from '../applications/skill-linked-skills-dialog.mjs';
import RacialSkillsSelectionDialog from '../applications/racial-skills-selection-dialog.mjs';
import { ArmorItemListeners } from './listeners/armor-item-listeners.mjs';
import { ArmorContext } from './parts/armor-context.mjs';
import { ArmorSheetBehavior } from './parts/armor-sheet-behavior.mjs';

const { api, sheets } = foundry.applications;

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheetV2}
 */
export class CardiganSystemItemSheet extends api.HandlebarsApplicationMixin(
  sheets.ItemSheetV2
) {
  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  /** @override */
  async render(options = {}, _options = {}) {
    // For recipe items, clean up empty resultItems before rendering
    if (this.item?.type === 'item-recipe') {
      const currentResultItems = this.item.system?.resultItems;
      
      if (currentResultItems && currentResultItems.length > 0) {
        const hasEmptyItems = currentResultItems.some(item => !item || !item.name || item.name.trim() === '');
        
        if (hasEmptyItems) {
          const filtered = currentResultItems.filter(item => item && item.name && item.name.trim() !== '');
          
          // Update the item to remove empty entries
          await this.item.update({
            'system.resultItems': filtered
          }, { render: false }); // Don't trigger another render
        }
      }
    }
    
    const result = await super.render(options, _options);
    return result;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['cardigan', 'item'],
    position: {
      width: 520,
      height: 480,
    },
    window: {
      resizable: true,
      minimizable: true,
    },
    actions: {
      onEditImage: this._onEditImage,
      viewDoc: this._viewEffect,
      createDoc: this._createEffect,
      deleteDoc: this._deleteEffect,
      toggleEffect: this._toggleEffect,
      addWeaponProperty: this._addWeaponProperty,
      removeWeaponProperty: this._removeWeaponProperty,
      addSkillActionType: this._addSkillActionType,
      removeSkillActionType: this._removeSkillActionType,
      addSpellCategory: this._addSpellCategory,
      removeSpellCategory: this._removeSpellCategory,
      addSkillBonus: this._addSkillBonus,
      removeSkillBonus: this._removeSkillBonus,
      'add-skill-effect': this._addSkillEffect,
      'remove-skill-effect': this._removeSkillEffect,
      addEffect: this._addEffect,
      removeEffect: this._removeEffect,
      'use-item': this._useConsumableItem,
      addIngredient: this._addIngredient,
      removeIngredient: this._removeIngredient,
      changeIngredientImage: this._changeIngredientImage,
      ingredientNameChange: this._onIngredientNameChange,
      addIngredientToResult: this._addIngredientToResult,
      removeResultIngredient: this._removeResultIngredient,
      changeResultIngredientImage: this._changeResultIngredientImage,
      removeResultItem: this._removeResultItem,
      configureSkillEffects: this._configureSkillEffects,
      configureLinkedSkills: this._configureLinkedSkills,
      selectRacialSkills: this._selectRacialSkills,
      removeRacialSkill: this._removeRacialSkill,
      configureEnhancement1: this._configureEnhancement1,
      configureEnhancement2: this._configureEnhancement2,
      configureEnhancement3: this._configureEnhancement3,
      configureCriticalFailureEffects: this._configureCriticalFailureEffects,
      configureCriticalHitEffects: this._configureCriticalHitEffects,
      addCriticalFailureEffect: this._addCriticalFailureEffect,
      removeCriticalFailureEffect: this._removeCriticalFailureEffect,
      addCriticalFailureSkillLoss: this._addCriticalFailureSkillLoss,
      removeCriticalFailureSkillLoss: this._removeCriticalFailureSkillLoss,
      addCriticalHitEffect: this._addCriticalHitEffect,
      removeCriticalHitEffect: this._removeCriticalHitEffect,
      addCriticalHitSkillBonus: this._addCriticalHitSkillBonus,
      removeCriticalHitSkillBonus: this._removeCriticalHitSkillBonus,
      addTemporarySkillBonus: this._addTemporarySkillBonus,
      removeTemporarySkillBonus: this._removeTemporarySkillBonus,
    },
    form: {
      submitOnChange: true,
    },
    // Custom property that's merged into `this.options`
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: '[data-drop-zone]' }],
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    header: { template: 'systems/cardigan/templates/item/header.hbs' },
    tabs: { template: 'templates/generic/tab-navigation.hbs' },
    description: { template: 'systems/cardigan/templates/item/description.hbs' },
    attributesItemComum: {
      template: 'systems/cardigan/templates/item/attribute-parts/item-comum.hbs',
    },
    attributesItemMunicao: {
      template: 'systems/cardigan/templates/item/attribute-parts/item-municao.hbs',
    },
    attributesItemConsumivel: {
      template: 'systems/cardigan/templates/item/attribute-parts/item-consumivel.hbs',
    },
    modifiersItemConsumivel: {
      template: 'systems/cardigan/templates/item/attribute-parts/item-consumivel-modifiers.hbs',
    },
    attributesEfeito: {
      template: 'systems/cardigan/templates/item/attribute-parts/efeito.hbs',
    },
    attributesArma: {
      template: 'systems/cardigan/templates/item/attribute-parts/arma.hbs',
    },
    attributesArmadura: {
      template: 'systems/cardigan/templates/item/attribute-parts/armor.hbs',
    },
    attributesSkill: {
      template: 'systems/cardigan/templates/item/attribute-parts/skill.hbs',
    },
    enhancementsSkill: {
      template: 'systems/cardigan/templates/item/attribute-parts/skill-enhancements.hbs',
    },
    attributesRace: {
      template: 'systems/cardigan/templates/item/attribute-parts/race.hbs',
    },
    attributesItemRecipe: {
      template: 'systems/cardigan/templates/item/attribute-parts/item-recipe.hbs',
    },
    ingredientsItemRecipe: {
      template: 'systems/cardigan/templates/item/attribute-parts/ingredients-item-recipe.hbs',
    },
    attributesItemIngredient: {
      template: 'systems/cardigan/templates/item/attribute-parts/item-ingredient.hbs',
    },
    effects: {
      template: 'systems/cardigan/templates/item/effects.hbs',
    },
  };

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs', 'description'];
    if (ArmorSheetBehavior.configureRenderOptions(this, options)) return;
    // Don't show the other tabs if only limited view
    if (this.document.limited) return;
    // Control which parts show based on document subtype
    switch (this.document.type) {
      case 'backpack':
        // Tipo backpack foi removido - não deve mais chegar aqui
        break;
      case 'item-comum':
        options.parts.push('attributesItemComum');
        break;
      case 'item-municao':
        options.parts.push('attributesItemMunicao');
        break;
      case 'item-consumivel':
        options.parts.push('attributesItemConsumivel', 'modifiersItemConsumivel');
        break;
      case 'item-ingredient':
        options.parts.push('attributesItemIngredient');
        break;
      case 'efeito':
        // Efeitos têm descrição e podem ter atributos básicos se necessário
        options.parts.push('attributesEfeito');
        break;
      case 'arma':
        options.parts.push('attributesArma');
        break;
      case 'armadura':
        options.parts.push('attributesArmadura');
        break;
      case 'skill':
        options.parts.push('attributesSkill', 'enhancementsSkill');
        break;
      case 'race':
        options.parts.push('attributesRace');
        break;
      case 'item-recipe':
        options.parts.push('attributesItemRecipe', 'ingredientsItemRecipe');
        break;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = {
      // Validates both permissions and compendium status
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      // Add the item document.
      item: this.item,
      // Adding system and flags for easier access
      system: this.item.system,
      flags: this.item.flags,
      // Adding a pointer to CONFIG.CARDIGAN
      config: CONFIG.CARDIGAN,
      // You can factor out context construction to helper functions
      tabs: this._getTabs(options.parts),
      // Necessary for formInput and formFields helpers
      fields: this.document.schema.fields,
      systemFields: this.document.system.schema.fields,
    };

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'attributesArmadura': {
        // Necessary for preserving active tab on re-render
        context.tab = context.tabs[partId];

        ArmorContext.prepareAttributesData(context, this.item);
        break;
      }
      case 'attributesItemComum':
      case 'attributesItemMunicao':
      case 'attributesItemConsumivel':
      case 'attributesEfeito':
      case 'attributesArma':
      case 'attributesSkill':
      case 'attributesItemRecipe':
      case 'attributesItemIngredient':
      case 'attributesRace':
        // Necessary for preserving active tab on re-render
        context.tab = context.tabs[partId];
        break;
      case 'enhancementsSkill':
        // Necessary for preserving active tab on re-render
        context.tab = context.tabs[partId];
        
        // Enrich enhancement descriptions for display
        if (this.item.system.enhancements) {
          context.enrichedEnhancements = [];
          for (let i = 0; i < this.item.system.enhancements.length; i++) {
            const enhancement = this.item.system.enhancements[i];
            context.enrichedEnhancements[i] = {
              name: enhancement.name,
              description: await foundry.applications.ux.TextEditor.enrichHTML(
                enhancement.description,
                {
                  secrets: this.document.isOwner,
                  rollData: this.document.getRollData(),
                  relativeTo: this.document,
                }
              )
            };
          }
        }
        break;

      case 'ingredientsItemRecipe':
        // Necessary for preserving active tab on re-render
        context.tab = context.tabs[partId];
        // Add ingredients list for the recipe
        context.ingredients = this.item.system.requiredIngredients || [];
        break;
      case 'modifiersItemConsumivel':
        // Necessary for preserving active tab on re-render
        context.tab = context.tabs[partId];
        // Load available effects from compendium for dropdowns
        context.availableEffects = await this._loadAvailableEffects();
        break;
      case 'description':
        context.tab = context.tabs[partId];
        // Enrich description info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(
          this.item.system.description,
          {
            // Whether to show secret blocks in the finished html
            secrets: this.document.isOwner,
            // Data to fill in for inline rolls
            rollData: this.item.getRollData(),
            // Relative UUID resolution
            relativeTo: this.item,
          }
        );
        break;
      case 'effects':
        context.tab = context.tabs[partId];
        // Prepare active effects for easier access
        context.effects = prepareActiveEffectCategories(this.item.effects);
        break;
    }
    return context;
  }

  /**
   * Process form data BEFORE validation and submission
   * This is called BEFORE _prepareSubmitData and validation
   * @override
   */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    const fallbackImg = 'systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg';
    const currentItemImg = typeof this.item.img === 'string' ? this.item.img.trim() : '';
    const hasValidExtension = (value) => /\.(webp|png|jpe?g|gif|svg|avif|webm)(?:[?#].*)?$/i.test(value);
    const isDataImage = (value) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
    const isValidImagePath = (value) => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      return hasValidExtension(trimmed) || isDataImage(trimmed);
    };

    // Preserve custom/valid images. Only normalize when the path is truly invalid.
    const submittedHasImg = Object.prototype.hasOwnProperty.call(submitData, 'img');
    if (submittedHasImg) {
      const submittedImg = typeof submitData.img === 'string' ? submitData.img.trim() : '';
      if (isValidImagePath(submittedImg)) {
        submitData.img = submittedImg;
      } else if (isValidImagePath(currentItemImg)) {
        submitData.img = currentItemImg;
      } else {
        submitData.img = fallbackImg;
      }
    } else if (!isValidImagePath(currentItemImg)) {
      // No image field in this submit (e.g. editing durability), but current item image is
      // invalid for validation. Provide fallback only in this case.
      submitData.img = fallbackImg;
    }
    
    // CRITICAL FIX: For recipe items, prevent empty resultItems from causing validation errors
    if (this.item.type === 'item-recipe') {
      // Check if we're updating resultItems
      if ('system.resultItems' in submitData) {
        const resultItems = submitData['system.resultItems'];
        
        if (resultItems && Array.isArray(resultItems)) {
          submitData['system.resultItems'] = resultItems.filter(item => {
            return item && item.name && item.name.trim() !== '';
          });
        }
      }
    }
    
    return submitData;
  }

  /**
   * Override form change handler to prevent validation errors with ingredient updates
   * @override
   */
  async _onChangeForm(formConfig, event) {
    const armorDurabilityHandled = await ArmorSheetBehavior.handleDurabilityChange(this, event);
    if (armorDurabilityHandled) return;

    // CRITICAL: Clean up empty resultItems BEFORE calling super (which validates)
    if (this.item.type === 'item-recipe') {
      const currentResultItems = this.item.system?.resultItems;
      
      if (currentResultItems && currentResultItems.length > 0) {
        // Check each item more carefully
        const emptyItems = currentResultItems.filter(item => {
          return !item || !item.name || item.name.trim() === '';
        });
        
        if (emptyItems.length > 0) {
          const filtered = currentResultItems.filter(item => item && item.name && item.name.trim() !== '');
          
          // SYNCHRONOUSLY update to ensure clean data before parent validation
          await this.item.update({
            'system.resultItems': filtered
          }, { render: false });
          
          // IMPORTANT: Return early to prevent validation on this change
          // The update above will trigger another _onChangeForm call with clean data
          return;
        }
      }
      
      const target = event.target;
      const name = target?.name;
      
      // If this is an ingredient field update
      if (name && name.includes('requiredIngredients')) {
        // Extract the path parts - handle both "resultItems.0." and "resultItems.." (empty index)
        const match = name.match(/system\.resultItems\.(\d*)\.requiredIngredients\.(\d+)\.(\w+)/);
        
        if (match) {
          const [, resultIndexStr, ingredientIndex, field] = match;
          
          // If resultIndex is empty string, default to 0
          const resultIndex = resultIndexStr === '' ? 0 : parseInt(resultIndexStr);
          
          console.log('[ITEM-SHEET] Parsed - resultIndex:', resultIndex, 'ingredientIndex:', ingredientIndex, 'field:', field);
          
          // Build update object manually to avoid partial resultItem validation
          const currentResultItems = foundry.utils.deepClone(this.item.system.resultItems);
          
          if (currentResultItems[resultIndex]) {
            const resultItem = currentResultItems[resultIndex];
            
            // Ensure requiredIngredients array exists
            if (!resultItem.requiredIngredients) {
              resultItem.requiredIngredients = [];
            }
            
            // Ensure ingredient object exists
            if (!resultItem.requiredIngredients[parseInt(ingredientIndex)]) {
              resultItem.requiredIngredients[parseInt(ingredientIndex)] = {
                name: "Novo Ingrediente",
                quantity: 1,
                img: "systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg"
              };
            }
            
            // Update the specific field
            if (field === 'quantity') {
              resultItem.requiredIngredients[parseInt(ingredientIndex)][field] = parseInt(target.value) || 1;
            } else {
              resultItem.requiredIngredients[parseInt(ingredientIndex)][field] = target.value;
            }
            
            // If name was changed, try to auto-update image from matching item
            if (field === 'name') {
              const newName = target.value;
              
              // Priority: 1) Actor inventories, 2) World items, 3) Compendiums
              const foundImage = CardiganSystemItemSheet._findIngredientImage(newName);
              
              if (foundImage) {
                resultItem.requiredIngredients[parseInt(ingredientIndex)].img = foundImage;
              }
            }
            
            // Update the item with the complete resultItems array
            await this.item.update({
              'system.resultItems': currentResultItems
            });
            
            // Prevent default form submission
            return;
          }
        }
      }
    }
    
    // Call parent for all other cases
    return super._onChangeForm(formConfig, event);
  }

  /**
   * Generates the data for the generic tab navigation template
   * @param {string[]} parts An array of named template parts to render
   * @returns {Record<string, Partial<ApplicationTab>>}
   * @protected
   */
  _getTabs(parts) {
    // If you have sub-tabs this is necessary to change
    const tabGroup = 'primary';
    // Default tab for first time it's rendered this session
    if (!this.tabGroups[tabGroup]) {
      this.tabGroups[tabGroup] = ArmorSheetBehavior.resolveDefaultPrimaryTab(this);
    }
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        // Matches tab property to
        id: '',
        // FontAwesome Icon, if you so choose
        icon: '',
        // Run through localization
        label: 'CARDIGAN.Item.Tabs.',
      };

      if (ArmorSheetBehavior.applyTabMetadata(partId, tab)) {
        if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
        tabs[partId] = tab;
        return tabs;
      }

      switch (partId) {
        case 'header':
        case 'tabs':
          return tabs;
        case 'description':
          tab.id = 'description';
          tab.label += 'Description';
          break;
        case 'attributesItemComum':
        case 'attributesItemMunicao':
        case 'attributesItemConsumivel':
        case 'attributesEfeito':
        case 'attributesArma':
        case 'attributesSkill':
        case 'attributesItemRecipe':
        case 'attributesItemIngredient':
        case 'attributesRace':
          tab.id = 'attributes';
          tab.label += 'Details';
          break;
        case 'enhancementsSkill':
          tab.id = 'enhancements';
          tab.label += 'Enhancements';
          break;
        case 'ingredientsItemRecipe':
          tab.id = 'ingredients';
          tab.label += 'Ingredients';
          break;
        case 'modifiersItemConsumivel':
          tab.id = 'modifiers';
          tab.label += 'Modifiers';
          break;
        case 'effects':
          tab.id = 'effects';
          tab.label += 'Effects';
          break;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  // NOTE: First _onRender() definition removed - ALL post-render operations consolidated at line ~3080
  
  /**
   * Setup automatic image resizing in description prose-mirror editor
   * REMOVIDO - Deixando ProseMirror funcionar com comportamento padrão
   * @protected
   */
  _setupDescriptionImageResize() {
    // Código removido para deixar o ProseMirror funcionar naturalmente
    // sem nenhuma customização de tamanho ou comportamento de imagens
  }

  /**
   * Cleanup when closing the sheet
   * @override
   */
  _onClose(options) {
    // Cleanup description image observer
    if (this._descriptionImageObserver) {
      this._descriptionImageObserver.disconnect();
      this._descriptionImageObserver = null;
    }
    return super._onClose?.(options);
  }

  /**
   * Setup ingredient listeners manually (fallback for ApplicationV2 issues)
   * @protected
   */
  _setupIngredientListeners() {
    
    // Find add ingredient button
    const addButton = this.element.querySelector('[data-action="addIngredient"]');
    if (addButton) {
      addButton.addEventListener('click', (event) => {
        this._addIngredient(event, event.currentTarget);
      });
    } else {
    }
    
    // Find remove ingredient buttons  
    const removeButtons = this.element.querySelectorAll('[data-action="removeIngredient"]');
    removeButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        this._removeIngredient(event, event.currentTarget);
      });
    });
    
    // Find change image buttons
    const imageButtons = this.element.querySelectorAll('[data-action="changeIngredientImage"]');
    imageButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        this._changeIngredientImage(event, event.currentTarget);
      });
    });
    
    // Find ingredient name inputs
    const nameInputs = this.element.querySelectorAll('[data-action="ingredientNameChange"]');
    nameInputs.forEach(input => {
      input.addEventListener('change', (event) => {
        this._onIngredientNameChange(event, event.currentTarget);
      });
    });
  }

  /**
   * Setup mutually exclusive checkboxes for damage ability selection
   * @private
   */
  _setupMutuallyExclusiveCheckboxes() {
    const strengthCheckbox = this.element.querySelector('input[name="system.damage.useStrength"]');
    const dexterityCheckbox = this.element.querySelector('input[name="system.damage.useDexterity"]');

    if (strengthCheckbox && dexterityCheckbox) {
      strengthCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
          dexterityCheckbox.checked = false;
          // Trigger change event to update the data
          dexterityCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      dexterityCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
          strengthCheckbox.checked = false;
          // Trigger change event to update the data
          strengthCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
  }

  /**
   * Setup conditional visibility for weapon ammunition
   * @private
   */
  _setupConditionalAmmunition() {
    const rangedCheckbox = this.element.querySelector('input[name="system.ranged"]');
    const isFirearmCheckbox = this.element.querySelector('input[name="system.isFirearm"]');
    const firearmSection = this.element.querySelector('.firearm-section');
    const ammunitionSection = this.element.querySelector('.ammunition-section');

    if (!rangedCheckbox || !isFirearmCheckbox || !firearmSection || !ammunitionSection) return;

    // Function to update visibility based on checkboxes
    const updateVisibility = () => {
      const isRanged = rangedCheckbox.checked;
      const isFirearm = isFirearmCheckbox.checked;

      // Show/hide firearm and ammunition sections based on ranged status
      firearmSection.style.display = isRanged ? 'block' : 'none';
      ammunitionSection.style.display = isRanged ? 'block' : 'none';

      // Re-render ammunition fields based on firearm status
      if (isRanged) {
        this._updateAmmunitionFields(isFirearm);
      }
    };

    // Set up event listeners
    rangedCheckbox.addEventListener('change', updateVisibility);
    isFirearmCheckbox.addEventListener('change', updateVisibility);

    // Initial setup
    updateVisibility();
  }

  /**
   * Update ammunition fields based on firearm status
   * @private
   */
  _updateAmmunitionFields(isFirearm) {
    const ammunitionSection = this.element.querySelector('.ammunition-section');
    if (!ammunitionSection) return;

    const label = ammunitionSection.querySelector('label');
    const currentInput = ammunitionSection.querySelector('input[name="system.ammunition.current"]');
    
    // Remove existing container content
    const existingContainer = ammunitionSection.querySelector('.ammunition-container, input[name="system.ammunition.current"]:not([type="hidden"])');
    if (existingContainer) {
      existingContainer.remove();
    }

    if (isFirearm) {
      // Create firearm ammunition display (current/max)
      const container = document.createElement('div');
      container.className = 'ammunition-container';
      container.style.cssText = 'display: flex; align-items: center; gap: 5px;';
      
      const currentField = document.createElement('input');
      currentField.type = 'number';
      currentField.name = 'system.ammunition.current';
      currentField.value = this.document.system.ammunition.current;
      currentField.min = '0';
      currentField.max = this.document.system.ammunition.max;
      currentField.style.width = '60px';
      
      const separator = document.createElement('span');
      separator.textContent = '/';
      
      const maxField = document.createElement('input');
      maxField.type = 'number';
      maxField.name = 'system.ammunition.max';
      maxField.value = this.document.system.ammunition.max;
      maxField.min = '0';
      maxField.style.width = '60px';
      
      container.appendChild(currentField);
      container.appendChild(separator);
      container.appendChild(maxField);
      label.parentNode.appendChild(container);
    } else {
      // Create non-firearm ammunition display (current only)
      const currentField = document.createElement('input');
      currentField.type = 'number';
      currentField.name = 'system.ammunition.current';
      currentField.value = this.document.system.ammunition.current;
      currentField.min = '0';
      currentField.style.width = '80px';
      
      label.parentNode.appendChild(currentField);
    }
  }

  /**
   * Setup conditional visibility for weapon protection
   * @private
   */
  _setupConditionalProtection() {
    const protectionCheckbox = this.element.querySelector('input[name="system.protection.enabled"]');
    const protectionValueSection = this.element.querySelector('.protection-value-section');

    if (!protectionCheckbox || !protectionValueSection) return;

    // Function to update visibility based on checkbox
    const updateVisibility = () => {
      const isEnabled = protectionCheckbox.checked;
      protectionValueSection.style.display = isEnabled ? 'block' : 'none';
    };

    // Set up event listener
    protectionCheckbox.addEventListener('change', updateVisibility);

    // Initial setup
    updateVisibility();
  }

  /**
   * Setup mutually exclusive checkboxes for effect apply/remove
   * @private
   */
  _setupEffectCheckboxes() {
    const effectCheckboxes = this.element.querySelectorAll('input[data-effect-checkbox]');
    
    effectCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (event) => {
        if (!event.target.checked) return;
        
        const effectIndex = event.target.dataset.effectIndex;
        const checkboxType = event.target.dataset.effectCheckbox;
        const otherType = checkboxType === 'apply' ? 'remove' : 'apply';
        
        // Find the other checkbox in the same effect and uncheck it
        const otherCheckbox = this.element.querySelector(
          `input[data-effect-checkbox="${otherType}"][data-effect-index="${effectIndex}"]`
        );
        
        if (otherCheckbox && otherCheckbox.checked) {
          otherCheckbox.checked = false;
        }
      });
    });
  }

  /**
   * Setup skill effects configuration button
   * @protected
   */
  _setupSkillEffectsButton() {
    // No need for manual setup since we're using data-action
  }

  /**************
   *
   *   ACTIONS
   *
   **************/

  /**
   * Handle changing a Document's image.
   *
   * @this CardiganSystemItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const { img } =
      this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ??
      {};
    const fp = new foundry.applications.apps.FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: (path) => {
        this.document.update({ [attr]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10,
    });
    return fp.browse();
  }

  /**
   * Renders an embedded document's sheet
   *
   * @this CardiganSystemItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _viewEffect(event, target) {
    const effect = this._getEffect(target);
    effect.sheet.render(true);
  }

  /**
   * Handles item deletion
   *
   * @this CardiganSystemItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _deleteEffect(event, target) {
    const effect = this._getEffect(target);
    await effect.delete();
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data defined in the HTML dataset
   *
   * @this CardiganSystemItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createEffect(event, target) {
    // Retrieve the configured document class for ActiveEffect
    const aeCls = getDocumentClass('ActiveEffect');
    // Prepare the document creation data by initializing it a default name.
    // As of v12, you can define custom Active Effect subtypes just like Item subtypes if you want
    const effectData = {
      name: aeCls.defaultName({
        // defaultName handles an undefined type gracefully
        type: target.dataset.type,
        parent: this.item,
      }),
    };
    // Loop through the dataset and add it to our effectData
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      // These data attributes are reserved for the action handling
      if (['action', 'documentClass'].includes(dataKey)) continue;
      // Nested properties require dot notation in the HTML, e.g. anything with `system`
      foundry.utils.setProperty(effectData, dataKey, value);
    }

    // Finally, create the embedded document!
    await aeCls.create(effectData, { parent: this.item });
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this CardiganSystemItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleEffect(event, target) {
    const effect = this._getEffect(target);
    await effect.update({ disabled: !effect.disabled });
  }

  /**
   * Handle adding a new weapon property
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addWeaponProperty(event, target) {
    event.preventDefault();
    
    const item = this.item;
    if (item.type !== 'arma') {
      return;
    }

    const currentProperties = item.system.toObject().properties || [];
    // Filter out any empty strings to avoid duplicates
    const filteredProperties = currentProperties.filter(prop => prop && prop.trim() !== '');
    const newProperties = [...filteredProperties, ''];
    
    
    return this.submit({ updateData: { 'system.properties': newProperties } });
  }

  /**
   * Handle removing a weapon property
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeWeaponProperty(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'arma') return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const currentProperties = item.system.toObject().properties || [];
    
    // Remove the property at the specified index
    const newProperties = currentProperties.filter((_, i) => i !== index);
    
    // Filter out any empty strings and use the clean array
    const finalProperties = newProperties.filter(prop => prop && prop.trim() !== '');
    
    return this.submit({ updateData: { 'system.properties': finalProperties } });
  }

  /**
   * Handle adding a new skill action type
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addSkillActionType(event, target) {
    event.preventDefault();
    
    const item = this.item;
    if (item.type !== 'skill') {
      return;
    }

    const currentActionTypes = item.system.toObject().skillActionTypes || [];
    // Filter out any empty strings
    const filteredActionTypes = currentActionTypes.filter(type => type && type.trim() !== '');
    
    // Find a default value that's not already in the list
    const availableTypes = ['general', 'extra', 'active', 'foco'];
    const defaultType = availableTypes.find(type => !filteredActionTypes.includes(type)) || 'general';
    
    const newActionTypes = [...filteredActionTypes, defaultType];
    
    return this.submit({ updateData: { 'system.skillActionTypes': newActionTypes } });
  }

  /**
   * Handle removing a skill action type
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeSkillActionType(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'skill') return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const currentActionTypes = item.system.toObject().skillActionTypes || [];
    
    // Remove the action type at the specified index
    const newActionTypes = currentActionTypes.filter((_, i) => i !== index);
    
    // Filter out any empty strings and use the clean array
    const finalActionTypes = newActionTypes.filter(type => type && type.trim() !== '');
    
    return this.submit({ updateData: { 'system.skillActionTypes': finalActionTypes } });
  }

  /**
   * Handle adding a spell category
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addSpellCategory(event, target) {
    event.preventDefault();
    
    const item = this.item;
    if (item.type !== 'skill' || item.system.skillClass !== 'feiticeiro') {
      return;
    }

    const currentCategories = item.system.toObject().spellCategories || [];
    // Filter out any empty strings
    const filteredCategories = currentCategories.filter(cat => cat && cat.trim() !== '');
    
    // Find a default value that's not already in the list
    const availableCategories = ['neutro', 'feerico', 'caos', 'necromancia'];
    const defaultCategory = availableCategories.find(cat => !filteredCategories.includes(cat)) || 'neutro';
    
    const newCategories = [...filteredCategories, defaultCategory];
    
    return this.submit({ updateData: { 'system.spellCategories': newCategories } });
  }

  /**
   * Handle removing a spell category
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeSpellCategory(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'skill') return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const currentCategories = item.system.toObject().spellCategories || [];
    
    // Remove the category at the specified index
    const newCategories = currentCategories.filter((_, i) => i !== index);
    
    // Filter out any empty strings and use the clean array
    const finalCategories = newCategories.filter(cat => cat && cat.trim() !== '');
    
    return this.submit({ updateData: { 'system.spellCategories': finalCategories } });
  }

  /**
   * Handle adding a new skill bonus
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addSkillBonus(event, target) {
    event.preventDefault();
    
    const item = this.item;
    if (item.type !== 'arma') {
      return;
    }

    const currentSkillBonuses = item.system.toObject().skillBonuses || [];
    // Filter out any incomplete or invalid entries
    const filteredSkillBonuses = currentSkillBonuses.filter(sb => 
      sb && sb.skill && typeof sb.skill === 'string' && sb.skill.trim() !== ''
    );
    
    // Always use 'accuracy' as default skill to ensure valid data
    const newSkillBonuses = [...filteredSkillBonuses, { skill: 'accuracy', bonus: 0 }];
    
    // Use direct update instead of form submit to avoid full document validation
    const updateResult = await item.update({ 'system.skillBonuses': newSkillBonuses });
    // Se o item pertence a um ator, dispara update() no ator para garantir recálculo igual arma
    if (item.parent && typeof item.parent.update === 'function') {
      await item.parent.update({});
    }
    return updateResult;
  }

  /**
   * Handle removing a skill bonus
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeSkillBonus(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'arma') return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const currentSkillBonuses = item.system.toObject().skillBonuses || [];
    
    // Remove the skill bonus at the specified index
    const newSkillBonuses = currentSkillBonuses.filter((_, i) => i !== index);
    
    // Filter out any invalid entries and use the clean array
    const finalSkillBonuses = newSkillBonuses.filter(sb => 
      sb && typeof sb.skill === 'string' && sb.skill.trim() !== ''
    );
    
    // Use direct update instead of form submit to avoid full document validation
    return item.update({ 'system.skillBonuses': finalSkillBonuses });
  }

  /**
   * Handle adding a new skill effect to a consumable item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addSkillEffect(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'item-consumivel') return;

    const currentEffects = item.system.toObject().modifiers?.skillEffects || [];
    const newEffect = {
      skill: 'vigor',
      operation: 'add',
      value: 1,
      duration: 'temporary'
    };
    const newEffects = [...currentEffects, newEffect];
    
    return this.submit({ updateData: { 'system.modifiers.skillEffects': newEffects } });
  }

  /**
   * Handle removing a skill effect from a consumable item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeSkillEffect(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'item-consumivel') return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const currentEffects = item.system.toObject().modifiers?.skillEffects || [];
    const newEffects = currentEffects.filter((_, i) => i !== index);
    
    return this.submit({ updateData: { 'system.modifiers.skillEffects': newEffects } });
  }

  /**
   * Handle configuring custom effects for skills
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _configureSkillEffects(event, target) {
    event.preventDefault();
    const item = this.item;
    
    if (item.type !== 'skill') {
      return;
    }

    try {
      // Import the dialog class dynamically
      const { SkillEffectsSelectionDialog } = await import('../applications/skill-effects-selection-dialog.mjs');
      
      // Open the effects selection dialog
      const dialog = new SkillEffectsSelectionDialog({
        item: item,
        selectedEffects: item.system.customEffects || []
      });
      
      dialog.render(true);
    } catch (error) {
      console.error('[CARDIGAN ERROR] Error in _configureSkillEffects:', error);
      ui.notifications.error(`Erro ao abrir dialog: ${error.message}`);
    }
  }

  /**
   * Handle configuring linked skills
   * @param {Event} event      The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async _configureLinkedSkills(event, target) {
    event.preventDefault();
    const item = this.item;
    
    if (item.type !== 'skill') {
      return;
    }

    try {
      // Open the linked skills selection dialog
      const dialog = new SkillLinkedSkillsDialog({
        item: item,
        selectedSkills: item.system.linkedSkills || []
      });
      
      dialog.render(true);
    } catch (error) {
      console.error('[CARDIGAN ERROR] Error in _configureLinkedSkills:', error);
      ui.notifications.error(`Erro ao abrir dialog: ${error.message}`);
    }
  }

  /**
   * Handle selecting racial skills for Race items
   * @param {Event} event      The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async _selectRacialSkills(event, target) {
    event.preventDefault();
    const item = this.item;
    
    if (item.type !== 'race') {
      return;
    }

    try {
      // Open the racial skills selection dialog
      const dialog = new RacialSkillsSelectionDialog({
        item: item,
        selectedSkills: item.system.racialSkills || []
      });
      
      dialog.render(true);
    } catch (error) {
      console.error('[CARDIGAN ERROR] Error in _selectRacialSkills:', error);
      ui.notifications.error(`Erro ao abrir dialog: ${error.message}`);
    }
  }

  /**
   * Handle removing a racial skill from Race item
   * @param {Event} event      The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async _removeRacialSkill(event, target) {
    event.preventDefault();
    const item = this.item;
    
    if (item.type !== 'race') {
      return;
    }

    const skillId = target.closest('[data-skill-id]')?.dataset.skillId;
    if (!skillId) return;

    try {
      const currentSkills = item.system.racialSkills || [];
      const updatedSkills = currentSkills.filter(skill => skill.id !== skillId);
      
      await item.update({
        'system.racialSkills': updatedSkills
      });
      
      ui.notifications.info('Skill racial removida');
    } catch (error) {
      console.error('[CARDIGAN ERROR] Error removing racial skill:', error);
      ui.notifications.error(`Erro ao remover skill: ${error.message}`);
    }
  }

  /**
   * Handle configuring enhancement 1
   * @param {Event} event      The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  async _configureEnhancement1(event, target) {
    await this._configureEnhancement(0);
  }

  /**
   * Handle configuring enhancement 2
   * @param {Event} event      The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  async _configureEnhancement2(event, target) {
    await this._configureEnhancement(1);
  }

  /**
   * Handle configuring enhancement 3
   * @param {Event} event      The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  async _configureEnhancement3(event, target) {
    await this._configureEnhancement(2);
  }

  /**
   * Open the enhancement configuration dialog
   * @param {number} enhancementIndex The index of the enhancement (0, 1, or 2)
   */
  async _configureEnhancement(enhancementIndex) {
    // Ensure enhancements array exists and has the right structure
    const enhancements = this.item.system.enhancements || [
      { name: '', description: '' },
      { name: '', description: '' },
      { name: '', description: '' }
    ];
    
    // Get the current enhancement data
    const enhancementData = enhancements[enhancementIndex] || { name: '', description: '' };

    try {
      const dialog = new SkillEnhancementConfigDialog({
        skill: this.item,
        enhancementIndex,
        enhancementData: foundry.utils.deepClone(enhancementData),
      });

      await dialog.render(true);
    } catch (error) {
      console.error('Error creating or rendering dialog:', error);
    }
  }

  /**
   * Handle configuring critical failure effects for consumables
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _configureCriticalFailureEffects(event, target) {
    event.preventDefault();
    const item = this.item;
    
    if (item.type !== 'item-consumivel') {
      return;
    }

    try {
      // Import the dialog class dynamically
      const { SkillEffectsSelectionDialog } = await import('../applications/skill-effects-selection-dialog.mjs');
      
      // Open the effects selection dialog
      const dialog = new SkillEffectsSelectionDialog({
        item: item,
        selectedEffects: item.system.criticalFailureEffects || [],
        effectType: 'criticalFailureEffects' // Identifier for saving
      });
      
      dialog.render(true);
    } catch (error) {
      console.error('[CARDIGAN ERROR] Error in _configureCriticalFailureEffects:', error);
      ui.notifications.error(`Erro ao abrir dialog: ${error.message}`);
    }
  }

  /**
   * Handle configuring critical hit effects for consumables
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _configureCriticalHitEffects(event, target) {
    event.preventDefault();
    const item = this.item;
    
    if (item.type !== 'item-consumivel') {
      return;
    }

    try {
      // Import the dialog class dynamically
      const { SkillEffectsSelectionDialog } = await import('../applications/skill-effects-selection-dialog.mjs');
      
      // Open the effects selection dialog
      const dialog = new SkillEffectsSelectionDialog({
        item: item,
        selectedEffects: item.system.criticalHitEffects || [],
        effectType: 'criticalHitEffects' // Identifier for saving
      });
      
      dialog.render(true);
    } catch (error) {
      console.error('[CARDIGAN ERROR] Error in _configureCriticalHitEffects:', error);
      ui.notifications.error(`Erro ao abrir dialog: ${error.message}`);
    }
  }



  /**
   * Handle using a consumable item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _useConsumableItem(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'item-consumivel') return;

    // Basic implementation - can be expanded later
    const itemName = item.name;
    const chatMessage = `<p><strong>${itemName}</strong> foi usado!</p>`;
    
    // Check if item should be consumed
    const consumeOnUse = item.system.modifiers?.usage?.consumeOnUse ?? true;
    if (consumeOnUse && item.system.quantity > 0) {
      const newQuantity = Math.max(0, item.system.quantity - 1);
      await item.update({ 'system.quantity': newQuantity });
    }
    
    // Create chat message
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: item.actor }),
      content: chatMessage,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
  }

  /**
   * Add a new critical failure effect slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addCriticalFailureEffect(event, target) {
    event.preventDefault();
    const currentEffects = this.item.system.criticalFailureEffects || [];
    const newEffects = [...currentEffects, ""];
    await this.item.update({ 'system.criticalFailureEffects': newEffects });
  }

  /**
   * Remove a critical failure effect slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeCriticalFailureEffect(event, target) {
    event.preventDefault();
    const index = parseInt(target.dataset.index);
    const currentEffects = this.item.system.criticalFailureEffects || [];
    const newEffects = currentEffects.filter((_, i) => i !== index);
    await this.item.update({ 'system.criticalFailureEffects': newEffects });
  }

  /**
   * Add a new critical failure skill loss slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addCriticalFailureSkillLoss(event, target) {
    event.preventDefault();
    const currentSkillLoss = this.item.system.criticalFailureSkillLoss || [];
    const newSkillLoss = [...currentSkillLoss, { ability: "accuracy", value: 0 }];
    await this.item.update({ 'system.criticalFailureSkillLoss': newSkillLoss });
  }

  /**
   * Remove a critical failure skill loss slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeCriticalFailureSkillLoss(event, target) {
    event.preventDefault();
    const index = parseInt(target.dataset.index);
    const currentSkillLoss = this.item.system.criticalFailureSkillLoss || [];
    const newSkillLoss = currentSkillLoss.filter((_, i) => i !== index);
    await this.item.update({ 'system.criticalFailureSkillLoss': newSkillLoss });
  }

  /**
   * Add a new critical hit effect slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addCriticalHitEffect(event, target) {
    event.preventDefault();
    const currentEffects = this.item.system.criticalHitEffects || [];
    const newEffects = [...currentEffects, ""];
    await this.item.update({ 'system.criticalHitEffects': newEffects });
  }

  /**
   * Remove a critical hit effect slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeCriticalHitEffect(event, target) {
    event.preventDefault();
    const index = parseInt(target.dataset.index);
    const currentEffects = this.item.system.criticalHitEffects || [];
    const newEffects = currentEffects.filter((_, i) => i !== index);
    await this.item.update({ 'system.criticalHitEffects': newEffects });
  }

  /**
   * Add a new critical hit skill bonus slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addCriticalHitSkillBonus(event, target) {
    event.preventDefault();
    const currentBonuses = this.item.system.criticalHitSkillBonus || [];
    const newBonuses = [...currentBonuses, { ability: "accuracy", value: 1 }];
    await this.item.update({ 'system.criticalHitSkillBonus': newBonuses });
  }

  /**
   * Remove a critical hit skill bonus slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeCriticalHitSkillBonus(event, target) {
    event.preventDefault();
    const index = parseInt(target.dataset.index);
    const currentBonuses = this.item.system.criticalHitSkillBonus || [];
    const newBonuses = currentBonuses.filter((_, i) => i !== index);
    await this.item.update({ 'system.criticalHitSkillBonus': newBonuses });
  }

  /**
   * Add a new temporary skill bonus slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addTemporarySkillBonus(event, target) {
    event.preventDefault();
    const currentBonuses = this.item.system.temporarySkillBonus || [];
    const newBonuses = [...currentBonuses, { ability: "accuracy", value: 1 }];
    await this.item.update({ 'system.temporarySkillBonus': newBonuses });
  }

  /**
   * Remove a temporary skill bonus slot
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeTemporarySkillBonus(event, target) {
    event.preventDefault();
    const index = parseInt(target.dataset.index);
    const currentBonuses = this.item.system.temporarySkillBonus || [];
    const newBonuses = currentBonuses.filter((_, i) => i !== index);
    await this.item.update({ 'system.temporarySkillBonus': newBonuses });
  }

  /** Helper Functions */

  /**
   * Fetches the row with the data for the rendered embedded document
   *
   * @param {HTMLElement} target  The element with the action
   * @returns {HTMLLIElement} The document's row
   */
  static _getEffect(target) {
    const li = target.closest('.effect');
    return this.item.effects.get(li?.dataset?.effectId);
  }

  /**
   *
   * DragDrop
   *
   */

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const li = event.currentTarget;
    if ('link' in event.target.dataset) return;

    let dragData = null;

    // Active Effect
    if (li.dataset.effectId) {
      const effect = this.item.effects.get(li.dataset.effectId);
      dragData = effect.toDragData();
    }

    if (!dragData) return;

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) {}

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    
    const item = this.item;
    const allowed = Hooks.call('dropItemSheetData', item, this, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, data);
      case 'Actor':
        return this._onDropActor(event, data);
      case 'Item':
        return this._onDropItem(event, data);
      case 'Folder':
        return this._onDropFolder(event, data);
    }
    console.log("=".repeat(60));
  }

  /* -------------------------------------------- */

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet
   * @param {DragEvent} event                  The concluding DragEvent which contains drop data
   * @param {object} data                      The data transfer extracted from the event
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object or false if it couldn't be created.
   * @protected
   */
  async _onDropActiveEffect(event, data) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!this.item.isOwner || !effect) return false;

    if (this.item.uuid === effect.parent?.uuid)
      return this._onEffectSort(event, effect);
    return aeCls.create(effect, { parent: this.item });
  }

  /**
   * Sorts an Active Effect based on its surrounding attributes
   *
   * @param {DragEvent} event
   * @param {ActiveEffect} effect
   */
  _onEffectSort(event, effect) {
    const effects = this.item.effects;
    const dropTarget = event.target.closest('[data-effect-id]');
    if (!dropTarget) return;
    const target = effects.get(dropTarget.dataset.effectId);

    // Don't sort on yourself
    if (effect.id === target.id) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (let el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.effectId;
      if (siblingId && siblingId !== effect.id)
        siblings.push(effects.get(el.dataset.effectId));
    }

    // Perform the sort
    const sortUpdates = SortingHelpers.performIntegerSort(effect, {
      siblings,
    });
    const updateData = sortUpdates.map((u) => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.item.updateEmbeddedDocuments('ActiveEffect', updateData);
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop, or false if the drop was
   *                                     not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.item.isOwner) return false;
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances, or false if the drop was not permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    try {
      if (!this.item.isOwner) return false;
      
      // Check if this is a recipe item and the drop zone is for result items
      const dropZone = event.target.closest('[data-drop-zone]');
      
      if (this.item.type === 'item-recipe' && dropZone?.dataset.dropZone === 'resultItems') {
        return this._onDropResultItem(event, data);
      }
      
      return false;
    } catch (error) {
      console.error("[ITEM-SHEET] Error in _onDropItem:", error);
      throw error;
    }
  }

  /**
   * Handle dropping an item onto the recipe's result items zone
   * @param {DragEvent} event  The drop event
   * @param {object} data      The dropped data
   * @returns {Promise<boolean>}
   * @protected
   */
  async _onDropResultItem(event, data) {
    console.log("[RECIPE] Dropping result item:", data);
    console.log("[RECIPE] this.item.isOwner:", this.item.isOwner);
    console.log("[RECIPE] this.item.isEmbedded:", this.item.isEmbedded);
    console.log("[RECIPE] this.item.pack:", this.item.pack);
    console.log("[RECIPE] this.isEditable:", this.isEditable);
    
    if (data.type !== 'Item') return false;
    
    // Check if we can edit this item
    if (!this.isEditable) {
      ui.notifications.warn("Cannot edit this recipe");
      return false;
    }
    
    try {
      // Get the dropped item
      const droppedItem = await fromUuid(data.uuid);
      if (!droppedItem) {
        ui.notifications.error("Could not find the dropped item");
        return false;
      }
      
      console.log("[RECIPE] Dropped item:", droppedItem.name, droppedItem.type);
      
      // Get current result items
      const resultItems = foundry.utils.duplicate(this.item.system.resultItems || []);
      
      // Check if item with same UUID already exists
      const existingIndex = resultItems.findIndex(r => r.uuid === data.uuid);
      if (existingIndex !== -1) {
        ui.notifications.warn(`"${droppedItem.name}" is already in the result items list`);
        return false;
      }
      
      // Create new result item entry
      const newResultItem = {
        uuid: data.uuid,
        name: droppedItem.name,
        img: droppedItem.img || "systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg",
        quantity: 1,
        isDefault: resultItems.length === 0, // First item is default
        customProperties: {}
      };
      
      // Add to result items
      resultItems.push(newResultItem);
      
      console.log("[RECIPE] About to update with resultItems:", resultItems);
      console.log("[RECIPE] Current item system:", this.item.system);
      
      // Update the recipe
      const updateData = { 'system.resultItems': resultItems };
      console.log("[RECIPE] Update data:", updateData);
      
      const result = await this.item.update(updateData);
      console.log("[RECIPE] Update result:", result);
      console.log("[RECIPE] Item after update:", this.item.system.resultItems);
      
      console.log("[RECIPE] Added result item:", newResultItem);
      ui.notifications.info(`Added "${droppedItem.name}" to result items`);
      
      return true;
    } catch (error) {
      console.error("[RECIPE] Error dropping result item:", error);
      ui.notifications.error("Failed to add result item");
      return false;
    }
  }

  /**
   * Handle removing a result item from a recipe
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeResultItem(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'item-recipe') return;
    
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    
    const resultItems = foundry.utils.duplicate(item.system.resultItems || []);
    
    if (index < 0 || index >= resultItems.length) return;
    
    const removedItem = resultItems[index];
    resultItems.splice(index, 1);
    
    // If we removed the default item and there are still items left, make the first one default
    if (removedItem.isDefault && resultItems.length > 0) {
      resultItems[0].isDefault = true;
    }
    
    await this.submit({ updateData: { 'system.resultItems': resultItems } });
    
    console.log("[RECIPE] Removed result item at index:", index);
    ui.notifications.info(`Removed "${removedItem.name}" from result items`);
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * The core sheet currently supports dropping a Folder of Items to create all items as owned items.
   * @param {DragEvent} event     The concluding DragEvent which contains drop data
   * @param {object} data         The data transfer extracted from the event
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropFolder(event, data) {
    if (!this.item.isOwner) return [];
  }

  /** The following pieces set up drag handling and are unlikely to need modification  */

  /**
   * Returns an array of DragDrop instances
   * @type {foundry.applications.ux.DragDrop[]}
   */
  get dragDrop() {
    return this.#dragDrop;
  }

  // This is marked as private because there's no real need
  // for subclasses or external hooks to mess with it directly
  #dragDrop;

  /**
   * Handle adding a new effect to a consumable item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addEffect(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'item-consumivel') return;

    const currentEffects = item.system.toObject().effects || [];
    // Filter out any incomplete or invalid entries
    const filteredEffects = currentEffects.filter(effect => 
      effect && effect.effectId && typeof effect.effectId === 'string' && effect.effectId.trim() !== ''
    );
    
    const newEffects = [...filteredEffects, { effectId: '', apply: false, remove: false }];
    
      currentEffects,
      filteredEffects,
      newEffects
    
    return this.submit({ updateData: { 'system.effects': newEffects } });
  }

  /**
   * Handle removing an effect from a consumable item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeEffect(event, target) {
    event.preventDefault();
    const item = this.item;
    if (item.type !== 'item-consumivel') return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const currentEffects = item.system.toObject().effects || [];
    
    // Remove the effect at the specified index
    const newEffects = currentEffects.filter((_, i) => i !== index);
    
    // Filter out any invalid entries (effects with empty effectId)
    const finalEffects = newEffects.filter(effect => 
      effect && typeof effect.effectId === 'string' && effect.effectId.trim() !== ''
    );
    
      index,
      currentEffects,
      newEffects,
      finalEffects
    
    return this.submit({ updateData: { 'system.effects': finalEffects } });
  }

  /**
   * Load available effects from the compendium
   * @returns {Promise<Array>} Array of effect objects with id and name
   * @private
   */
  async _loadAvailableEffects() {
    try {
      const pack = game.packs.get("cardigan.efeitos-cardigan");
      if (!pack) {
        console.warn('[CARDIGAN] Effects compendium not found!');
        return [];
      }

      // Load the compendium index
      await pack.getIndex();
      
      // Return array of effects with id and name for dropdowns
      return pack.index.map(effect => ({
        id: effect._id,
        name: effect.name
      })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('[CARDIGAN] Error loading effects from compendium:', error);
      return [];
    }
  }

  /**
   * Setup skill check toggle visibility for consumable items
   * @private
   */
  _setupSkillCheckToggle() {
    const toggle = this.element.querySelector('[data-skill-check-toggle]');
    const skillCheckSection = this.element.querySelector('[data-skill-check-section]');
    
    if (!toggle || !skillCheckSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        skillCheckSection.classList.remove('hidden');
      } else {
        skillCheckSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup effects toggle visibility for consumable items
   * @private
   */
  _setupEffectsToggle() {
    const toggle = this.element.querySelector('[data-effects-toggle]');
    const effectsSection = this.element.querySelector('[data-effects-section]');
    
    if (!toggle || !effectsSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        effectsSection.classList.remove('hidden');
      } else {
        effectsSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup critical failure effects toggle visibility for consumable items
   * @private
   */
  _setupCriticalFailureEffectsToggle() {
    const toggle = this.element.querySelector('[data-critical-failure-effects-toggle]');
    const criticalFailureEffectsSection = this.element.querySelector('[data-critical-failure-effects-section]');
    
    if (!toggle || !criticalFailureEffectsSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        criticalFailureEffectsSection.classList.remove('hidden');
      } else {
        criticalFailureEffectsSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup critical failure skill loss toggle visibility for consumable items
   * @private
   */
  _setupCriticalFailureSkillLossToggle() {
    const toggle = this.element.querySelector('[data-critical-failure-skill-loss-toggle]');
    const criticalFailureSkillLossSection = this.element.querySelector('[data-critical-failure-skill-loss-section]');
    
    if (!toggle || !criticalFailureSkillLossSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        criticalFailureSkillLossSection.classList.remove('hidden');
      } else {
        criticalFailureSkillLossSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup critical hit effects toggle visibility for consumable items
   * @private
   */
  _setupCriticalHitEffectsToggle() {
    const toggle = this.element.querySelector('[data-critical-hit-effects-toggle]');
    const criticalHitEffectsSection = this.element.querySelector('[data-critical-hit-effects-section]');
    
    if (!toggle || !criticalHitEffectsSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        criticalHitEffectsSection.classList.remove('hidden');
      } else {
        criticalHitEffectsSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup critical hit skill bonus toggle visibility for consumable items
   * @private
   */
  _setupCriticalHitSkillBonusToggle() {
    const toggle = this.element.querySelector('[data-critical-hit-skill-bonus-toggle]');
    const criticalHitSkillBonusSection = this.element.querySelector('[data-critical-hit-skill-bonus-section]');
    
    if (!toggle || !criticalHitSkillBonusSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        criticalHitSkillBonusSection.classList.remove('hidden');
      } else {
        criticalHitSkillBonusSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup temporary skill bonus toggle visibility for consumable items
   * @private
   */
  _setupTemporarySkillBonusToggle() {
    const toggle = this.element.querySelector('[data-temporary-skill-bonus-toggle]');
    const temporarySkillBonusSection = this.element.querySelector('[data-temporary-skill-bonus-section]');
    
    if (!toggle || !temporarySkillBonusSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        temporarySkillBonusSection.classList.remove('hidden');
      } else {
        temporarySkillBonusSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup health modifier toggle visibility for consumable items
   * @private
   */
  _setupHealthModifierToggle() {
    const toggle = this.element.querySelector('[data-health-modifier-toggle]');
    const healthModifierSection = this.element.querySelector('[data-health-modifier-section]');
    
    if (!toggle || !healthModifierSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        healthModifierSection.classList.remove('hidden');
      } else {
        healthModifierSection.classList.add('hidden');
      }
    });

    // Setup skill toggle within health modifier section
    this._setupHealthModifierSkillToggle();
  }

  /**
   * Setup health modifier skill toggle visibility
   * @private
   */
  _setupHealthModifierSkillToggle() {
    const toggle = this.element.querySelector('[data-health-modifier-skill-toggle]');
    const skillSection = this.element.querySelector('[data-health-modifier-skill-section]');
    
    if (!toggle || !skillSection) return;
    
    // Add event listener for the skill toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        skillSection.classList.remove('hidden');
      } else {
        skillSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup energy modifier toggle visibility for consumable items
   * @private
   */
  _setupEnergyModifierToggle() {
    const toggle = this.element.querySelector('[data-energy-modifier-toggle]');
    const energyModifierSection = this.element.querySelector('[data-energy-modifier-section]');
    
    if (!toggle || !energyModifierSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        energyModifierSection.classList.remove('hidden');
      } else {
        energyModifierSection.classList.add('hidden');
      }
    });

    // Setup skill toggle within energy modifier section
    this._setupEnergyModifierSkillToggle();
  }

  /**
   * Setup energy modifier skill toggle visibility
   * @private
   */
  _setupEnergyModifierSkillToggle() {
    const toggle = this.element.querySelector('[data-energy-modifier-skill-toggle]');
    const skillSection = this.element.querySelector('[data-energy-modifier-skill-section]');
    
    if (!toggle || !skillSection) return;
    
    // Add event listener for the skill toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        skillSection.classList.remove('hidden');
      } else {
        skillSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup status ailments toggle visibility for consumable items
   * @private
   */
  _setupStatusAilmentsToggle() {
    const toggle = this.element.querySelector('[data-status-ailments-toggle]');
    const statusAilmentsSection = this.element.querySelector('[data-status-ailments-section]');
    
    if (!toggle || !statusAilmentsSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        statusAilmentsSection.classList.remove('hidden');
      } else {
        statusAilmentsSection.classList.add('hidden');
      }
    });

    // Setup sanity modifier toggle within status ailments section
    this._setupSanityModifierToggle();
    // Setup toxicity modifier toggle within status ailments section
    this._setupToxicityModifierToggle();
    // Setup fracture modifier toggle within status ailments section
    this._setupFractureModifierToggle();
  }

  /**
   * Setup sanity modifier toggle visibility
   * @private
   */
  _setupSanityModifierToggle() {
    const toggle = this.element.querySelector('[data-sanity-modifier-toggle]');
    const sanityModifierSection = this.element.querySelector('[data-sanity-modifier-section]');
    
    if (!toggle || !sanityModifierSection) return;
    
    // Add event listener for the sanity modifier toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        sanityModifierSection.classList.remove('hidden');
      } else {
        sanityModifierSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup toxicity modifier toggle visibility
   * @private
   */
  _setupToxicityModifierToggle() {
    const toggle = this.element.querySelector('[data-toxicity-modifier-toggle]');
    const toxicityModifierSection = this.element.querySelector('[data-toxicity-modifier-section]');
    
    if (!toggle || !toxicityModifierSection) return;
    
    // Add event listener for the toxicity modifier toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        toxicityModifierSection.classList.remove('hidden');
      } else {
        toxicityModifierSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup fracture modifier toggle visibility
   * @private
   */
  _setupFractureModifierToggle() {
    const toggle = this.element.querySelector('[data-fracture-modifier-toggle]');
    const fractureModifierSection = this.element.querySelector('[data-fracture-modifier-section]');
    
    if (!toggle || !fractureModifierSection) return;
    
    // Add event listener for the fracture modifier toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        fractureModifierSection.classList.remove('hidden');
      } else {
        fractureModifierSection.classList.add('hidden');
      }
    });
  }

  /**
   * Creates drag & drop handlers for this application
   * @returns {foundry.applications.ux.DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new foundry.applications.ux.DragDrop(d);
    });
  }

  /**
   * Setup energy modifier toggle visibility for consumable items
   * @private
   */
  _setupEnergyModifierToggle() {
    const toggle = this.element.querySelector('[data-energy-modifier-toggle]');
    const energyModifierSection = this.element.querySelector('[data-energy-modifier-section]');
    
    if (!toggle || !energyModifierSection) return;
    
    // Add event listener for the toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        energyModifierSection.classList.remove('hidden');
      } else {
        energyModifierSection.classList.add('hidden');
      }
    });

    // Setup skill toggle within energy modifier section
    this._setupEnergyModifierSkillToggle();
  }

  /**
   * Setup energy modifier skill toggle visibility
   * @private
   */
  _setupEnergyModifierSkillToggle() {
    const toggle = this.element.querySelector('[data-energy-modifier-skill-toggle]');
    const skillSection = this.element.querySelector('[data-energy-modifier-skill-section]');
    
    if (!toggle || !skillSection) return;
    
    // Add event listener for the skill toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        skillSection.classList.remove('hidden');
      } else {
        skillSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup food and water toggle visibility
   * @private
   */
  _setupFoodAndWaterToggle() {
    const toggle = this.element.querySelector('[data-food-and-water-toggle]');
    const foodAndWaterSection = this.element.querySelector('[data-food-and-water-section]');
    
    if (!toggle || !foodAndWaterSection) return;
    
    // Add event listener for the food and water toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        foodAndWaterSection.classList.remove('hidden');
      } else {
        foodAndWaterSection.classList.add('hidden');
      }
    });

    // Setup food modifier toggle within food and water section
    this._setupFoodModifierToggle();
    // Setup water modifier toggle within food and water section
    this._setupWaterModifierToggle();
  }

  /**
   * Setup food modifier toggle visibility
   * @private
   */
  _setupFoodModifierToggle() {
    const toggle = this.element.querySelector('[data-food-modifier-toggle]');
    const foodModifierSection = this.element.querySelector('[data-food-modifier-section]');
    
    if (!toggle || !foodModifierSection) return;
    
    // Add event listener for the food modifier toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        foodModifierSection.classList.remove('hidden');
      } else {
        foodModifierSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup water modifier toggle visibility
   * @private
   */
  _setupWaterModifierToggle() {
    const toggle = this.element.querySelector('[data-water-modifier-toggle]');
    const waterModifierSection = this.element.querySelector('[data-water-modifier-section]');
    
    if (!toggle || !waterModifierSection) return;
    
    // Add event listener for the water modifier toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        waterModifierSection.classList.remove('hidden');
      } else {
        waterModifierSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup movement boost toggle visibility for consumable items
   * @private
   */
  _setupMovementBoostToggle() {
    const toggle = this.element.querySelector('[data-movement-boost-toggle]');
    const movementBoostSection = this.element.querySelector('[data-movement-boost-section]');
    
    if (!toggle || !movementBoostSection) return;
    
    // Add event listener for the movement boost toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        movementBoostSection.classList.remove('hidden');
      } else {
        movementBoostSection.classList.add('hidden');
      }
    });
  }

  /**
   * Setup critical hit boost toggle visibility for consumable items
   * @private
   */
  _setupCriticalHitBoostToggle() {
    const toggle = this.element.querySelector('[data-critical-hit-boost-toggle]');
    const criticalHitBoostSection = this.element.querySelector('[data-critical-hit-boost-section]');
    
    if (!toggle || !criticalHitBoostSection) return;
    
    // Add event listener for the critical hit boost toggle checkbox
    toggle.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      
      if (isChecked) {
        criticalHitBoostSection.classList.remove('hidden');
      } else {
        criticalHitBoostSection.classList.add('hidden');
      }
    });
  }

  /* -------------------------------------------- */
  /*  INGREDIENT MANAGEMENT                       */
  /* -------------------------------------------- */

  /**
   * Search for items by name in all available sources
   * @param {string} ingredientName - Name to search for
   * @param {boolean} useCache - Whether to use cached results
   * @param {string} recipeProfession - Profession of the recipe for prioritization
   * @returns {Promise<Array>} Array of matching items with source info
   * @protected
   */
  static async _searchItemsByName(ingredientName, useCache = true, recipeProfession = null) {
    if (!ingredientName || ingredientName.trim() === '') return [];
    
    const searchTerm = ingredientName.toLowerCase().trim();
    const cacheKey = `${searchTerm}-${recipeProfession || 'none'}`;
    
    // Check cache first
    if (useCache && CardiganSystemItemSheet._ingredientCache.has(cacheKey)) {
      const cached = CardiganSystemItemSheet._ingredientCache.get(cacheKey);
      return cached;
    }
    
    const matchingItems = [];
    
    // Helper function to check name match
    const isNameMatch = (itemName) => {
      const name = itemName.toLowerCase();
      return name === searchTerm || 
             name.includes(searchTerm) || 
             searchTerm.includes(name);
    };

    // Helper function to get profession priority
    const getProfessionPriority = (itemProfession) => {
      if (!itemProfession || !recipeProfession) return 5; // Default priority
      if (itemProfession === recipeProfession) return 1; // Perfect profession match
      if (itemProfession === 'general') return 2; // General use items are versatile
      return 3; // Different profession but still usable
    };
    
    // 1. Search through all actors' items (highest priority) - with performance limit
    let itemsChecked = 0;
    const maxItemsToCheck = 1000; // Limit to prevent performance issues
    
    actorLoop: for (const actor of game.actors) {
      if (!actor.items) continue;
      
      for (const item of actor.items) {
        if (++itemsChecked > maxItemsToCheck) {
          console.warn('[CARDIGAN] Search stopped after checking', maxItemsToCheck, 'items for performance');
          break actorLoop;
        }
        
        if (isNameMatch(item.name)) {
          const itemProfession = item.system.profession || 'general';
          const professionPriority = getProfessionPriority(itemProfession);
          
          matchingItems.push({
            item: item,
            actor: actor,
            source: 'actor',
            sourceLabel: `${actor.name}`,
            name: item.name,
            img: item.img,
            quantity: item.system.quantity || 1,
            exactMatch: item.name.toLowerCase() === searchTerm,
            priority: 1,
            profession: itemProfession,
            professionPriority: professionPriority
          });
          
          // If we found an exact match, prioritize it and potentially stop early
          if (item.name.toLowerCase() === searchTerm && matchingItems.length >= 5) {
            break actorLoop;
          }
        }
      }
    }
    
    // 2. Search through sidebar items (medium priority) - optimized
    if (matchingItems.length < 10) { // Only search sidebar if we don't have many matches yet
      for (const item of game.items) {
        if (isNameMatch(item.name)) {
          const itemProfession = item.system.profession || 'general';
          const professionPriority = getProfessionPriority(itemProfession);
          
          matchingItems.push({
            item: item,
            actor: null,
            source: 'sidebar',
            sourceLabel: 'Items Directory',
            name: item.name,
            img: item.img,
            quantity: item.system.quantity || 1,
            exactMatch: item.name.toLowerCase() === searchTerm,
            priority: 2,
            profession: itemProfession,
            professionPriority: professionPriority
          });
        }
      }
    }
    
    // 3. Search through relevant compendiums (lowest priority) - only if we have few matches
    if (matchingItems.length < 5) { // Only search compendiums if we really need more results
      const relevantPacks = game.packs.filter(pack => 
        pack.documentName === "Item" && 
        (pack.metadata.label.toLowerCase().includes('item') ||
         pack.metadata.label.toLowerCase().includes('ingredient') ||
         pack.metadata.name.includes('item'))
      );
      
      for (const pack of relevantPacks) {
        try {
          const index = await pack.getIndex();
          let compendiumMatches = 0;
          const maxCompendiumMatches = 3; // Limit compendium matches per pack
          
          for (const indexEntry of index) {
            if (compendiumMatches >= maxCompendiumMatches) break;
            
            if (isNameMatch(indexEntry.name)) {
              // Load the full document to get the image
              const item = await pack.getDocument(indexEntry._id);
              const itemProfession = item.system.profession || 'general';
              const professionPriority = getProfessionPriority(itemProfession);
              
              matchingItems.push({
                item: item,
                actor: null,
                source: 'compendium',
                sourceLabel: pack.metadata.label,
                name: item.name,
                img: item.img,
                quantity: item.system.quantity || 1,
                exactMatch: item.name.toLowerCase() === searchTerm,
                priority: 3,
                profession: itemProfession,
                professionPriority: professionPriority
              });
              
              compendiumMatches++;
            }
          }
        } catch (error) {
          console.warn(`[CARDIGAN] Error searching compendium ${pack.metadata.label}:`, error);
        }
      }
    }
    
    // Sort by profession match, then priority, then exact matches, then alphabetically
    const sortedResults = matchingItems.sort((a, b) => {
      // First by profession priority (if recipe profession is specified)
      if (recipeProfession && a.professionPriority !== b.professionPriority) {
        return a.professionPriority - b.professionPriority;
      }
      // Then by source priority (actors first)
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Then by exact name match
      if (a.exactMatch && !b.exactMatch) return -1;
      if (!a.exactMatch && b.exactMatch) return 1;
      // Finally alphabetically
      return a.name.localeCompare(b.name);
    });
    
    // Cache the results for future use with shorter expiration
    if (useCache) {
      CardiganSystemItemSheet._ingredientCache.set(cacheKey, sortedResults);
      
      // Clear cache after 2 minutes to prevent stale data (shorter for better performance)
      setTimeout(() => {
        CardiganSystemItemSheet._ingredientCache.delete(cacheKey);
      }, 2 * 60 * 1000);
      
      // Also implement cache size limit
      if (CardiganSystemItemSheet._ingredientCache.size > 50) {
        const firstKey = CardiganSystemItemSheet._ingredientCache.keys().next().value;
        CardiganSystemItemSheet._ingredientCache.delete(firstKey);
      }
    }
    
    return sortedResults;
  }

  /**
   * Auto-fill ingredient data based on name search
   * @param {string} ingredientName - Name to search for
   * @param {number} index - Index of the ingredient to update
   * @protected
   */
  async _autoFillIngredient(ingredientName, index) {
    const item = this.item;
    const currentIngredients = item.system.toObject().requiredIngredients || [];
    
    if (index >= currentIngredients.length) return;
    
    // Determine recipe profession from item type
    const recipeProfession = this._getRecipeProfession(item.type);
    const matchingItems = await CardiganSystemItemSheet._searchItemsByName(ingredientName, true, recipeProfession);
    
    if (matchingItems.length > 0) {
      const bestMatch = matchingItems[0]; // Get the best match (highest priority)
      const newIngredients = [...currentIngredients];
      
      // Update the ingredient with the found item's image
      newIngredients[index] = {
        ...newIngredients[index],
        name: ingredientName, // Keep the user input name
        img: bestMatch.img || 'systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg'
      };
      
      // Show notification about the source and profession match
      const sourceMsg = bestMatch.source === 'actor' 
        ? `encontrado no inventário de ${bestMatch.sourceLabel}`
        : bestMatch.source === 'sidebar'
        ? 'encontrado na Sidebar (Items Directory)'
        : `encontrado no compêndio "${bestMatch.sourceLabel}"`;
      
      const professionMsg = bestMatch.profession && recipeProfession && bestMatch.profession === recipeProfession
        ? ` (profissão compatível: ${bestMatch.profession})`
        : bestMatch.profession === 'general'
        ? ` (uso geral)`
        : bestMatch.profession
        ? ` (profissão: ${bestMatch.profession})`
        : '';
      
      ui.notifications.info(`Imagem do ingrediente "${bestMatch.name}" ${sourceMsg}${professionMsg}`, { permanent: false });
      
      await this.item.update({ 'system.requiredIngredients': newIngredients });
    }
  }

  /**
   * Handle adding a new ingredient to the recipe
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addIngredient(event, target) {
    event.preventDefault();
    const item = this.item;
    
    // Check if this is a recipe type
    const recipeTypes = ['item-recipe', 'culinary-recipe', 'tailoring-recipe', 'tecnomagic-recipe', 'blacksmithing-recipe', 'alchemy-recipe'];
    if (!recipeTypes.includes(item.type)) {
      return;
    }

    const currentIngredients = item.system.toObject().requiredIngredients || [];
    const newIngredient = {
      name: 'New Ingredient',
      quantity: 1,
      img: 'systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg'
    };
    
    const newIngredients = [...currentIngredients, newIngredient];
    
      currentIngredients,
      newIngredients
    
    return item.update({ 'system.requiredIngredients': newIngredients });
  }

  /**
   * Handle removing an ingredient from the recipe
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeIngredient(event, target) {
    event.preventDefault();
    const item = this.item;
    
    // Check if this is a recipe type
    const recipeTypes = ['item-recipe', 'culinary-recipe', 'tailoring-recipe', 'tecnomagic-recipe', 'blacksmithing-recipe', 'alchemy-recipe'];
    if (!recipeTypes.includes(item.type)) {
      return;
    }

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const currentIngredients = item.system.toObject().requiredIngredients || [];
    
    // Remove the ingredient at the specified index
    const newIngredients = currentIngredients.filter((_, i) => i !== index);
    
      index,
      currentIngredients,
      newIngredients
    
    return item.update({ 'system.requiredIngredients': newIngredients });
  }

  /**
   * Handle changing an ingredient's image
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _changeIngredientImage(event, target) {
    event.preventDefault();
    const item = this.item;
    
    // Check if this is a recipe type
    const recipeTypes = ['item-recipe', 'culinary-recipe', 'tailoring-recipe', 'tecnomagic-recipe', 'blacksmithing-recipe', 'alchemy-recipe'];
    if (!recipeTypes.includes(item.type)) return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const currentIngredients = item.system.toObject().requiredIngredients || [];
    if (index >= currentIngredients.length) return;

    // Open file picker to select new image
    const fp = new foundry.applications.apps.FilePicker({
      type: "image",
      callback: (path) => {
        const newIngredients = [...currentIngredients];
        newIngredients[index].img = path;
        
        item.update({ 'system.requiredIngredients': newIngredients });
      }
    });
    
    fp.render(true);
  }

  /**
   * Find matching ingredient image from game items
   * Priority: 1) Actor inventories (all actors), 2) World items, 3) Compendium items
   * @param {string} ingredientName - The ingredient name to search for
   * @returns {string|null} The image path or null if not found
   * @private
   */
  static _findIngredientImage(ingredientName) {
    const nameLower = ingredientName.toLowerCase();
    
    // Helper to check exact or partial match
    const findMatch = (items, exactOnly = false) => {
      // Try exact match first
      let match = items.find(item => 
        item.name.toLowerCase() === nameLower
      );
      
      // If no exact match and partial allowed, try partial
      if (!match && !exactOnly) {
        match = items.find(item => 
          item.name.toLowerCase().includes(nameLower)
        );
      }
      
      return match;
    };
    
    // 1) Search in all actor inventories first
    for (const actor of game.actors.contents) {
      const match = findMatch(actor.items.contents);
      if (match) return match.img;
    }
    
    // 2) Search in world items (sidebar)
    const worldMatch = findMatch(game.items.contents);
    if (worldMatch) return worldMatch.img;
    
    // 3) Not found
    return null;
  }

  /**
   * Handle adding an ingredient to a specific result item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _addIngredientToResult(event, target) {
    event.preventDefault();
    const item = this.item;
    
    const resultIndex = parseInt(target.dataset.resultIndex);
    if (isNaN(resultIndex)) return;

    const resultItems = item.system.toObject().resultItems || [];
    if (resultIndex >= resultItems.length) return;

    const currentIngredients = resultItems[resultIndex].requiredIngredients || [];
    
    // Create base ingredient
    const newIngredient = {
      name: 'Novo Ingrediente',
      quantity: 1,
      img: 'systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg' // Default fallback
    };
    
    // Try to find matching item image
    // Priority: 1) Actor inventories, 2) World items, 3) Compendiums
    const foundImage = CardiganSystemItemSheet._findIngredientImage(newIngredient.name);
    if (foundImage) {
      newIngredient.img = foundImage;
    }
    
    resultItems[resultIndex].requiredIngredients = [...currentIngredients, newIngredient];
    
    return item.update({ 'system.resultItems': resultItems });
  }

  /**
   * Handle removing an ingredient from a result item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _removeResultIngredient(event, target) {
    event.preventDefault();
    const item = this.item;
    
    const resultIndex = parseInt(target.dataset.resultIndex);
    const ingredientIndex = parseInt(target.dataset.ingredientIndex);
    
    if (isNaN(resultIndex) || isNaN(ingredientIndex)) return;

    const resultItems = item.system.toObject().resultItems || [];
    if (resultIndex >= resultItems.length) return;

    const currentIngredients = resultItems[resultIndex].requiredIngredients || [];
    resultItems[resultIndex].requiredIngredients = currentIngredients.filter((_, i) => i !== ingredientIndex);
    
    return item.update({ 'system.resultItems': resultItems });
  }

  /**
   * Handle changing a result item ingredient's image
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _changeResultIngredientImage(event, target) {
    event.preventDefault();
    const item = this.item;
    
    const resultIndex = parseInt(target.dataset.resultIndex);
    const ingredientIndex = parseInt(target.dataset.ingredientIndex);
    
    if (isNaN(resultIndex) || isNaN(ingredientIndex)) return;

    const resultItems = item.system.toObject().resultItems || [];
    if (resultIndex >= resultItems.length) return;

    const currentIngredients = resultItems[resultIndex].requiredIngredients || [];
    if (ingredientIndex >= currentIngredients.length) return;

    // Open file picker to select new image
    const fp = new foundry.applications.apps.FilePicker({
      type: "image",
      callback: (path) => {
        resultItems[resultIndex].requiredIngredients[ingredientIndex].img = path;
        item.update({ 'system.resultItems': resultItems });
      }
    });
    
    fp.render(true);
  }

  /**
   * Handle ingredient name changes for auto-search
   * @param {Event} event   The originating input event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onIngredientNameChange(event, target) {
    const item = this.item;
    
    // Check if this is a recipe type
    const recipeTypes = ['item-recipe', 'culinary-recipe', 'tailoring-recipe', 'tecnomagic-recipe', 'blacksmithing-recipe', 'alchemy-recipe'];
    if (!recipeTypes.includes(item.type)) return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const ingredientName = target.value.trim();
    
    // Only auto-fill if the name is at least 4 characters long (increased to reduce searches)
    if (ingredientName.length >= 4) {
      // Create a unique key for this item + index
      const timeoutKey = `${item.id}-${index}`;
      
      // Debounce the auto-fill to avoid too many requests
      clearTimeout(CardiganSystemItemSheet._ingredientSearchTimeouts.get(timeoutKey));
      const timeoutId = setTimeout(async () => {
        // Find the sheet instance for this item
        const sheet = Object.values(ui.windows).find(w => w.item?.id === item.id);
        if (sheet && sheet._autoFillIngredient) {
          await sheet._autoFillIngredient(ingredientName, index);
        }
      }, 800); // Increased debounce time to 800ms to reduce frequent searches
      
      CardiganSystemItemSheet._ingredientSearchTimeouts.set(timeoutKey, timeoutId);
    }
  }

  /**
   * Get profession from recipe type
   * @param {string} recipeType - The type of recipe
   * @returns {string} The corresponding profession
   * @protected
   */
  _getRecipeProfession(recipeType) {
    const professionMap = {
      'alchemy-recipe': 'alchemy',
      'blacksmithing-recipe': 'blacksmithing', 
      'culinary-recipe': 'culinary',
      'tailoring-recipe': 'tailoring',
      'tecnomagic-recipe': 'tecnomagic',
      'item-recipe': 'culinary' // Default recipes use culinary ingredients
    };
    
    return professionMap[recipeType] || 'culinary';
  }

  /* -------------------------------------------- */
  /*  INGREDIENT AUTO-UPDATE SYSTEM               */
  /* -------------------------------------------- */

  /**
   * Cache for ingredient search results
   * @type {Map<string, Array>}
   * @static
   */
  static _ingredientCache = new Map();

  /**
   * Timeout storage for debouncing ingredient searches
   * @type {Map<string, number>}
   * @static
   */
  static _ingredientSearchTimeouts = new Map();

  /**
   * Set of open recipe sheets for auto-update
   * @type {Set<CardiganSystemItemSheet>}
   * @static
   */
  static _openRecipeSheets = new Set();

  /**
   * Register this sheet for auto-updates if it's a recipe
   * @protected
   */
  _registerForAutoUpdates() {
    const recipeTypes = ['item-recipe', 'culinary-recipe', 'tailoring-recipe', 'tecnomagic-recipe', 'blacksmithing-recipe', 'alchemy-recipe'];
    if (recipeTypes.includes(this.item.type)) {
      CardiganSystemItemSheet._openRecipeSheets.add(this);
    }
  }

  /**
   * Unregister this sheet from auto-updates
   * @protected
   */
  _unregisterFromAutoUpdates() {
    CardiganSystemItemSheet._openRecipeSheets.delete(this);
  }

  /**
   * Auto-update all ingredients in this recipe
   * @protected
   */
  async _autoUpdateAllIngredients() {
    const currentIngredients = this.item.system.toObject().requiredIngredients || [];
    let hasChanges = false;
    const newIngredients = [...currentIngredients];
    const recipeProfession = this._getRecipeProfession(this.item.type);

    for (let i = 0; i < currentIngredients.length; i++) {
      const ingredient = currentIngredients[i];
      if (ingredient.name && ingredient.name.trim().length >= 3) {
        const matchingItems = await CardiganSystemItemSheet._searchItemsByName(ingredient.name, false, recipeProfession);
        if (matchingItems.length > 0) {
          const bestMatch = matchingItems[0];
          const newImg = bestMatch.img || 'systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg';
          
          if (newImg !== ingredient.img) {
            newIngredients[i] = {
              ...ingredient,
              img: newImg
            };
            hasChanges = true;
          }
        }
      }
    }

    if (hasChanges) {
      await this.item.update({ 'system.requiredIngredients': newIngredients });
    }
  }

  /**
   * Trigger auto-update for all open recipe sheets
   * @param {string} changedItemName - Name of the item that changed (optional)
   * @static
   */
  static async _triggerAutoUpdate(changedItemName = null) {
    // Clear cache to force fresh searches
    CardiganSystemItemSheet._ingredientCache.clear();
    
    // Debounce multiple rapid changes
    clearTimeout(CardiganSystemItemSheet._autoUpdateTimeout);
    CardiganSystemItemSheet._autoUpdateTimeout = setTimeout(async () => {
      
      for (const sheet of CardiganSystemItemSheet._openRecipeSheets) {
        try {
          await sheet._autoUpdateAllIngredients();
        } catch (error) {
          console.error('[CARDIGAN] Error auto-updating recipe:', error);
        }
      }
    }, 1000); // Wait 1 second to batch multiple changes
  }

  /**
   * Initialize hooks for monitoring item changes
   * @static
   */
  static _initializeAutoUpdateHooks() {
    if (CardiganSystemItemSheet._hooksInitialized) return;
    CardiganSystemItemSheet._hooksInitialized = true;

    // Monitor item creation in actors
    Hooks.on('createItem', (item, options, userId) => {
      CardiganSystemItemSheet._triggerAutoUpdate(item.name);
    });

    // Monitor item updates in actors and sidebar
    Hooks.on('updateItem', (item, changes, options, userId) => {
      if (changes.name || changes.img) {
        CardiganSystemItemSheet._triggerAutoUpdate(item.name);
      }
    });

    // Monitor item deletion
    Hooks.on('deleteItem', (item, options, userId) => {
      CardiganSystemItemSheet._triggerAutoUpdate(item.name);
    });

    // Monitor actor item changes (for inventory additions/removals)
    Hooks.on('updateActor', (actor, changes, options, userId) => {
      if (changes.items) {
        CardiganSystemItemSheet._triggerAutoUpdate();
      }
    });

  }

  // NOTE: Second _onRender() definition removed - consolidated at line ~3090

  /** @override */
  async close(options = {}) {
    this._unregisterFromAutoUpdates();
    this._cleanupTimeouts();
    return super.close(options);
  }

  /**
   * Clean up any pending timeouts to prevent memory leaks
   * @protected
   */
  _cleanupTimeouts() {
    // Clear any pending search timeouts for this item
    const itemId = this.item.id;
    for (const [key, timeoutId] of CardiganSystemItemSheet._ingredientSearchTimeouts.entries()) {
      if (key.startsWith(itemId)) {
        clearTimeout(timeoutId);
        CardiganSystemItemSheet._ingredientSearchTimeouts.delete(key);
      }
    }
  }

  /**
   * Override to process checkbox arrays correctly
   * @param {FormDataExtended} formData
   * @returns {Object}
   */
  // Removido _processFormData para permitir que ApplicationV2 salve automaticamente
  // A lógica de processamento de skillActionTypes foi movida para prepareData no modelo

  /**
   * CONSOLIDATED: Handle post-render operations
   * Combines drag-drop binding, auto-updates, and manual event listeners
   * @param {ApplicationRenderContext} context
   * @param {RenderOptions} options
   */
  _onRender(context, options) {
    super._onRender(context, options);

    // Mirror the type-specific root-class pattern used by other systems.
    this.element?.classList.toggle('item-type-armadura', this.item?.type === 'armadura');

    // Remove specific header controls for armor items only.
    // Run immediately and on next frame in case controls are attached after initial render.
    ArmorSheetBehavior.applyHeaderCleanup(this);
    requestAnimationFrame(() => ArmorSheetBehavior.applyHeaderCleanup(this));
    
    console.log("[ITEM-SHEET] _onRender CONSOLIDATED called for item type:", this.item.type);
    console.log("[ITEM-SHEET] Binding drag-drop handlers, count:", this.#dragDrop.length);
    console.log("[ITEM-SHEET] this.element exists:", !!this.element);
    
    // === DRAG-DROP BINDING (from first _onRender) ===
    // Check if drop zone exists (for recipes)
    if (this.item.type === 'item-recipe') {
      const dropZone = this.element.querySelector('[data-drop-zone="resultItems"]');
    }
    
    this.#dragDrop.forEach((d, index) => {
      console.log(`[ITEM-SHEET] Binding drag-drop handler ${index + 1}:`, {
        dragSelector: d.dragSelector,
        dropSelector: d.dropSelector
      });
      d.bind(this.element);
      console.log(`[ITEM-SHEET] Handler ${index + 1} bound successfully`);
    });
    
    // Setup mutually exclusive checkboxes for damage abilities
    this._setupMutuallyExclusiveCheckboxes();
    
    // Setup conditional visibility for weapon ammunition
    this._setupConditionalAmmunition();
    
    // Manual setup for ingredient buttons (fallback)
    this._setupIngredientListeners();
    
    // Setup conditional visibility for weapon protection
    this._setupConditionalProtection();
    
    // Setup mutually exclusive checkboxes for effect apply/remove
    this._setupEffectCheckboxes();
    
    // Setup skill effects configuration button
    this._setupSkillEffectsButton();
    
    // Setup skill check toggle visibility for consumable items
    this._setupSkillCheckToggle();
    
    // Setup effects toggle visibility for consumable items
    this._setupEffectsToggle();
    
    // Setup critical failure effects toggle visibility for consumable items
    this._setupCriticalFailureEffectsToggle();
    
    // Setup critical failure skill loss toggle visibility for consumable items
    this._setupCriticalFailureSkillLossToggle();
    
    // Setup critical hit effects toggle visibility for consumable items
    this._setupCriticalHitEffectsToggle();
    
    // Setup critical hit skill bonus toggle visibility for consumable items
    this._setupCriticalHitSkillBonusToggle();
    
    // Setup temporary skill bonus toggle visibility for consumable items
    this._setupTemporarySkillBonusToggle();
    
    // Setup health modifier toggle visibility for consumable items
    this._setupHealthModifierToggle();
    
    // Setup energy modifier toggle visibility for consumable items
    this._setupEnergyModifierToggle();
    
    // Setup armor bonus toggle visibility for consumable items  
    ArmorItemListeners.initialize(this);
    
    // Setup status ailments toggle visibility for consumable items
    this._setupStatusAilmentsToggle();
    
    // Setup food and water toggle visibility for consumable items
    this._setupFoodAndWaterToggle();
    
    // Setup movement boost toggle visibility for consumable items
    this._setupMovementBoostToggle();
    
    // Setup critical hit boost toggle visibility for consumable items
    this._setupCriticalHitBoostToggle();
    
    // Setup image resize in description editor
    this._setupDescriptionImageResize();
    
    // === AUTO-UPDATE HOOKS (from second _onRender) ===
    // Register for auto-updates and initialize hooks
    this._registerForAutoUpdates();
    CardiganSystemItemSheet._initializeAutoUpdateHooks();
    
    // === ENHANCEMENT BUTTONS (from third _onRender) ===
    // Add manual event listeners for enhancement configuration buttons
    const enhancementButtons = this.element.querySelectorAll('.enhancement-config-btn');
    enhancementButtons.forEach((button, index) => {
      button.addEventListener('click', (event) => {
        ui.notifications.info(`Manual Enhancement ${index + 1} clicked!`);
        
        // Call the appropriate configuration method
        switch(index) {
          case 0:
            this._configureEnhancement1(event, button);
            break;
          case 1:
            this._configureEnhancement2(event, button);
            break;
          case 2:
            this._configureEnhancement3(event, button);
            break;
        }
      });
    });
  }

}
