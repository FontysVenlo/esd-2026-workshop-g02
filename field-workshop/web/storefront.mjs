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
