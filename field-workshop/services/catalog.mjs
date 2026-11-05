import { copy as text } from '../web/copy.mjs';

export function products() {
  return [
    { sku: 'LAMP-01', name: text('api', 'product_name'), priceEur: 29.9, quantity: 12 },
    { sku: 'CHAIR-02', name: text('catalog', 'chair'), priceEur: 89.9, quantity: 8 },
    { sku: 'DESK-03', name: text('catalog', 'desk'), priceEur: 149.9, quantity: 5 }
  ];
}
