import home from '../../content/home.json' with { type: 'json' };
import storefront from '../../content/storefront.json' with { type: 'json' };
import networkFaults from '../../content/network-faults.json' with { type: 'json' };
import tools from '../../content/tools.json' with { type: 'json' };

export { home, storefront, networkFaults, tools };

export function format(template, values = {}) {
  if (typeof template !== 'string') throw new Error('Missing page text');
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match);
}

export function pageCopy(page) {
  return (section, key, values) => {
    const template = page[section]?.[key];
    if (typeof template !== 'string') throw new Error('Missing page text: ' + section + '.' + key);
    return format(template, values);
  };
}
