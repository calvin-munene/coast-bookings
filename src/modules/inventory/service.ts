export type InventoryDay = Readonly<{
  date: string;
  capacity: number;
  held: number;
  sold: number;
  closed: boolean;
}>;

export type InventoryRequest = Readonly<{
  quantity: number;
  dates: readonly string[];
}>;

export type InventoryDecision =
  | Readonly<{ available: true; remainingByDate: Readonly<Record<string, number>> }>
  | Readonly<{ available: false; unavailableDates: readonly string[] }>;

export function checkInventory(
  inventory: readonly InventoryDay[],
  request: InventoryRequest,
): InventoryDecision {
  if (!Number.isInteger(request.quantity) || request.quantity < 1) {
    throw new Error("Inventory quantity must be a positive integer");
  }
  const byDate = new Map(inventory.map((day) => [day.date, day]));
  const unavailableDates: string[] = [];
  const remainingByDate: Record<string, number> = {};

  for (const date of [...new Set(request.dates)].sort()) {
    const day = byDate.get(date);
    if (!day || day.closed || day.capacity - day.held - day.sold < request.quantity) {
      unavailableDates.push(date);
      continue;
    }
    remainingByDate[date] = day.capacity - day.held - day.sold - request.quantity;
  }
  return unavailableDates.length > 0
    ? { available: false, unavailableDates }
    : { available: true, remainingByDate };
}
