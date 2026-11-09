import page from '../content/tools.json' with { type: 'json' };
import React from 'react';
import { createRoot } from 'react-dom/client';
const { toolsPage } = page;

function Tools() {
  return (
    <>
      <header>
        <div className="header-inner">
          <a className="brand" href="/">
            {toolsPage.northstar_supply_commands}
          </a>
          <nav className="links">
            <a href="/">{toolsPage.workshop_overview}</a>
            <a href="http://localhost:8089" target="_blank" rel="noopener">
              {toolsPage.network_faults}
            </a>
          </nav>
        </div>
      </header>
      <main className="reference">
        <div className="intro">
          <h1>{toolsPage.optional_command_reference}</h1>
          <p>
            {toolsPage.the_workshop_can_be_completed_entirely_in_the_browser}{' '}
            <a href="http://localhost:8089" target="_blank" rel="noopener">
              {toolsPage.fault_injection}
            </a>{' '}
            {toolsPage.to_create_the_problem_and}{' '}
            <a href="http://localhost:8089/#mitigations" target="_blank" rel="noopener">
              {toolsPage.fallbacks_timeouts}
            </a>{' '}
            {toolsPage.to_change_the_shop_s_response}
          </p>
          <p>
            {toolsPage.you_do_not_need_to_type_any_of_the}{' '}
            <strong>{toolsPage.info_commands}</strong>{' '}
            {toolsPage.tab_also_shows_the_last_request_with_a_windows}
          </p>
        </div>
        <section>
          <h2>{toolsPage.what_changes_when_i_enable_a_fallback}</h2>
          <p>
            {toolsPage.inventory_fallback_returns} <strong>{toolsPage.stock_unconfirmed}</strong>{' '}
            {toolsPage.if_stock_cannot_be_checked_shipping_fallback_keeps_the}{' '}
            <strong>{toolsPage.shipping_quote_unavailable}</strong>
            {toolsPage.a_timeout_limits_the_dependency_wait_these_controls_change}
          </p>
          <p>
            {toolsPage.restore_defaults_in} <strong>{toolsPage.fallbacks_timeouts}</strong>
            {toolsPage.then_clear_the_fault_in} <strong>{toolsPage.fault_injection}</strong>
            {toolsPage.your_answers_remain_saved_runtime_settings_last_until_storefront}
          </p>
        </section>
        <section>
          <h2>{toolsPage.windows_powershell}</h2>
          <h3>{toolsPage.inventory_timeout_and_fallback}</h3>
          <pre>{toolsPage.invoke_restmethod_method_post_uri_http_localhost_8089_api}</pre>
          <h3>{toolsPage.shipping_fallback}</h3>
          <pre>{toolsPage.invoke_restmethod_method_post_uri_http_localhost_8089_api_2}</pre>
          <h3>{toolsPage.restore_default_settings}</h3>
          <pre>{toolsPage.invoke_restmethod_method_post_uri_http_localhost_8089_api_3}</pre>
          <h3>{toolsPage.inventory_latency}</h3>
          <pre>{toolsPage.invoke_restmethod_method_post_uri_http_localhost_8089_api_4}</pre>
        </section>
        <section>
          <h2>{toolsPage.mac_terminal}</h2>
          <h3>{toolsPage.inventory_timeout_and_fallback}</h3>
          <pre>{toolsPage.curl_f_ss_x_post_http_localhost_8089_api}</pre>
          <h3>{toolsPage.shipping_fallback}</h3>
          <pre>{toolsPage.curl_f_ss_x_post_http_localhost_8089_api_2}</pre>
          <h3>{toolsPage.restore_default_settings}</h3>
          <pre>{toolsPage.curl_f_ss_x_post_http_localhost_8089_api_3}</pre>
          <h3>{toolsPage.inventory_latency}</h3>
          <pre>{toolsPage.curl_f_ss_x_post_http_localhost_8089_api_4}</pre>
        </section>
        <section>
          <h2>{toolsPage.what_happens_underneath}</h2>
          <p>
            {toolsPage.fault_requests_change_the_real} <strong>{toolsPage.toxiproxy}</strong>{' '}
            {toolsPage.paths_mitigation_requests_change_the_storefront_s_live_timeout}
          </p>
          <p>
            <a href="/docs/tool-reference.md">{toolsPage.full_technical_reference}</a>{' '}
            {toolsPage.text}{' '}
            <a
              href="http://localhost:3008/d/field-workshop/field-workshop"
              target="_blank"
              rel="noopener"
            >
              {toolsPage.grafana}
            </a>
          </p>
        </section>
      </main>
    </>
  );
}
createRoot(document.getElementById('tools-root')).render(<Tools />);
