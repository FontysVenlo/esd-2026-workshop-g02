import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { copy as text } from '/copy.mjs';

const products = [
  { sku: 'LAMP-01', name: text('api', 'product_name'), image: '/images/lamp.png', price: 29.9 },
  { sku: 'CHAIR-02', name: text('catalog', 'chair'), image: '/images/chair.png', price: 89.9 },
  { sku: 'DESK-03', name: text('catalog', 'desk'), image: '/images/desk.png', price: 149.9 }
];

// A single request per polling loop. Background updates never clear the current
// value, disable foreground controls, or announce a loading state every cycle.
function usePolling(path, interval, enabled = true) {
  const [state, setState] = useState({ data: null, error: null, pending: true, milliseconds: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false, timer;
    let controller;
    async function poll() {
      controller = new AbortController();
      const started = performance.now();
      try {
        const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
        if (!stopped) setState({ data, error: null, pending: false, milliseconds: Math.round(performance.now() - started) });
      } catch (error) {
        if (!stopped) setState(previous => ({ ...previous, error, pending: false, milliseconds: Math.round(performance.now() - started) }));
      } finally {
        if (!stopped && enabled) timer = setTimeout(poll, interval);
      }
    }
    // A view change must never display the previous view as a current result.
    setState(previous => ({ ...previous, pending: true }));
    poll();
    return () => { stopped = true; controller?.abort(); clearTimeout(timer); };
  }, [path, interval, enabled, revision]);
  return [state, () => setRevision(value => value + 1)];
}

function ProductCard({ product, result, stale }) {
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (result?.inventory.source === 'live') setCheck(previous => previous?.data?.inventory.source === 'unconfirmed' ? null : previous);
  }, [result]);
  const unconfirmed = result?.inventory.source !== 'live';
  async function inspect(preview) {
    if (busy) return;
    controller.current = new AbortController();
    setBusy(true);
    const started = performance.now();
    try {
      const response = await fetch(`${preview ? '/api/order-preview' : '/api/product'}?sku=${product.sku}`, {
        cache: 'no-store', signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(6000)])
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCheck({ data, milliseconds: Math.round(performance.now() - started) });
    } catch (error) {
      if (!controller.current.signal.aborted) setCheck({ error: error.message });
    } finally { setBusy(false); }
  }
  const stock = value => value?.inventory.source === 'live'
    ? text('storefront', 'in_stock', { quantity: value.inventory.quantity }) : text('storefront', 'stock_unconfirmed');
  const shipping = value => value.shipping.source === 'live'
    ? text('storefront', 'shipping_about_days', { price: value.shipping.priceEur.toFixed(2), days: value.shipping.etaDays })
    : text('storefront', 'shipping_quote_unavailable');
  return <article className={`react-product ${stale ? 'stale' : result?.degraded ? 'degraded' : ''}`}>
    <div className="product-photo"><img src={product.image} alt={product.name} width="1254" height="1254" decoding="async" /></div>
    <div className="react-product-content">
      <div className="product-heading"><h2>{product.name}</h2><span>€{product.price.toFixed(2)}</span></div>
      <p className="meta">{product.sku}</p>
      <div className={`product-state ${stale ? 'state-stale' : result?.degraded ? 'state-limited' : 'state-live'}`}>
        {text('catalog', stale ? 'stale' : !result ? 'waiting' : result.degraded ? 'limited' : 'live')}
      </div>
      <div className="product-readings">
        <p>{result ? stock(result) : text('catalog', 'waiting')}</p>
        <p>{result?.shipping ? shipping(result) : text('catalog', 'stock_only')}</p>
        <p className="meta">{result ? text('catalog', 'waited', { milliseconds: result.queueMs }) : '—'}</p>
      </div>
      <div className="product-buttons">
        <button className="primary" disabled={busy || (result && unconfirmed) || check?.data?.inventory.source === 'unconfirmed'} onClick={() => inspect(false)}>
          {text('catalog', result && unconfirmed ? 'disabled' : 'available')}
        </button>
        <button className="secondary" disabled={busy} onClick={() => inspect(true)}>{text('storefrontPage', 'order_preview')}</button>
      </div>
      <div className="individual-result" role="status" aria-live="polite">
        {busy ? text('catalog', 'checking') : check?.error ? check.error : check?.data ? <>
          {text('catalog', 'individual_result', { stock: stock(check.data), milliseconds: check.milliseconds })}
          {check.data.shipping && <span>{shipping(check.data)}</span>}
        </> : text('catalog', 'individual_hint')}
      </div>
    </div>
  </article>;
}

function Indicators() {
  const [{ data, error }] = usePolling('/api/system', 1000);
  if (!data) return <div className="system-indicators">{text('catalog', error ? 'monitor_unavailable' : 'monitor_loading')}</div>;
  return <div className="system-indicators" aria-label={text('catalog', 'monitor_label')}>
    <span className={data.active === data.limit ? 'pressure' : ''}>{text('catalog', 'workers', data)}</span>
    <span className={data.queued ? 'pressure' : ''}>{text('catalog', 'queue', data)}</span>
    <span>{text('catalog', 'rejections', data)}</span>
    <span>{text('catalog', 'circuits', { count: data.circuits.length })}</span>
    {data.circuits.map(circuit => <span key={circuit.key} className="paused">{text('catalog', 'paused', { key: circuit.key, seconds: Math.ceil(circuit.retryInMs / 1000) })}</span>)}
    {error && <span className="pressure">{text('catalog', 'monitor_unavailable')}</span>}
  </div>;
}

function Storefront() {
  const [preview, setPreview] = useState(false);
  const [auto, setAuto] = useState(true);
  const [state, refresh] = usePolling(`/api/catalog?preview=${preview}`, 2000, auto);
  const stale = Boolean(state.error || state.pending);
  function selectView(value) { if (value === preview) refresh(); else setPreview(value); }
  return <>
    <header><div className="header-inner storefront-header">
      <a className="brand" href="/storefront">{text('storefrontPage', 'northstar_supply')}<span className="brand-dot">.</span></a>
      <a href="/">{text('storefrontPage', 'workshop_overview')}</a>
    </div></header>
    <main className="react-storefront">
      <div className="catalog-intro"><div className="eyebrow">{text('catalog', 'eyebrow')}</div>
        <h1>{text('catalog', 'title')}</h1><p>{text('catalog', 'description')}</p></div>
      <section className="catalog-controls" aria-label={text('catalog', 'controls_label')}>
        <div className="view-buttons">
          <button className={preview ? 'secondary' : 'primary'} aria-pressed={!preview} onClick={() => selectView(false)}>{text('catalog', 'refresh_stock')}</button>
          <button className={preview ? 'primary' : 'secondary'} aria-pressed={preview} onClick={() => selectView(true)}>{text('catalog', 'refresh_preview')}</button>
        </div>
        <label className="auto-refresh"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} />{text('catalog', 'auto_refresh')}</label>
      </section>
      <Indicators />
      <div className={`catalog-feedback ${state.error ? 'has-error' : ''}`} role="status" aria-live="polite">
        <strong>{state.pending ? text('catalog', 'updating') : state.error
          ? text('catalog', 'failed', { status: state.error.status ?? '—', milliseconds: state.milliseconds })
          : text('catalog', preview ? 'preview_ready' : 'stock_ready', { milliseconds: state.milliseconds })}</strong>
        {state.error && <p>{state.error.message || text('catalog', 'connection_error')}</p>}
        {stale && state.data && <span>{text('catalog', 'stale_notice')}</span>}
      </div>
      <div className="react-products">{products.map(product => <ProductCard key={product.sku} product={product}
        result={state.data?.products.find(result => result.product.sku === product.sku)} stale={stale} />)}</div>
      <details className="catalog-explainer"><summary>{text('catalog', 'explanation_title')}</summary><p>{text('catalog', 'explanation')}</p></details>
      <p className="meta preview-note">{text('storefrontPage', 'order_preview_only_no_purchase_is_made')}</p>
    </main>
  </>;
}

createRoot(document.getElementById('storefront-root')).render(<Storefront />);
