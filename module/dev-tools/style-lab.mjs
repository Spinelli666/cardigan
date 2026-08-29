// [STYLELAB] Ferramenta de desenvolvimento TEMPORÁRIA para inspecionar e ajustar
// visualmente estilos da ficha direto no Foundry, sem tocar nos arquivos .scss.
// Nada aqui é persistido: é só um <style> injetado em memória, que some ao recarregar.
//
// Como usar:
//   botão flutuante 🖌 (canto inferior esquerdo, só visível pro GM) -> abre/fecha
//   game.cardigan.styleLab.open()             -> mesma coisa, via console
//   Ctrl+Shift+L                               -> atalho para abrir/fechar
//   Esc                                        -> cancela seleção / fecha o painel
//
// Como remover esta ferramenta no futuro:
//   1. Apague este arquivo (module/dev-tools/style-lab.mjs).
//   2. Remova as linhas marcadas com "[STYLELAB]" em module/cardigan.mjs.

const UI_CLASS = 'cardigan-style-lab-ui';
const PSEUDO_ELEMENT_RE = /::?(before|after|placeholder|selection|first-line|first-letter|marker)\b/gi;
// :hover/:active/:focus só "batem" via matches() se o mouse estiver de fato sobre o elemento
// nesse instante. Removemos isso pra achar essas regras mesmo sem estar hovering agora.
const PSEUDO_STATE_RE = /:(hover|active|focus(-visible|-within)?)\b/gi;

// Propriedades mostradas no bloco "estilo computado", que funciona mesmo quando
// a leitura das stylesheets de origem falha (ex.: stylesheet cross-origin).
const FALLBACK_PROPS = [
  'width',
  'height',
  'background-color',
  'background-image',
  'color',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'box-shadow',
  'padding',
  'margin',
  'font-size',
  'opacity',
];

// Retransmite os overrides pra outros clientes conectados (efêmero, mesmo canal
// de socket usado por trade/combate). Cada cliente aplica num <style> próprio.
const SOCKET_CHANNEL = 'system.cardigan';
const SOCKET_ACTION = 'styleLabSync';

// Nomes amigáveis em pt-BR pras propriedades mais comuns — pra quem não lê CSS no dia a dia.
// O nome técnico continua disponível no title (tooltip) do campo.
const PROP_LABELS = {
  width: 'Largura',
  height: 'Altura',
  'min-width': 'Largura mínima',
  'min-height': 'Altura mínima',
  'max-width': 'Largura máxima',
  'max-height': 'Altura máxima',
  'background-color': 'Cor de fundo',
  'background-image': 'Imagem/gradiente de fundo',
  background: 'Fundo',
  color: 'Cor do texto',
  'border-color': 'Cor da borda',
  'border-width': 'Espessura da borda',
  'border-style': 'Estilo da borda',
  'border-radius': 'Arredondamento',
  'box-shadow': 'Sombra',
  filter: 'Filtro/sombra de imagem',
  padding: 'Espaço interno',
  margin: 'Espaço externo',
  gap: 'Espaço entre itens',
  'font-size': 'Tamanho do texto',
  'font-weight': 'Peso do texto (negrito)',
  opacity: 'Transparência',
};

// Agrupamento de propriedades em categorias amigáveis, na ordem em que aparecem no painel.
const PROP_CATEGORIES = [
  { label: 'Tamanho', match: ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'] },
  { label: 'Fundo', match: ['background', 'background-color', 'background-image', 'background-position', 'background-size', 'background-repeat'] },
  { label: 'Texto', match: ['color', 'font-size', 'font-weight', 'font-family', 'text-shadow', 'text-align', 'text-transform', 'line-height'] },
  { label: 'Borda', match: ['border', 'border-color', 'border-width', 'border-style', 'border-radius'] },
  { label: 'Sombra', match: ['box-shadow', 'filter'] },
  { label: 'Espaçamento', match: ['padding', 'margin', 'gap'] },
  { label: 'Efeitos', match: ['opacity', 'transform', 'transition', 'animation', 'cursor', 'will-change'] },
];
const CATEGORY_ORDER = [...PROP_CATEGORIES.map((c) => c.label), 'Outros'];
const COLOR_PROPS = new Set(['background', 'background-color', 'background-image', 'color', 'border-color']);

function friendlyLabel(prop) {
  return PROP_LABELS[prop] || prop;
}

function categorizeProp(prop) {
  for (const cat of PROP_CATEGORIES) {
    if (cat.match.some((m) => prop === m || prop.startsWith(`${m}-`))) return cat.label;
  }
  return 'Outros';
}

let picking = false;
let overlayEl = null;
let panelEl = null;
let overrideStyleEl = null;
let remoteStyleEl = null;
let uiStyleEl = null;
let launcherEl = null;
let currentElement = null;

/** @type {Map<string, Map<string, string>>} selector -> (property -> value) */
const overrides = new Map();

/* -------------------------------------------- */
/*  Base UI styles / override style tag         */
/* -------------------------------------------- */

function ensureUiStyles() {
  if (uiStyleEl) return;
  uiStyleEl = document.createElement('style');
  uiStyleEl.id = 'cardigan-style-lab-ui-css';
  uiStyleEl.textContent = `
    .style-lab-overlay {
      position: fixed;
      z-index: 100000;
      pointer-events: none;
      border: 2px solid #43AADA;
      background: rgba(67, 170, 218, 0.15);
      display: none;
      box-sizing: border-box;
    }
    body.cardigan-style-lab-picking { cursor: crosshair !important; }
    .style-lab-panel {
      position: fixed;
      top: 40px;
      left: calc(100vw - 520px);
      width: 480px;
      height: 70vh;
      min-width: 340px;
      min-height: 220px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
      resize: both;
      background: #1e1e1e;
      color: #ddd;
      border: 1px solid #444;
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      z-index: 100001;
      font-family: 'Segoe UI', sans-serif;
      font-size: 12px;
    }
    .style-lab-panel * { box-sizing: border-box; }
    .style-lab-header {
      padding: 8px 10px;
      background: #2a2a2a;
      border-bottom: 1px solid #444;
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: sticky;
      top: 0;
      cursor: move;
      user-select: none;
      touch-action: none;
    }
    .style-lab-title { font-weight: bold; color: #FFB75C; word-break: break-all; }
    .style-lab-actions { display: flex; gap: 4px; flex-wrap: wrap; }
    .style-lab-actions button {
      flex: 1 1 auto;
      background: #333;
      color: #ddd;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 4px 6px;
      cursor: pointer;
      font-size: 11px;
    }
    .style-lab-actions button:hover { background: #444; }
    .style-lab-rule { border-bottom: 1px solid #333; }
    .style-lab-rule summary {
      padding: 6px 10px;
      cursor: pointer;
      font-family: monospace;
      color: #7fd7ff;
      word-break: break-all;
    }
    .style-lab-state-badge {
      display: inline-block;
      background: #4a3a1a;
      color: #FFB75C;
      border: 1px solid #c0863b;
      border-radius: 3px;
      padding: 0 4px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .style-lab-props { padding: 4px 10px 8px; display: flex; flex-direction: column; gap: 4px; }
    .style-lab-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
    .style-lab-group-heading {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #c0863b;
      font-weight: bold;
      margin-top: 4px;
    }
    .style-lab-swatch {
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      border-radius: 3px;
      border: 1px solid #666;
      background: #3a3a3a; /* preenchido via JS com o valor real (cor/gradiente) */
    }
    .style-lab-prop-row { display: flex; align-items: center; gap: 4px; }
    .style-lab-prop-row label {
      flex: 0 0 auto;
      width: 110px;
      color: #999;
      font-family: monospace;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .style-lab-prop-row input {
      flex: 1 1 auto;
      background: #111;
      color: #eee;
      border: 1px solid #444;
      border-radius: 3px;
      padding: 2px 4px;
      font-family: monospace;
      font-size: 11px;
    }
    .style-lab-prop-row button { flex: 0 0 auto; background: transparent; color: #d66; border: none; cursor: pointer; }
    .style-lab-add-row { display: flex; gap: 4px; margin-top: 4px; }
    .style-lab-add-row input {
      flex: 1 1 auto;
      background: #111;
      color: #eee;
      border: 1px solid #444;
      border-radius: 3px;
      padding: 2px 4px;
      font-family: monospace;
      font-size: 11px;
    }
    .style-lab-add-row button {
      flex: 0 0 auto;
      background: #2f5233;
      color: #cfc;
      border: 1px solid #4a7;
      border-radius: 3px;
      cursor: pointer;
      padding: 2px 6px;
    }
    .style-lab-empty { padding: 10px; color: #888; font-style: italic; }
    .style-lab-launcher {
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #2a2a2a;
      border: 2px solid #c0863b;
      color: #FFB75C;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .style-lab-launcher:hover { filter: brightness(1.2); transform: scale(1.05); }
    .style-lab-launcher.active { background: #3a2a1a; border-color: #43AADA; color: #43AADA; }
  `;
  document.head.appendChild(uiStyleEl);
}

function ensureOverrideStyleTag() {
  if (overrideStyleEl) return;
  overrideStyleEl = document.createElement('style');
  overrideStyleEl.id = 'cardigan-style-lab-overrides';
  document.head.appendChild(overrideStyleEl);
}

function ensureRemoteStyleTag() {
  if (remoteStyleEl) return;
  remoteStyleEl = document.createElement('style');
  remoteStyleEl.id = 'cardigan-style-lab-remote-overrides';
  document.head.appendChild(remoteStyleEl);
}

function broadcastOverrides() {
  if (!game.socket) return;
  game.socket.emit(SOCKET_CHANNEL, {
    action: SOCKET_ACTION,
    css: buildOverrideCss(),
    userName: game.user?.name ?? 'Alguém',
  });
}

/** Registrar no hook 'ready' — recebe os overrides de outros clientes e aplica localmente. */
export function registerStyleLabSocket() {
  if (!game.socket) return;
  game.socket.on(SOCKET_CHANNEL, (data) => {
    if (data?.action !== SOCKET_ACTION) return;
    ensureRemoteStyleTag();
    remoteStyleEl.textContent = data.css ?? '';
    if (data.css) {
      ui.notifications?.info(`StyleLab: ${data.userName} atualizou um estilo (só nesta sessão).`);
    }
  });
}

/* -------------------------------------------- */
/*  Element picking                              */
/* -------------------------------------------- */

function isOwnUi(el) {
  return !!(el && el.closest && el.closest(`.${UI_CLASS}`));
}

function ensureOverlayEl() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.className = `${UI_CLASS} style-lab-overlay`;
  document.body.appendChild(overlayEl);
}

function showOverlayFor(el) {
  ensureOverlayEl();
  const rect = el.getBoundingClientRect();
  overlayEl.style.display = 'block';
  overlayEl.style.top = `${rect.top}px`;
  overlayEl.style.left = `${rect.left}px`;
  overlayEl.style.width = `${rect.width}px`;
  overlayEl.style.height = `${rect.height}px`;
}

function hideOverlay() {
  if (overlayEl) overlayEl.style.display = 'none';
}

function onMouseMove(event) {
  if (!picking) return;
  const el = event.target;
  if (isOwnUi(el)) {
    hideOverlay();
    return;
  }
  showOverlayFor(el);
}

function onClick(event) {
  if (!picking) return;
  const el = event.target;
  if (isOwnUi(el)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  stopPicking();
  selectElement(el);
}

function onKeyDown(event) {
  if (event.key !== 'Escape') return;
  if (picking) stopPicking();
  else close();
}

function startPicking() {
  ensureUiStyles();
  picking = true;
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.body.classList.add('cardigan-style-lab-picking');
  ui.notifications?.info('StyleLab: clique em um elemento da ficha para inspecionar (Esc cancela).');
}

function stopPicking() {
  picking = false;
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  document.body.classList.remove('cardigan-style-lab-picking');
  hideOverlay();
}

/* -------------------------------------------- */
/*  Matching CSS rules for a given element       */
/* -------------------------------------------- */

function elementMatchesSelector(el, selectorText) {
  try {
    if (el.matches(selectorText)) return true;
  } catch (err) {
    // Selector contém algo que matches() não avalia (ex.: pseudo-elemento) - cai pro strip abaixo
  }
  // Sem hover/active/focus reais agora: testa de novo ignorando esses estados e pseudo-elementos,
  // pra achar regras condicionais (:hover etc.) mesmo sem o mouse em cima do elemento.
  const stripped = selectorText.replace(PSEUDO_ELEMENT_RE, '').replace(PSEUDO_STATE_RE, '').trim();
  if (!stripped) return false;
  try {
    return el.matches(stripped);
  } catch (err) {
    return false;
  }
}

function collectMatches(ruleList, el, out) {
  for (const rule of Array.from(ruleList)) {
    if (rule.cssRules) {
      collectMatches(rule.cssRules, el, out);
      continue;
    }
    if (!rule.selectorText || !rule.style) continue;
    if (elementMatchesSelector(el, rule.selectorText)) out.push(rule);
  }
}

function getMatchedRules(el) {
  const matched = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch (err) {
      console.warn('[STYLELAB] Não foi possível ler regras desta stylesheet (provável cross-origin):', sheet.href, err);
      continue;
    }
    if (!rules) continue;
    try {
      collectMatches(rules, el, matched);
    } catch (err) {
      console.warn('[STYLELAB] Erro ao casar seletor nesta stylesheet:', sheet.href, err);
    }
  }
  return matched;
}

/**
 * Seletor único (caminho tag[.classes][:nth-of-type] até o <body>, ou #id se achar
 * um ancestral com id) usado pelo bloco de "estilo computado" — garante que o override
 * bata só no elemento exato que foi clicado, não em todo mundo que compartilha tag/classe
 * (ex.: um <img> de ícone sem classe própria, que sozinho bateria em toda <img> da ficha).
 */
function buildUniqueSelector(el) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const classes = typeof node.className === 'string'
      ? node.className.trim().split(/\s+/).filter(Boolean)
      : [];
    if (classes.length) part += '.' + classes.map((c) => CSS.escape(c)).join('.');
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(' > ');
}

/* -------------------------------------------- */
/*  Overrides                                    */
/* -------------------------------------------- */

function applyOverride(selector, prop, value) {
  if (!prop || !value) return;
  ensureOverrideStyleTag();
  if (!overrides.has(selector)) overrides.set(selector, new Map());
  overrides.get(selector).set(prop, value);
  rebuildOverrideStyle();
}

function removeOverride(selector, prop) {
  const props = overrides.get(selector);
  if (!props) return;
  props.delete(prop);
  if (props.size === 0) overrides.delete(selector);
  rebuildOverrideStyle();
}

function buildOverrideCss() {
  let css = '';
  for (const [selector, props] of overrides) {
    css += `${selector} {\n`;
    for (const [prop, value] of props) css += `  ${prop}: ${value} !important;\n`;
    css += `}\n\n`;
  }
  return css;
}

function rebuildOverrideStyle() {
  ensureOverrideStyleTag();
  overrideStyleEl.textContent = buildOverrideCss();
  broadcastOverrides();
}

function resetOverrides() {
  overrides.clear();
  rebuildOverrideStyle();
  if (panelEl && currentElement) renderPanel(currentElement, getMatchedRules(currentElement));
}

function buildReadableCss() {
  let css = '';
  for (const [selector, props] of overrides) {
    css += `${selector} {\n`;
    for (const [prop, value] of props) css += `  ${prop}: ${value};\n`;
    css += `}\n\n`;
  }
  return css.trim();
}

async function copyCss() {
  const css = buildReadableCss();
  if (!css) {
    ui.notifications?.warn('StyleLab: nenhuma alteração para copiar.');
    return;
  }
  try {
    await navigator.clipboard.writeText(css);
    ui.notifications?.info('StyleLab: CSS copiado para a área de transferência.');
  } catch (err) {
    console.warn('[STYLELAB] Falha ao copiar para a área de transferência, veja o console.', err);
    console.log(css);
    ui.notifications?.warn('StyleLab: não foi possível copiar automaticamente, veja o console (F12).');
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Manda o CSS acumulado como sussurro pro GM no chat do Foundry — fica registrado no log,
 * não depende de quem tá online agora nem de colar em outro app (Discord etc.). */
async function sendToChat() {
  const css = buildReadableCss();
  if (!css) {
    ui.notifications?.warn('StyleLab: nenhuma alteração para enviar.');
    return;
  }
  const target = currentElement ? describeElement(currentElement) : 'elemento não identificado';
  const content = `
    <p><strong>StyleLab</strong> — ajustes de <strong>${escapeHtml(game.user?.name ?? 'alguém')}</strong> em <code>${escapeHtml(target)}</code>:</p>
    <pre><code>${escapeHtml(css)}</code></pre>
  `;
  const whisperIds = ChatMessage.getWhisperRecipients('GM').map((u) => u.id);
  await ChatMessage.create({
    content,
    whisper: whisperIds.length ? whisperIds : undefined,
    speaker: { alias: 'StyleLab' },
  });
  ui.notifications?.info('StyleLab: CSS enviado pro chat (sussurro pro GM).');
}

/* -------------------------------------------- */
/*  Panel rendering                              */
/* -------------------------------------------- */

function describeElement(el) {
  const id = el.id ? `#${el.id}` : '';
  const classes = typeof el.className === 'string' && el.className.trim()
    ? '.' + el.className.trim().split(/\s+/).join('.')
    : '';
  return `${el.tagName.toLowerCase()}${id}${classes}`;
}

function makeButton(label, onClick, title) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  if (title) btn.title = title;
  btn.addEventListener('click', onClick);
  return btn;
}

function currentValue(selector, prop, rule) {
  const override = overrides.get(selector)?.get(prop);
  return override !== undefined ? override : rule.style.getPropertyValue(prop);
}

function renderPropRow(selector, prop, value) {
  const row = document.createElement('div');
  row.className = 'style-lab-prop-row';

  let swatch = null;
  if (COLOR_PROPS.has(prop)) {
    swatch = document.createElement('span');
    swatch.className = 'style-lab-swatch';
    swatch.style.background = value;
    row.appendChild(swatch);
  }

  const label = document.createElement('label');
  label.textContent = friendlyLabel(prop);
  label.title = prop; // nome técnico real, pra quem já conhece CSS

  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('input', () => {
    if (swatch) swatch.style.background = input.value;
  });
  input.addEventListener('change', () => applyOverride(selector, prop, input.value.trim()));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
  });

  const clearBtn = makeButton('✕', () => {
    removeOverride(selector, prop);
    if (currentElement) renderPanel(currentElement, getMatchedRules(currentElement));
  }, 'Remover override');

  row.append(label, input, clearBtn);
  return row;
}

/** Agrupa {prop, value} em categorias amigáveis e devolve os blocos prontos pra inserir no painel. */
function renderPropsGrouped(selector, pairs) {
  const groups = new Map();
  for (const { prop, value } of pairs) {
    const cat = categorizeProp(prop);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({ prop, value });
  }

  const fragment = document.createDocumentFragment();
  for (const label of CATEGORY_ORDER) {
    if (!groups.has(label)) continue;
    const groupEl = document.createElement('div');
    groupEl.className = 'style-lab-group';
    const heading = document.createElement('div');
    heading.className = 'style-lab-group-heading';
    heading.textContent = label;
    groupEl.appendChild(heading);
    for (const { prop, value } of groups.get(label)) {
      groupEl.appendChild(renderPropRow(selector, prop, value));
    }
    fragment.appendChild(groupEl);
  }
  return fragment;
}

function describeSelectorState(selectorText) {
  const tags = [];
  if (/:hover\b/i.test(selectorText)) tags.push('hover');
  if (/:active\b/i.test(selectorText)) tags.push('active');
  if (/:focus(-visible|-within)?\b/i.test(selectorText)) tags.push('focus');
  return tags.length ? `[${tags.join('+')}] ` : '';
}

function renderRuleBlock(rule, openByDefault) {
  const selector = rule.selectorText;
  const details = document.createElement('details');
  details.className = 'style-lab-rule';
  details.open = openByDefault;

  const summary = document.createElement('summary');
  const stateTag = describeSelectorState(selector);
  if (stateTag) {
    const badge = document.createElement('span');
    badge.className = 'style-lab-state-badge';
    badge.textContent = stateTag.trim();
    summary.append(badge, ` ${selector}`);
  } else {
    summary.textContent = selector;
  }
  details.appendChild(summary);

  const propsWrap = document.createElement('div');
  propsWrap.className = 'style-lab-props';

  const pairs = [];
  for (let i = 0; i < rule.style.length; i++) {
    const prop = rule.style[i];
    pairs.push({ prop, value: currentValue(selector, prop, rule) });
  }
  propsWrap.appendChild(renderPropsGrouped(selector, pairs));

  const addRow = document.createElement('div');
  addRow.className = 'style-lab-add-row';
  const propInput = document.createElement('input');
  propInput.placeholder = 'propriedade';
  const valueInput = document.createElement('input');
  valueInput.placeholder = 'valor';
  const addBtn = makeButton('+', () => {
    const prop = propInput.value.trim();
    const value = valueInput.value.trim();
    if (!prop || !value) return;
    applyOverride(selector, prop, value);
    if (currentElement) renderPanel(currentElement, getMatchedRules(currentElement));
  }, 'Adicionar propriedade');
  addRow.append(propInput, valueInput, addBtn);
  propsWrap.appendChild(addRow);

  details.appendChild(propsWrap);
  return details;
}

function renderFallbackBlock(el, openByDefault) {
  const selector = buildUniqueSelector(el);
  const computed = getComputedStyle(el);

  const details = document.createElement('details');
  details.className = 'style-lab-rule';
  details.open = openByDefault;

  const summary = document.createElement('summary');
  summary.textContent = `[estilo computado — só este elemento] ${selector}`;
  details.appendChild(summary);

  const propsWrap = document.createElement('div');
  propsWrap.className = 'style-lab-props';

  const pairs = FALLBACK_PROPS.map((prop) => ({ prop, value: currentValue(selector, prop, { style: computed }) }));
  propsWrap.appendChild(renderPropsGrouped(selector, pairs));

  const addRow = document.createElement('div');
  addRow.className = 'style-lab-add-row';
  const propInput = document.createElement('input');
  propInput.placeholder = 'propriedade';
  const valueInput = document.createElement('input');
  valueInput.placeholder = 'valor';
  const addBtn = makeButton('+', () => {
    const prop = propInput.value.trim();
    const value = valueInput.value.trim();
    if (!prop || !value) return;
    applyOverride(selector, prop, value);
    if (currentElement) renderPanel(currentElement, getMatchedRules(currentElement));
  }, 'Adicionar propriedade');
  addRow.append(propInput, valueInput, addBtn);
  propsWrap.appendChild(addRow);

  details.appendChild(propsWrap);
  return details;
}

function closePanel() {
  panelEl?.remove();
  panelEl = null;
}

/** Arrasta o painel pelo header, igual aos dialogs nativos do Foundry. */
function makeDraggable(panel, handle) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const maxLeft = window.innerWidth - 60;
    const maxTop = window.innerHeight - 40;
    const newLeft = Math.max(0, Math.min(startLeft + (event.clientX - startX), maxLeft));
    const newTop = Math.max(0, Math.min(startTop + (event.clientY - startY), maxTop));
    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
  });

  const stopDrag = (event) => {
    dragging = false;
    try { handle.releasePointerCapture(event.pointerId); } catch (err) { /* já liberado */ }
  };
  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
}

function renderPanel(el, rules) {
  closePanel();
  ensureUiStyles();

  panelEl = document.createElement('div');
  panelEl.className = `${UI_CLASS} style-lab-panel`;

  const header = document.createElement('div');
  header.className = 'style-lab-header';

  const title = document.createElement('div');
  title.className = 'style-lab-title';
  title.textContent = describeElement(el);
  header.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'style-lab-actions';
  actions.appendChild(makeButton('Escolher outro', () => { closePanel(); startPicking(); }));
  actions.appendChild(makeButton('Resetar', () => resetOverrides()));
  actions.appendChild(makeButton('Copiar CSS', () => copyCss()));
  actions.appendChild(makeButton('Enviar pro chat', () => sendToChat(), 'Manda o CSS acumulado como sussurro pro GM'));
  actions.appendChild(makeButton('Fechar', () => close()));
  header.appendChild(actions);

  panelEl.appendChild(header);
  makeDraggable(panelEl, header);

  if (!rules.length) {
    const empty = document.createElement('div');
    empty.className = 'style-lab-empty';
    empty.textContent = 'Nenhuma regra de origem encontrada (veja o console F12) — use o estilo computado abaixo.';
    panelEl.appendChild(empty);
  } else {
    rules.forEach((rule, index) => panelEl.appendChild(renderRuleBlock(rule, index === 0)));
  }

  panelEl.appendChild(renderFallbackBlock(el, rules.length === 0));

  document.body.appendChild(panelEl);
}

function selectElement(el) {
  currentElement = el;
  renderPanel(el, getMatchedRules(el));
}

/* -------------------------------------------- */
/*  Public API                                   */
/* -------------------------------------------- */

function updateLauncherState() {
  if (!launcherEl) return;
  launcherEl.classList.toggle('active', picking || !!panelEl);
}

function open() {
  closePanel();
  startPicking();
  updateLauncherState();
}

function close() {
  stopPicking();
  closePanel();
  updateLauncherState();
}

function toggle() {
  if (panelEl || picking) close();
  else open();
}

/**
 * Botão flutuante fixo (independente do header das janelas do Foundry, que neste
 * projeto tem CSS customizado/frágil pra esconder controles em telas minimizadas).
 * Chamar no hook 'ready'; só cria o botão para o GM.
 */
export function mountStyleLabLauncher() {
  if (!game.user?.isGM || launcherEl) return;
  ensureUiStyles();
  launcherEl = document.createElement('button');
  launcherEl.type = 'button';
  launcherEl.className = `${UI_CLASS} style-lab-launcher`;
  launcherEl.title = 'StyleLab (dev) — Ctrl+Shift+L';
  launcherEl.textContent = '🖌';
  launcherEl.addEventListener('click', () => toggle());
  document.body.appendChild(launcherEl);
}

export const CardiganStyleLab = { open, close, toggle, resetOverrides };

export function registerStyleLabKeybinding() {
  if (!game.keybindings) return;
  game.keybindings.register('cardigan', 'toggleStyleLab', {
    name: '[STYLELAB] Alternar StyleLab',
    hint: 'Ferramenta temporária de inspeção/edição de estilos ao vivo (nada é salvo).',
    editable: [{ key: 'KeyL', modifiers: ['Control', 'Shift'] }],
    onDown: () => toggle(),
  });
}
