/**
 * Drag and Drop Actions Module
 * Manages all drag-and-drop behaviour for actor sheets:
 * drag permissions, drop routing, item/effect creation, stacking, sorting,
 * and the DragDrop handler factory.
 */
export class DragDropActions {

  /**
   * Define whether a user is able to begin a dragstart workflow for a given element.
   * @param {ActorSheet} sheet - The sheet instance
   * @returns {boolean}
   */
  static canDragStart(sheet) {
    return sheet.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given element.
   * @param {ActorSheet} sheet - The sheet instance
   * @returns {boolean}
   */
  static canDragDrop(sheet) {
    return sheet.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event - The originating DragEvent
   * @param {Actor} actor - The actor document
   */
  static onDragStart(event, actor) {
    const li = event.currentTarget;
    if ('link' in event.target.dataset) return;

    let dragData = null;

    // Active Effect
    if (li.dataset.effectId) {
      const effect = actor.effects.get(li.dataset.effectId);
      dragData = effect.toDragData();
    }

    // Owned Item
    else if (li.dataset.itemId) {
      const item = actor.items.get(li.dataset.itemId);
      dragData = item.toDragData();
    }

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event - The originating DragEvent
   * @param {Actor} actor - The actor document
   * @param {ActorSheet} sheet - The sheet instance (passed to the dropActorSheetData hook)
   */
  static async onDrop(event, actor, sheet) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    const allowed = Hooks.call('dropActorSheetData', actor, sheet, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case 'ActiveEffect':
        return DragDropActions.onDropActiveEffect(event, data, actor);
      case 'Actor':
        return DragDropActions.onDropActor(event, data, actor);
      case 'Item':
        return DragDropActions.onDropItem(event, data, actor);
      case 'Folder':
        return DragDropActions.onDropFolder(event, data, actor);
    }
  }

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet.
   * @param {DragEvent} event - The concluding DragEvent which contains drop data
   * @param {object} data - The data transfer extracted from the event
   * @param {Actor} actor - The actor document
   * @returns {Promise<ActiveEffect|boolean>}
   */
  static async onDropActiveEffect(event, data, actor) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!actor.isOwner || !effect) return false;
    if (effect.target === actor) return false;
    return aeCls.create(effect.toObject(), { parent: actor });
  }

  /**
   * Handle dropping of an Actor data onto another Actor sheet.
   * @param {DragEvent} event - The concluding DragEvent which contains drop data
   * @param {object} data - The data transfer extracted from the event
   * @param {Actor} actor - The actor document
   * @returns {Promise<object|boolean>}
   */
  static async onDropActor(event, data, actor) {
    if (!actor.isOwner) return false;
  }

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet.
   * @param {DragEvent} event - The concluding DragEvent which contains drop data
   * @param {object} data - The data transfer extracted from the event
   * @param {Actor} actor - The actor document
   * @returns {Promise<Item[]|boolean>}
   */
  static async onDropItem(event, data, actor) {
    if (!actor.isOwner) return false;
    const item = await Item.implementation.fromDropData(data);

    // Handle item sorting within the same Actor
    if (actor.uuid === item.parent?.uuid) return DragDropActions.onSortItem(event, item, actor);

    // Create the owned item
    return DragDropActions.onDropItemCreate(item, event, actor);
  }

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * @param {DragEvent} event - The concluding DragEvent which contains drop data
   * @param {object} data - The data transfer extracted from the event
   * @param {Actor} actor - The actor document
   * @returns {Promise<Item[]>}
   */
  static async onDropFolder(event, data, actor) {
    if (!actor.isOwner) return [];
    const folder = await Folder.implementation.fromDropData(data);
    if (folder.type !== 'Item') return [];
    const droppedItemData = await Promise.all(
      folder.contents.map(async (item) => {
        if (!(document instanceof Item)) item = await fromUuid(item.uuid);
        return item.toObject();
      })
    );
    return DragDropActions.onDropItemCreate(droppedItemData, event, actor);
  }

  /**
   * Handle the final creation of dropped Item data on the Actor.
   * Handles race replacement, racial skill injection, and item stacking.
   * @param {object[]|object} itemData - The item data requested for creation
   * @param {DragEvent} event - The concluding DragEvent which provided the drop data
   * @param {Actor} actor - The actor document
   * @returns {Promise<Item[]>}
   */
  static async onDropItemCreate(itemData, event, actor) {
    itemData = itemData instanceof Array ? itemData : [itemData];
    itemData = itemData.map((item) => {
      if (item?.toObject instanceof Function) return item.toObject();
      return foundry.utils.deepClone(item);
    });

    // Special handling for race items - only one race allowed
    const raceItems = itemData.filter(item => item.type === 'race');
    if (raceItems.length > 0) {
      // Remove any existing race item
      const existingRace = actor.items.find(i => i.type === 'race');
      if (existingRace) {
        await existingRace.delete();
        ui.notifications.info(`Raça anterior "${existingRace.name}" foi substituída`);
      }

      // Add racial skills automatically
      for (const raceItem of raceItems) {
        const racialSkills = raceItem.system?.racialSkills || [];

        if (racialSkills.length > 0) {
          console.log('[CARDIGAN] Adding racial skills:', racialSkills.length);

          const skillsToAdd = [];

          for (const skillRef of racialSkills) {
            try {
              // Try to get the skill from UUID
              let skillDoc = null;
              if (skillRef.uuid) {
                skillDoc = await fromUuid(skillRef.uuid);
              }

              // If not found by UUID, try to find in compendium by ID
              if (!skillDoc && skillRef.id) {
                const pack = game.packs.get("cardigan.skills-cardigan");
                if (pack) {
                  skillDoc = await pack.getDocument(skillRef.id);
                }
              }

              if (skillDoc) {
                // Check if skill already exists on actor
                const existingSkill = actor.items.find(i =>
                  i.type === 'skill' && i.name === skillDoc.name
                );

                if (!existingSkill) {
                  skillsToAdd.push(skillDoc.toObject());
                  console.log('[CARDIGAN] Will add racial skill:', skillDoc.name);
                } else {
                  console.log('[CARDIGAN] Skill already exists:', skillDoc.name);
                }
              } else {
                console.warn('[CARDIGAN] Could not find skill:', skillRef.name || skillRef.id);
              }
            } catch (error) {
              console.error('[CARDIGAN] Error loading racial skill:', error);
            }
          }

          // Add all racial skills
          if (skillsToAdd.length > 0) {
            await actor.createEmbeddedDocuments('Item', skillsToAdd);
            ui.notifications.info(`${skillsToAdd.length} skill(s) racial(is) adicionada(s)`);
          }
        }
      }
    }

    const stackableTypes = new Set(['item-comum', 'item-municao', 'item-consumivel', 'item-ingredient', 'arma', 'armadura']);
    const quantityUpdates = [];
    const itemsToCreate = [];

    for (const droppedData of itemData) {
      if (!stackableTypes.has(droppedData?.type)) {
        itemsToCreate.push(droppedData);
        continue;
      }

      if (!droppedData.system || typeof droppedData.system !== 'object') {
        droppedData.system = {};
      }

      const minQuantity = ['arma', 'armadura'].includes(droppedData.type) ? 1 : 0;
      const quantityToAdd = Math.max(minQuantity, Number(droppedData.system.quantity ?? 1) || 0);
      droppedData.system.quantity = quantityToAdd;

      const existingItem = actor.items.find((item) => {
        if (item.type !== droppedData.type) return false;
        if (item.name !== droppedData.name) return false;
        return DragDropActions.canStackDroppedItem(item, droppedData);
      });

      if (!existingItem) {
        itemsToCreate.push(droppedData);
        continue;
      }

      const currentQuantity = Number(existingItem.system?.quantity ?? (minQuantity || 1)) || 0;
      const newQuantity = Math.max(minQuantity, currentQuantity + quantityToAdd);

      quantityUpdates.push({
        _id: existingItem.id,
        'system.quantity': newQuantity
      });
    }

    let updatedItems = [];
    if (quantityUpdates.length > 0) {
      await actor.updateEmbeddedDocuments('Item', quantityUpdates);
      updatedItems = quantityUpdates
        .map((update) => actor.items.get(update._id))
        .filter(Boolean);
    }

    const createdItems = itemsToCreate.length > 0
      ? await actor.createEmbeddedDocuments('Item', itemsToCreate)
      : [];

    return [...updatedItems, ...createdItems];
  }

  /**
   * Determine whether a dropped item can stack with an existing owned item.
   * @param {Item} existingItem
   * @param {object} droppedItemData
   * @returns {boolean}
   */
  static canStackDroppedItem(existingItem, droppedItemData) {
    if (!existingItem || !droppedItemData) return false;

    // Never stack equipped gear
    if (existingItem.type === 'arma') {
      if (existingItem.system?.isUnarmed) return false;
      if (existingItem.system?.rightHand || existingItem.system?.leftHand || existingItem.system?.equipped) return false;
    }

    if (existingItem.type === 'armadura' && existingItem.system?.equipped) {
      return false;
    }

    // Prefer matching compendium sourceId when available
    const existingSourceId = existingItem.flags?.core?.sourceId;
    const droppedSourceId = droppedItemData.flags?.core?.sourceId;

    if (existingSourceId && droppedSourceId) {
      return existingSourceId === droppedSourceId;
    }

    return true;
  }

  /**
   * Handle a drop event for an existing embedded Item to sort that Item relative to its siblings.
   * @param {Event} event - The originating event
   * @param {Item} item - The item being sorted
   * @param {Actor} actor - The actor document
   */
  static onSortItem(event, item, actor) {
    // Get the drag source and drop target
    const items = actor.items;
    const source = items.get(item.id);
    const dropTarget = event.target.closest('[data-item-id]');
    if (!dropTarget) return;
    const target = items.get(dropTarget.dataset.itemId);

    // Don't sort on yourself
    if (source.id === target.id) return;

    // Identify sibling items based on type and parent
    const siblings = items.filter((i) => {
      return i.type === source.type && i.parent === source.parent;
    });

    // Perform the sort
    const sortUpdates = SortingHelpers.performIntegerSort(source, {
      target,
      siblings,
    });
    const updateData = sortUpdates.map((u) => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return actor.updateEmbeddedDocuments('Item', updateData);
  }

  /**
   * Creates drag & drop handlers for a sheet instance.
   * @param {ActorSheet} sheet - The sheet instance to create handlers for
   * @returns {foundry.applications.ux.DragDrop[]} An array of DragDrop handlers
   */
  static createHandlers(sheet) {
    return sheet.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: sheet._canDragStart.bind(sheet),
        drop: sheet._canDragDrop.bind(sheet),
      };
      d.callbacks = {
        dragstart: sheet._onDragStart.bind(sheet),
        dragover: sheet._onDragOver.bind(sheet),
        drop: sheet._onDrop.bind(sheet),
      };
      return new foundry.applications.ux.DragDrop(d);
    });
  }

}
