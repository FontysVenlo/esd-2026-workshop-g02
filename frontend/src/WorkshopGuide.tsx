const tools = [
  ["Toxiproxy", "Network fault simulation", "Service-to-service tests", "Latency, timeout, disconnect"],
  ["Prometheus", "Metrics collection", "Applications and infrastructure", "Compare normal and faulty request rates"],
  ["Grafana", "Metrics exploration", "Operations dashboards", "Find the unhealthy dependency"],
  ["Gremlin", "Managed reliability experiments", "Enterprise systems", "Run a planned infrastructure fault"],
  ["Chaos Mesh", "Cloud-native fault injection", "Kubernetes", "Disrupt a selected pod or network path"],
  ["LitmusChaos", "Chaos experiment workflows", "Cloud-native platforms", "Run and review a repeatable experiment"],
  ["Linux tc/netem", "Host-level network emulation", "Linux hosts and containers", "Delay or drop packets"]
];

export function Toolbox({ onBack }: { onBack: () => void }) {
  return <main className="shell"><header className="hero"><button className="text-button" onClick={onBack}>← All Challenges</button><p className="eyebrow">CHAOS ENGINEERING TOOLBOX</p><h1>Tools behind the experiments</h1><p className="intro">The workshop controls faults for you in the guided exercises. Real engineers choose tools based on their infrastructure and the scope of the experiment.</p></header>
    <section className="work-card"><h2>How the tools fit together</h2><p>Storefront → Toxiproxy → Inventory. Toxiproxy sits between services and changes network communication; here it creates latency, timeouts, and unavailable connections. The workshop UI configures it automatically for the first exercises.</p><p>Prometheus gathers the actual request and dependency measurements. Grafana charts those measurements so you can establish normal behavior, see the failure impact, and test whether a mitigation helped. The built-in workshop charts are simplified educational views; Grafana is closer to a normal monitoring workflow.</p></section>
    <section className="work-card"><h2>Tools in Chaos Engineering</h2><div className="table-wrap"><table className="summary-table"><thead><tr><th>Tool</th><th>Purpose</th><th>Typical environment</th><th>Example use</th></tr></thead><tbody>{tools.map(([name, purpose, environment, example]) => <tr key={name}><th scope="row">{name}</th><td>{purpose}</td><td>{environment}</td><td>{example}</td></tr>)}</tbody></table></div><p>These are examples, not a ranking. The right tool depends on what you can safely control and observe.</p></section></main>;
}

export function Architecture({ onBack }: { onBack: () => void }) {
  return <main className="shell"><header className="hero"><button className="text-button" onClick={onBack}>← All Challenges</button><p className="eyebrow">WORKSHOP ARCHITECTURE</p><h1>What you are experimenting on</h1><p className="intro">Requests and measurements stay on your computer in the local Docker environment.</p></header>
    <section className="work-card"><h2>Request path</h2><div className="architecture-flow"><div>Browser<br />↓<br />Workshop UI<br />↓<br />Workshop Controller<br />↓<br />Storefront</div><div className="architecture-branches"><div>↙<br />Toxiproxy<br />↓<br />Inventory</div><div>↘<br />Toxiproxy<br />↓<br />Shipping</div></div></div><p>The controlled faults affect only the selected Storefront dependency connection, not the entire computer or Internet connection.</p></section>
    <section className="work-card"><h2>Measurement path</h2><div className="architecture-flow">Services<br />↓<br />Real metrics<br />↓<br />Prometheus<br />↓<br />Grafana</div><p>Prometheus collects time-series data from the running services. Grafana reads those measurements and displays the workshop dashboard.</p></section></main>;
}
