import { copy as text } from './copy.mjs';
const requestCard = document.querySelector('#request-card');
const requestLabel = document.querySelector('#request-label');
const requestTime = document.querySelector('#request-time');
const status = document.querySelector('#status');
const refresh = document.querySelector('#refresh');
const preview = document.querySelector('#preview');
async function load(path) {
  const isPreview = path === '/api/order-preview';
  refresh.disabled = true;
  preview.disabled = true;
  requestCard.className = 'request-card is-loading';
  requestCard.setAttribute('aria-busy', 'true');
  requestLabel.textContent = isPreview ? text('storefront', 'building_order_preview') : text('storefront', 'checking_availability');
  requestTime.textContent = text('storefront', 'ms');
  status.textContent = text('storefront', 'waiting_for_the_service');
  const started = performance.now();
  try {
    const response = await fetch(path, { cache: 'no-store' });
    const data = await response.json();
    const elapsed = Math.round(performance.now() - started);
    requestTime.textContent = text('storefront', 'duration_ms', { milliseconds: elapsed });
    if (!response.ok) {
      requestCard.className = 'request-card is-error';
      requestLabel.textContent = text('storefront', 'request_failed', { status: response.status });
      status.textContent = data.error || text('storefront', 'product_information_is_temporarily_unavailable');
      return;
    }
    const availability = data.inventory.source === 'live'
      ? text('storefront', 'in_stock', { quantity: data.inventory.quantity })
      : text('storefront', 'stock_unconfirmed');
    const shipping = data.shipping
      ? data.shipping.source === 'live' ? text('storefront', 'shipping_about_days', { price: data.shipping.priceEur.toFixed(2), days: data.shipping.etaDays }) : text('storefront', 'shipping_quote_unavailable')
      : '';
    requestCard.className = data.degraded ? 'request-card is-degraded' : 'request-card is-success';
    requestLabel.textContent = data.degraded ? text('storefront', 'details_incomplete') : isPreview ? text('storefront', 'preview_ready') : text('storefront', 'availability_confirmed');
    status.textContent = `${availability}${shipping}`;
  } catch {
    requestCard.className = 'request-card is-error';
    requestLabel.textContent = text('storefront', 'connection_failed');
    requestTime.textContent = text('storefront', 'duration_ms', { milliseconds: Math.round(performance.now() - started) });
    status.textContent = text('storefront', 'could_not_reach_the_storefront');
  } finally {
    requestCard.setAttribute('aria-busy', 'false');
    refresh.disabled = false;
    preview.disabled = false;
  }
}
refresh.addEventListener('click', () => load('/api/product'));
preview.addEventListener('click', () => load('/api/order-preview'));
load('/api/product');

const catalogNode = document.querySelector('#catalog-products');
const catalogStatus = document.querySelector('#catalog-status');
const stockButton = document.querySelector('#catalog-stock');
const previewButton = document.querySelector('#catalog-preview');
let catalogBusy = false;
let catalogPreview = false;

function node(tag, value, className) {
  const result = document.createElement(tag);
  result.textContent = value;
  if (className) result.className = className;
  return result;
}

async function refreshSystem() {
  try {
    const response = await fetch('/api/system', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const state = await response.json();
    const indicators = document.querySelector('#system-indicators');
    indicators.replaceChildren(
      node('span', text('catalog', 'workers', state), state.active === state.limit ? 'pressure' : ''),
      node('span', text('catalog', 'queue', state), state.queued ? 'pressure' : ''),
      node('span', text('catalog', 'rejections', state)),
      node('span', text('catalog', 'circuits', { count: state.circuits.length }))
    );
    for (const circuit of state.circuits) {
      indicators.append(node('span', text('catalog', 'paused', { key: circuit.key, seconds: Math.ceil(circuit.retryInMs / 1000) }), 'paused'));
    }
  } catch {
    document.querySelector('#system-indicators').textContent = text('catalog', 'monitor_unavailable');
  }
}

async function refreshCatalog(preview = catalogPreview) {
  if (catalogBusy) return;
  catalogPreview = preview;
  catalogBusy = true;
  stockButton.disabled = true;
  previewButton.disabled = true;
  catalogNode.setAttribute('aria-busy', 'true');
  catalogStatus.textContent = text('catalog', 'loading');
  const started = performance.now();
  try {
    const response = await fetch(`/api/catalog?preview=${preview}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    const milliseconds = Math.round(performance.now() - started);
    catalogNode.replaceChildren();
    if (!response.ok) {
      catalogStatus.textContent = text('catalog', 'failed', { milliseconds, status: response.status });
      // The old response must not masquerade as current live data.
      catalogNode.append(node('p', data.error, 'catalog-error'));
      return;
    }
    catalogStatus.textContent = text('catalog', preview ? 'preview_ready' : 'stock_ready', { milliseconds });
    for (const result of data.products) {
      const card = node('article', '', `catalog-product ${result.degraded ? 'degraded' : 'healthy'}`);
      card.append(node('h2', result.product.name), node('p', result.product.sku, 'meta'));
      const confirmed = result.inventory.source === 'live';
      card.append(node('p', confirmed ? text('storefront', 'in_stock', { quantity: result.inventory.quantity }) : text('storefront', 'stock_unconfirmed')));
      if (result.shipping) card.append(node('p', result.shipping.source === 'live'
        ? text('storefront', 'shipping_about_days', { price: result.shipping.priceEur.toFixed(2), days: result.shipping.etaDays })
        : text('storefront', 'shipping_quote_unavailable')));
      card.append(node('p', text('catalog', 'waited', { milliseconds: result.queueMs }), 'meta'));
      card.append(node('strong', text('catalog', result.degraded ? 'limited' : 'live')));
      const action = node('button', text('catalog', confirmed ? 'available' : 'disabled'), 'secondary');
      action.type = 'button';
      action.disabled = !confirmed;
      const checkResult = node('p', '', 'meta');
      action.addEventListener('click', async () => {
        action.disabled = true;
        const started = performance.now();
        try {
          const response = await fetch(`/api/product?sku=${result.product.sku}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
          const value = await response.json();
          checkResult.textContent = response.ok
            ? text('catalog', 'individual_result', { milliseconds: Math.round(performance.now() - started), stock: value.inventory.source === 'live' ? text('storefront', 'in_stock', { quantity: value.inventory.quantity }) : text('storefront', 'stock_unconfirmed') })
            : value.error;
        } catch { checkResult.textContent = text('catalog', 'connection_error'); }
        finally { action.disabled = false; }
      });
      card.append(action);
      card.append(checkResult);
      catalogNode.append(card);
    }
  } catch {
    catalogNode.replaceChildren();
    catalogStatus.textContent = text('catalog', 'connection_error');
  } finally {
    catalogBusy = false;
    stockButton.disabled = false;
    previewButton.disabled = false;
    catalogNode.setAttribute('aria-busy', 'false');
    refreshSystem();
  }
}

stockButton.addEventListener('click', () => refreshCatalog(false));
previewButton.addEventListener('click', () => refreshCatalog(true));
setInterval(() => { if (document.querySelector('#catalog-auto').checked) refreshCatalog(); }, 2000);
setInterval(refreshSystem, 500);
refreshCatalog();
refreshSystem();
