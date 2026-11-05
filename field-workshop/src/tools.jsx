import React from 'react';
import { createRoot } from 'react-dom/client';
import { copy as text } from '/copy.mjs';
function Tools() { return <>
  <header><div className="header-inner"><a className="brand" href="/">{text('toolsPage','northstar_supply_commands')}</a><nav className="links"><a href="/">{text('toolsPage','workshop_overview')}</a><a href="http://localhost:8089" target="_blank" rel="noopener">{text('toolsPage','network_faults')}</a></nav></div></header>
  <main className="reference">
    <div className="intro"><h1>{text('toolsPage','optional_command_reference')}</h1><p>{text('toolsPage','the_workshop_can_be_completed_entirely_in_the_browser')} <a href="http://localhost:8089" target="_blank" rel="noopener">{text('toolsPage','fault_injection')}</a> {text('toolsPage','to_create_the_problem_and')} <a href="http://localhost:8089/#mitigations" target="_blank" rel="noopener">{text('toolsPage','fallbacks_timeouts')}</a> {text('toolsPage','to_change_the_shop_s_response')}</p><p>{text('toolsPage','you_do_not_need_to_type_any_of_the')} <strong>{text('toolsPage','info_commands')}</strong> {text('toolsPage','tab_also_shows_the_last_request_with_a_windows')}</p></div>
    <section>
      <h2>{text('toolsPage','what_changes_when_i_enable_a_fallback')}</h2>
      <p>{text('toolsPage','inventory_fallback_returns')} <strong>{text('toolsPage','stock_unconfirmed')}</strong> {text('toolsPage','if_stock_cannot_be_checked_shipping_fallback_keeps_the')} <strong>{text('toolsPage','shipping_quote_unavailable')}</strong>{text('toolsPage','a_timeout_limits_the_dependency_wait_these_controls_change')}</p>
      <p>{text('toolsPage','restore_defaults_in')} <strong>{text('toolsPage','fallbacks_timeouts')}</strong>{text('toolsPage','then_clear_the_fault_in')} <strong>{text('toolsPage','fault_injection')}</strong>{text('toolsPage','your_answers_remain_saved_runtime_settings_last_until_storefront')}</p>
    </section>
    <section>
      <h2>{text('toolsPage','windows_powershell')}</h2>
      <h3>{text('toolsPage','inventory_timeout_and_fallback')}</h3>
      <pre>{text('toolsPage','invoke_restmethod_method_post_uri_http_localhost_8089_api')}</pre>
      <h3>{text('toolsPage','shipping_fallback')}</h3>
      <pre>{text('toolsPage','invoke_restmethod_method_post_uri_http_localhost_8089_api_2')}</pre>
      <h3>{text('toolsPage','restore_default_settings')}</h3>
      <pre>{text('toolsPage','invoke_restmethod_method_post_uri_http_localhost_8089_api_3')}</pre>
      <h3>{text('toolsPage','inventory_latency')}</h3>
      <pre>{text('toolsPage','invoke_restmethod_method_post_uri_http_localhost_8089_api_4')}</pre>
    </section>
    <section>
      <h2>{text('toolsPage','mac_terminal')}</h2>
      <h3>{text('toolsPage','inventory_timeout_and_fallback')}</h3>
      <pre>{text('toolsPage','curl_f_ss_x_post_http_localhost_8089_api')}</pre>
      <h3>{text('toolsPage','shipping_fallback')}</h3>
      <pre>{text('toolsPage','curl_f_ss_x_post_http_localhost_8089_api_2')}</pre>
      <h3>{text('toolsPage','restore_default_settings')}</h3>
      <pre>{text('toolsPage','curl_f_ss_x_post_http_localhost_8089_api_3')}</pre>
      <h3>{text('toolsPage','inventory_latency')}</h3>
      <pre>{text('toolsPage','curl_f_ss_x_post_http_localhost_8089_api_4')}</pre>
    </section>
    <section>
      <h2>{text('toolsPage','what_happens_underneath')}</h2>
      <p>{text('toolsPage','fault_requests_change_the_real')} <strong>{text('toolsPage','toxiproxy')}</strong> {text('toolsPage','paths_mitigation_requests_change_the_storefront_s_live_timeout')}</p>
      <p><a href="/docs/tool-reference.md">{text('toolsPage','full_technical_reference')}</a> {text('toolsPage','text')} <a href="http://localhost:3008/d/field-workshop/field-workshop" target="_blank" rel="noopener">{text('toolsPage','grafana')}</a></p>
    </section>
  </main>
</>; }
createRoot(document.getElementById('tools-root')).render(<Tools />);
