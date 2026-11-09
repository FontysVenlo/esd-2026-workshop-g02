export { default as home } from '../../content/home.json' with { type: 'json' };

export function format(template, values = {}) {
  if (typeof template !== 'string') throw new Error('Missing page text');
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
