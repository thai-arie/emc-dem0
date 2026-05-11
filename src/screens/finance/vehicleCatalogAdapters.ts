import type { VehicleCatalogRecord } from "../../services/api";
import type { TrafficTone, VehicleCatalogItem } from "./financeReferenceData";

function stockStatus(record: VehicleCatalogRecord): VehicleCatalogItem["stockStatus"] {
  if (record.status === "INACTIVE" || record.stock_count <= 0) return "OUT_OF_STOCK";
  if (record.stock_count <= 2) return "LOW_STOCK";
  return "IN_STOCK";
}

function traffic(record: VehicleCatalogRecord): TrafficTone {
  if (record.status === "INACTIVE") return "slate";
  return stockStatus(record) === "LOW_STOCK" ? "amber" : "green";
}

export function toVehicleCatalogItem(record: VehicleCatalogRecord): VehicleCatalogItem {
  return {
    id: record.id,
    brand: record.brand,
    model: record.model,
    variant: record.variant ?? undefined,
    year: record.year ?? new Date().getFullYear(),
    defaultSalePrice: record.default_price_cents,
    defaultVehicleCost: record.default_cost_cents ?? 0,
    category: record.category ?? "Uncategorized",
    stockStatus: stockStatus(record),
    stockCount: record.stock_count,
    active: record.status === "ACTIVE",
    traffic: traffic(record),
    notes: record.notes ?? ""
  };
}
