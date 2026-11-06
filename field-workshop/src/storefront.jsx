import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { format } from '/copy.mjs';

const products = [
  { sku: 'LAMP-01', name: "Desk Lamp", image: '/images/lamp.png', price: 29.9 },
  { sku: 'CHAIR-02', name: "Task Chair", image: '/images/chair.png', price: 89.9 },
  { sku: 'DESK-03', name: "Writing Desk", image: '/images/desk.png', price: 149.9 }
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
    ? format("{quantity} in stock", { quantity: value.inventory.quantity }) : "Stock unconfirmed";
  const shipping = value => value.shipping.source === 'live'
    ? format(" · Shipping €{price} · About {days} days", { price: value.shipping.priceEur.toFixed(2), days: value.shipping.etaDays })
    : " · Shipping quote unavailable";
  return <article className={`react-product ${stale ? 'stale' : result?.degraded ? 'degraded' : ''}`}>
    <div className="product-photo"><img src={product.image} alt={product.name} width="1254" height="1254" decoding="async" /></div>
    <div className="react-product-content">
      <div className="product-heading"><h2>{product.name}</h2><span>€{product.price.toFixed(2)}</span></div>
      <p className="meta">{product.sku}</p>
      <div className={`product-state ${stale ? 'state-stale' : result?.degraded ? 'state-limited' : 'state-live'}`}>
        {(stale ? "Last known result" : !result ? "Not checked yet" : result.degraded ? "Limited information" : "Live information")}
      </div>
      <div className="product-readings">
        <p>{result ? stock(result) : "Not checked yet"}</p>
        <p>{result?.shipping ? shipping(result) : "Delivery quote shown in delivery view"}</p>
      </div>
      <div className="product-buttons">
        <button className="primary" disabled={busy || (result && unconfirmed) || check?.data?.inventory.source === 'unconfirmed'} onClick={() => inspect(false)}>
          {(result && unconfirmed ? "Availability temporarily disabled" : "Check this product")}
        </button>
        <button className="secondary" disabled={busy} onClick={() => inspect(true)}>{"Order preview"}</button>
      </div>
      <div className="individual-result" role="status" aria-live="polite">
        {busy ? "Checking this product…" : check?.error ? check.error : check?.data ? <>
          {format("{stock} · {milliseconds} ms", { stock: stock(check.data), milliseconds: check.milliseconds })}
          {check.data.shipping && <span>{shipping(check.data)}</span>}
        </> : "Run an individual check to compare with the shared catalog."}
      </div>
    </div>
  </article>;
}

function Storefront() {
  const [preview, setPreview] = useState(false);
  const [auto, setAuto] = useState(true);
  const [state, refresh] = usePolling(`/api/catalog?preview=${preview}`, 2000, auto);
  const stale = Boolean(state.error || state.pending);
  function selectView(value) { if (value === preview) refresh(); else setPreview(value); }
  return <>
    <header><div className="header-inner storefront-header">
      <a className="brand" href="/storefront">{"Northstar Supply"}<span className="brand-dot">.</span></a>
      <a href="/">{"← Workshop overview"}</a>
    </div></header>
    <main className="react-storefront">
      <div className="catalog-intro"><div className="eyebrow">{"LIVE CATALOG"}</div>
        <h1>{"Three products. One shared shop."}</h1><p>{"Browse three home-office essentials. Check current availability or preview delivery for the whole catalog or an individual product."}</p></div>
      <section className="catalog-controls" aria-label={"Catalog view and refresh controls"}>
        <div className="view-buttons">
          <button className={preview ? 'secondary' : 'primary'} aria-pressed={!preview} onClick={() => selectView(false)}>{"Refresh all availability"}</button>
          <button className={preview ? 'primary' : 'secondary'} aria-pressed={preview} onClick={() => selectView(true)}>{"Preview all deliveries"}</button>
        </div>
        <label className="auto-refresh"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} />{"Refresh this view every 2 seconds"}</label>
      </section>
      <div className={`catalog-feedback ${state.error ? 'has-error' : ''}`} role="status" aria-live="polite">
        <strong>{state.pending ? "Updating catalog…" : state.error
          ? format("Whole catalog unavailable · HTTP {status} · {milliseconds} ms", { status: state.error.status ?? '—', milliseconds: state.milliseconds })
          : format(preview ? "Delivery catalog ready · {milliseconds} ms" : "Availability catalog ready · {milliseconds} ms", { milliseconds: state.milliseconds })}</strong>
        {state.error && <p>{state.error.message || "Could not refresh the catalog. No current live result is shown."}</p>}
        {stale && state.data && <span>{"Showing the last successful catalog. It is not a current confirmation; individual product checks remain available."}</span>}
      </div>
      <div className="react-products">{products.map(product => <ProductCard key={product.sku} product={product}
        result={state.data?.products.find(result => result.product.sku === product.sku)} stale={stale} />)}</div>
      <details className="catalog-explainer"><summary>{"About availability and delivery"}</summary><p>{"Stock and delivery are checked live. If stock cannot be confirmed, availability checking is temporarily disabled. An unavailable delivery quote is not a delivery promise. After a refresh fails, cards show the last known result until live information returns."}</p></details>
      <p className="meta preview-note">{"Order preview only. No purchase is made."}</p>
    </main>
  </>;
}

createRoot(document.getElementById('storefront-root')).render(<Storefront />);
