import { InlineText } from './shared/inline-text.jsx';
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
            <InlineText text={toolsPage.browser_workflow} />
          </p>
          <p>
            <InlineText text={toolsPage.optional_commands_help} />
          </p>
        </div>
        <section>
          <h2>{toolsPage.what_changes_when_i_enable_a_fallback}</h2>
          <p>
            <InlineText text={toolsPage.fallback_behavior} />
          </p>
          <p>
            <InlineText text={toolsPage.restore_defaults_help} />
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
            <InlineText text={toolsPage.implementation_help} />
          </p>
          <p>
            <InlineText text={toolsPage.reference_links} />
          </p>
        </section>
      </main>
    </>
  );
}
createRoot(document.getElementById('tools-root')).render(<Tools />);
