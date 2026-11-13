import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { format } from '/copy.mjs';

import page from '../content/storefront.json' with { type: 'json' };

const { catalog, storefront, storefrontPage } = page;

const products = [
  { sku: 'LAMP-01', name: page.api.product_name, image: '/images/lamp.png', price: 29.9 },
  { sku: 'CHAIR-02', name: catalog.chair, image: '/images/chair.png', price: 89.9 },
  { sku: 'DESK-03', name: catalog.desk, image: '/images/desk.png', price: 149.9 },
];

// A single request per polling loop. Background updates never clear the current
// value, disable foreground controls, or announce a loading state every cycle.
function usePolling(path, interval, enabled = true) {
  const [state, setState] = useState({
    data: null,
    error: null,
    pending: true,
    milliseconds: null,
    quotes: {},
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false,
      timer;
    let controller;
    async function poll() {
      controller = new AbortController();
      const started = performance.now();
      try {
        const response = await fetch(path, {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
        });
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
        if (!stopped)
          setState((previous) => ({
            data,
            error: null,
            pending: false,
            milliseconds: Math.round(performance.now() - started),
            quotes: path.endsWith('preview=true')
              ? Object.fromEntries(data.products.map((item) => [item.product.sku, item.shipping]))
              : previous.quotes,
          }));
      } catch (error) {
        if (!stopped)
          setState((previous) => ({
            ...previous,
            quotes: path.endsWith('preview=true')
              ? Object.fromEntries(
                  products.map((product) => [product.sku, { source: 'unavailable' }]),
                )
              : previous.quotes,
            error,
            pending: false,
            milliseconds: Math.round(performance.now() - started),
          }));
      } finally {
        if (!stopped && enabled) timer = setTimeout(poll, interval);
      }
    }
    // A view change must never display the previous view as a current result.
    setState((previous) => ({ ...previous, pending: true }));
    poll();
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(timer);
    };
  }, [path, interval, enabled, revision]);
  return [state, () => setRevision((value) => value + 1)];
}

function ProductCard({
  product,
  result,
  stale,
  failed = false,
  failureMessage,
  preview = false,
  shippingQuote = result?.shipping,
  shippingStale = stale,
}) {
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (result?.inventory.source === 'live')
      setCheck((previous) =>
        previous?.data?.inventory && previous.data.inventory.source !== 'live' ? null : previous,
      );
  }, [result]);
  const unconfirmed = result?.inventory.source !== 'live';
  const limited = Boolean(
    result && (unconfirmed || ['unavailable', 'rejected'].includes(shippingQuote?.source)),
  );
  async function inspect(preview) {
    if (busy) return;
    controller.current = new AbortController();
    setBusy(true);
    const started = performance.now();
    try {
      const response = await fetch(
        `${preview ? '/api/order-preview' : '/api/product'}?sku=${product.sku}`,
        {
          cache: 'no-store',
          signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(6000)]),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCheck({ data, milliseconds: Math.round(performance.now() - started) });
    } catch (error) {
      if (!controller.current.signal.aborted) setCheck({ error: error.message });
    } finally {
      setBusy(false);
    }
  }
  const stock = (value) =>
    value?.inventory.source === 'live'
      ? value.inventory.quantity == null
        ? storefront.stock_missing
        : format(storefront.in_stock, { quantity: value.inventory.quantity })
      : storefront.stock_unconfirmed;
  const shipping = (value, staleQuote = false) => {
    const quote = value?.shipping;
    const live = !staleQuote && ['live', 'backup'].includes(quote?.source);
    return (
      <>
        <span className="shipping-line">
          {live
            ? quote.etaDays == null
              ? storefront.shipping_time_missing
              : format(storefront.shipping_time, { days: quote.etaDays })
            : quote || staleQuote
              ? storefront.shipping_time_unavailable
              : storefront.shipping_time_not_checked}
        </span>
        <span className="shipping-line">
          {live
            ? typeof quote.priceEur !== 'number'
              ? storefront.shipping_cost_missing
              : format(storefront.shipping_cost, { price: quote.priceEur.toFixed(2) })
            : quote || staleQuote
              ? storefront.shipping_cost_unavailable
              : storefront.shipping_cost_not_checked}
        </span>
      </>
    );
  };
  return (
    <article
      className={`react-product ${failed ? 'failed' : stale ? 'stale' : limited ? 'degraded' : ''}`}
    >
      <div className="product-photo">
        <img src={product.image} alt={product.name} width="1254" height="1254" decoding="async" />
      </div>
      <div className="react-product-content">
        <div className="product-heading">
          <h2>{product.name}</h2>
          <span>{format(catalog.price, { price: product.price.toFixed(2) })}</span>
        </div>
        <p className="meta">{product.sku}</p>
        <div
          className={`product-state ${failed ? 'state-failed' : stale ? 'state-stale' : limited ? 'state-limited' : 'state-live'}`}
        >
          {failed
            ? catalog.unavailable
            : stale
              ? catalog.stale
              : !result
                ? catalog.waiting
                : limited
                  ? catalog.limited
                  : catalog.live}
        </div>
        <div className="product-readings">
          {failed && failureMessage && <p className="meta">{failureMessage}</p>}
          <p className={failed ? 'stock-unavailable' : undefined}>
            {failed ? storefront.stock_unavailable : result ? stock(result) : catalog.waiting}
          </p>
          <p>{shipping({ shipping: shippingQuote }, shippingStale)}</p>
          {!preview && shippingQuote && <p className="meta">{storefront.last_delivery_check}</p>}
        </div>
        <div className="product-buttons">
          <button
            className="primary"
            disabled={
              busy ||
              (result && unconfirmed) ||
              (check?.data?.inventory && check.data.inventory.source !== 'live')
            }
            onClick={() => inspect(false)}
          >
            {result && unconfirmed ? catalog.disabled : catalog.available}
          </button>
          <button className="secondary" disabled={busy} onClick={() => inspect(true)}>
            {storefrontPage.order_preview}
          </button>
        </div>
        <div
          className={`individual-result ${check?.error && !busy ? 'has-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {busy ? (
            catalog.checking
          ) : check?.error ? (
            check.error
          ) : check?.data ? (
            <>
              {format(catalog.individual_result, {
                stock: stock(check.data),
                milliseconds: check.milliseconds,
              })}
              {check.data.shipping && <span>{shipping(check.data)}</span>}
            </>
          ) : (
            catalog.individual_hint
          )}
        </div>
      </div>
    </article>
  );
}

function Storefront() {
  useEffect(() => {
    document.title = page.pageTitle;
  }, []);
  const [preview, setPreview] = useState(true);
  const [auto, setAuto] = useState(true);
  const [state, refresh] = usePolling(`/api/catalog?preview=${preview}`, 2000, auto);
  const stale = Boolean(state.error || state.pending);
  const failedCount = state.data?.products.filter((result) => result.error).length ?? 0;
  function selectView(value) {
    if (value === preview) refresh();
    else setPreview(value);
  }
  return (
    <>
      <header>
        <div className="header-inner storefront-header">
          <a className="brand" href="/storefront">
            {storefrontPage.northstar_supply}
            <span className="brand-dot">{catalog.brand_suffix}</span>
          </a>
          <a href="/">{storefrontPage.workshop_overview}</a>
        </div>
      </header>
      <main className="react-storefront">
        <div className="catalog-intro">
          {catalog.eyebrow && <div className="eyebrow">{catalog.eyebrow}</div>}
          <h1>{catalog.title}</h1>
          {catalog.description && <p>{catalog.description}</p>}
        </div>
        <section className="catalog-controls" aria-label={catalog.controls_label}>
          <div className="view-buttons">
            <button
              className={preview ? 'secondary' : 'primary'}
              aria-pressed={!preview}
              onClick={() => selectView(false)}
            >
              {catalog.refresh_stock}
            </button>
            <button
              className={preview ? 'primary' : 'secondary'}
              aria-pressed={preview}
              onClick={() => selectView(true)}
            >
              {catalog.refresh_preview}
            </button>
          </div>
          <label className="auto-refresh">
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => setAuto(event.target.checked)}
            />
            {catalog.auto_refresh}
          </label>
        </section>
        <div
          className={`catalog-feedback ${state.error || failedCount ? 'has-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          <strong>
            {state.pending
              ? catalog.updating
              : state.error
                ? format(catalog.failed, {
                    status: state.error.status ?? catalog.unknown_status,
                    milliseconds: state.milliseconds,
                  })
                : failedCount
                  ? format(catalog.partial, {
                      count: failedCount,
                      milliseconds: state.milliseconds,
                    })
                  : format(preview ? catalog.preview_ready : catalog.stock_ready, {
                      milliseconds: state.milliseconds,
                    })}
          </strong>
          {state.error && <p>{state.error.message || catalog.connection_error}</p>}
          {state.error && state.data && <span>{catalog.stale_notice}</span>}
        </div>
        <div className="react-products">
          {products.map((product) => {
            const item = state.data?.products.find((result) => result.product.sku === product.sku);
            return (
              <ProductCard
                key={product.sku}
                product={product}
                result={item?.error ? undefined : item}
                stale={stale}
                failed={Boolean(state.error || item?.error)}
                failureMessage={item?.error}
                preview={preview}
                shippingQuote={state.quotes[product.sku] ?? null}
                shippingStale={preview && (stale || Boolean(item?.error))}
              />
            );
          })}
        </div>
        <details className="catalog-explainer">
          <summary>{catalog.explanation_title}</summary>
          <p>{catalog.explanation}</p>
        </details>
        <p className="meta preview-note">{storefrontPage.order_preview_only_no_purchase_is_made}</p>
      </main>
    </>
  );
}

createRoot(document.getElementById('storefront-root')).render(<Storefront />);
