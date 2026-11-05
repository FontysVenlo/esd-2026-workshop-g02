import shared from './content/shared.json' with { type: 'json' };

export { shared };

// Named placeholders remain editable without evaluating code from the JSON.
export function copy(section, key, values = {}) {
  const template = shared[section]?.[key];
  if (typeof template !== 'string') throw new Error(`Missing copy: ${section}.${key}`);
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match);
}
