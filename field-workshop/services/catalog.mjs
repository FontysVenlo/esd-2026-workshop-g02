import { readPageCopy } from './page-copy.mjs';
export function products() {
  return [
    {
      sku: 'LAMP-01',
      name: readPageCopy('storefront').api.product_name,
      priceEur: 29.9,
      quantity: 12,
    },
    {
      sku: 'CHAIR-02',
      name: readPageCopy('storefront').catalog.chair,
      priceEur: 89.9,
      quantity: 8,
    },
    { sku: 'DESK-03', name: readPageCopy('storefront').catalog.desk, priceEur: 149.9, quantity: 5 },
  ];
}

export const inventoryCategory = Object.freeze({
  'LAMP-01': 'lighting',
  'CHAIR-02': 'seating',
  'DESK-03': 'desks',
});
