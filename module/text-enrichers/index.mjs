import { ROLL_CHECK_ENRICHER } from './roll-check-enricher.mjs';
import { handleRollEnricherClick } from './roll-enricher-actions.mjs';

/**
 * Registers the `@Teste[...]`/`@Pericia[...]` text enricher and its delegated click
 * handler. Called once from cardigan.mjs's `setup` hook, alongside the `::img::` enricher.
 */
export function initializeRollEnrichers() {
  CONFIG.TextEditor.enrichers.push(ROLL_CHECK_ENRICHER);
  document.addEventListener('click', handleRollEnricherClick);
}
