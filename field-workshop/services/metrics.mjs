const buckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10];

function labels(values) {
  return `{${Object.entries(values).map(([key, value]) => `${key}="${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`).join(',')}}`;
}

function add(map, values, amount = 1) {
  const key = JSON.stringify(values);
  const entry = map.get(key) ?? { values, amount: 0 };
  entry.amount += amount;
  map.set(key, entry);
}

function observe(map, values, seconds) {
  const key = JSON.stringify(values);
  const entry = map.get(key) ?? { values, count: 0, sum: 0, buckets: buckets.map(() => 0) };
  entry.count += 1;
  entry.sum += seconds;
  buckets.forEach((bound, index) => {
    if (seconds <= bound) entry.buckets[index] += 1;
  });
  map.set(key, entry);
}

export class Metrics {
  constructor(service) {
    this.service = service;
    this.requests = new Map();
    this.requestDurations = new Map();
    this.dependencies = new Map();
    this.dependencyDurations = new Map();
    this.fallbacks = new Map();
  }

  request(route, status, seconds) {
    const values = { service: this.service, route, status: String(status) };
    add(this.requests, values);
    observe(this.requestDurations, { service: this.service, route }, seconds);
  }

  dependency(name, outcome, seconds) {
    add(this.dependencies, { service: this.service, dependency: name, outcome });
    observe(this.dependencyDurations, { service: this.service, dependency: name }, seconds);
  }

  fallback(name) {
    add(this.fallbacks, { service: this.service, dependency: name });
  }

  render() {
    const lines = [];
    const counter = (name, help, entries) => {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} counter`);
      for (const { values, amount } of entries.values()) lines.push(`${name}${labels(values)} ${amount}`);
    };
    const histogram = (name, help, entries) => {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} histogram`);
      for (const { values, count, sum, buckets: counts } of entries.values()) {
        buckets.forEach((bound, index) => lines.push(`${name}_bucket${labels({ ...values, le: bound })} ${counts[index]}`));
        lines.push(`${name}_bucket${labels({ ...values, le: '+Inf' })} ${count}`);
        lines.push(`${name}_sum${labels(values)} ${sum}`);
        lines.push(`${name}_count${labels(values)} ${count}`);
      }
    };
    counter('workshop_http_requests_total', 'Completed application HTTP requests.', this.requests);
    histogram('workshop_http_request_duration_seconds', 'Application HTTP request duration.', this.requestDurations);
    counter('workshop_dependency_calls_total', 'Completed calls from the storefront to a dependency.', this.dependencies);
    histogram('workshop_dependency_duration_seconds', 'Storefront dependency call duration.', this.dependencyDurations);
    counter('workshop_fallbacks_total', 'Fallback responses used by the storefront.', this.fallbacks);
    return `${lines.join('\n')}\n`;
  }
}
