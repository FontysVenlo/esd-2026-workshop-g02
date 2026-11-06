
export function products() {
  return [
    { sku: 'LAMP-01', name: "Desk Lamp", priceEur: 29.9, quantity: 12 },
    { sku: 'CHAIR-02', name: "Task Chair", priceEur: 89.9, quantity: 8 },
    { sku: 'DESK-03', name: "Writing Desk", priceEur: 149.9, quantity: 5 }
  ];
}

export const inventoryCategory = Object.freeze({ 'LAMP-01': 'lighting', 'CHAIR-02': 'seating', 'DESK-03': 'desks' });
