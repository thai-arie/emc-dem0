import { useEffect, useMemo, useState } from "react";
import DataTable from "../../components/DataTable";
import Drawer from "../../components/Drawer";
import { formatDate } from "../../lib/formatDate";
import { formatMoney } from "../../lib/formatMoney";
import { api, type FinancePartnerStatusRecord, type VehicleCatalogPayload, type VehicleCatalogRecord } from "../../services/api";
import { useUi } from "../../store/ui";
import { DetailField, FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, StockPill, financeStyles } from "./FinanceReferenceShared";
import { vehicleCatalog as fallbackVehicleCatalog, type VehicleCatalogItem } from "./financeReferenceData";
import { toVehicleCatalogItem } from "./vehicleCatalogAdapters";

type VehicleForm = {
  brand: string;
  model: string;
  variant: string;
  year: string;
  category: string;
  defaultPriceDollars: string;
  defaultCostDollars: string;
  stockCount: string;
  status: FinancePartnerStatusRecord;
  notes: string;
};

type CatalogRow = VehicleCatalogItem & { record: VehicleCatalogRecord };

const blankForm: VehicleForm = {
  brand: "",
  model: "",
  variant: "",
  year: "",
  category: "",
  defaultPriceDollars: "",
  defaultCostDollars: "",
  stockCount: "0",
  status: "ACTIVE",
  notes: ""
};

function dollars(cents: number | null | undefined) {
  if (cents == null) return "";
  return String(Math.round(cents / 100));
}

function cents(value: string) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? Math.round(next * 100) : 0;
}

function numberOrNull(value: string) {
  if (value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? Math.round(next) : null;
}

function formFromRecord(record: VehicleCatalogRecord): VehicleForm {
  return {
    brand: record.brand,
    model: record.model,
    variant: record.variant ?? "",
    year: record.year == null ? "" : String(record.year),
    category: record.category ?? "",
    defaultPriceDollars: dollars(record.default_price_cents),
    defaultCostDollars: dollars(record.default_cost_cents),
    stockCount: String(record.stock_count),
    status: record.status,
    notes: record.notes ?? ""
  };
}

function payloadFromForm(form: VehicleForm): VehicleCatalogPayload {
  return {
    brand: form.brand.trim(),
    model: form.model.trim(),
    variant: form.variant.trim() || null,
    year: numberOrNull(form.year),
    category: form.category.trim() || null,
    default_price_cents: cents(form.defaultPriceDollars),
    default_cost_cents: form.defaultCostDollars === "" ? null : cents(form.defaultCostDollars),
    stock_count: Math.max(0, Math.round(Number(form.stockCount || 0))),
    status: form.status,
    notes: form.notes.trim() || null
  };
}

function validatePayload(payload: VehicleCatalogPayload) {
  if (!payload.brand) return "Brand is required";
  if (!payload.model) return "Model is required";
  if (payload.default_price_cents < 0) return "Default sale price must be greater than or equal to 0";
  if (payload.default_cost_cents != null && payload.default_cost_cents < 0) return "Default vehicle cost must be greater than or equal to 0";
  if (payload.stock_count < 0 || !Number.isFinite(payload.stock_count)) return "Stock count must be greater than or equal to 0";
  return null;
}

export default function VehicleCatalog() {
  const [vehicles, setVehicles] = useState<VehicleCatalogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VehicleCatalogRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<VehicleForm>(blankForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useUi((state) => state.addToast);

  const rows: CatalogRow[] = useMemo(() => {
    if (vehicles.length) return vehicles.map((record) => ({ ...toVehicleCatalogItem(record), record }));
    return fallbackVehicleCatalog.map((item) => ({
      ...item,
      record: {
        id: item.id,
        brand: item.brand,
        model: item.model,
        variant: item.variant ?? null,
        year: item.year,
        category: item.category,
        default_price_cents: item.defaultSalePrice,
        default_cost_cents: item.defaultVehicleCost,
        stock_count: item.stockCount,
        status: item.active ? "ACTIVE" : "INACTIVE",
        notes: item.notes,
        created_at: "",
        updated_at: ""
      }
    }));
  }, [vehicles]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const result = await api.getVehicleCatalog();
      setVehicles(result.vehicles);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load vehicle catalog";
      setLoadError(message);
      toast(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVehicles();
  }, []);

  const summary = useMemo(() => {
    const active = rows.filter((item) => item.active);
    const totalSale = rows.reduce((sum, item) => sum + item.defaultSalePrice, 0);
    const totalCost = rows.reduce((sum, item) => sum + item.defaultVehicleCost, 0);
    const lowStock = rows.filter((item) => item.stockStatus !== "IN_STOCK").length;
    return [
      { label: "Catalog models", value: rows.length },
      { label: "Active models", value: active.length, tone: "green" as const },
      { label: "Avg sale price", value: rows.length ? formatMoney(Math.round(totalSale / rows.length)) : formatMoney(0) },
      { label: "Reference margin", value: formatMoney(totalSale - totalCost), tone: "blue" as const },
      { label: "Stock watch", value: lowStock, tone: lowStock ? ("amber" as const) : ("slate" as const) }
    ];
  }, [rows]);

  const openCreate = () => {
    setSelected(null);
    setForm(blankForm);
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    setSelected(row.record);
    setForm(formFromRecord(row.record));
    setFormError(null);
    setDrawerOpen(true);
  };

  const updateForm = (key: keyof VehicleForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveVehicle = async () => {
    const payload = payloadFromForm(form);
    const validationError = validatePayload(payload);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      const saved = selected ? await api.updateVehicleCatalogItem(selected.id, payload) : await api.createVehicleCatalogItem(payload);
      toast(selected ? "Vehicle updated" : "Vehicle added");
      await loadVehicles();
      setSelected(saved);
      setDrawerOpen(false);
      setFormError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vehicle save failed";
      setFormError(message);
      toast(message);
    } finally {
      setSaving(false);
    }
  };

  const selectedItem = selected ? toVehicleCatalogItem(selected) : null;

  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Vehicle Catalog</h1>
            <p className={financeStyles.intro}>Persisted finance reference for brands and models used during partner intake. These are pricing templates, not live financed assets or GPS devices.</p>
          </div>
          <button className="primary-button" onClick={openCreate}>+ Add Vehicle</button>
        </header>
        {loadError ? <p className={financeStyles.note}>{loadError}</p> : null}
        <FinanceSummaryStrip metrics={summary} />
        <section className="screen-panel">
          <h2>{loading ? "Loading catalog" : "Catalog reference"}</h2>
          <DataTable
            rows={rows}
            rowKey={(row) => row.id}
            onRowClick={openEdit}
            searchKey={(row) => `${row.brand} ${row.model} ${row.variant ?? ""} ${row.category} ${row.stockStatus}`}
            filters={[
              { label: "Active", predicate: (row) => row.active },
              { label: "In stock", predicate: (row) => row.stockStatus === "IN_STOCK" },
              { label: "Watch", predicate: (row) => row.stockStatus !== "IN_STOCK" }
            ]}
            exportCSV="vehicle-catalog.csv"
            columns={[
              { key: "traffic", header: "Signal", render: (row) => <FinanceTraffic tone={row.traffic} label={row.traffic === "green" ? "READY" : row.traffic === "amber" ? "WATCH" : "HOLD"} /> },
              { key: "brand", header: "Brand" },
              { key: "model", header: "Model", render: (row) => <span className={financeStyles.tableText}>{row.model}</span> },
              { key: "variant", header: "Variant", render: (row) => row.variant ?? "-", csvValue: (row) => row.variant ?? "" },
              { key: "year", header: "Year", render: (row) => row.record.year ?? "-", csvValue: (row) => row.record.year ?? "", sortValue: (row) => row.record.year ?? 0 },
              { key: "defaultSalePrice", header: "Default sale price", render: (row) => <span className={financeStyles.money}>{formatMoney(row.defaultSalePrice)}</span>, csvValue: (row) => row.defaultSalePrice, sortValue: (row) => row.defaultSalePrice },
              { key: "defaultVehicleCost", header: "Default vehicle cost", render: (row) => (row.record.default_cost_cents == null ? "-" : <span className={financeStyles.money}>{formatMoney(row.defaultVehicleCost)}</span>), csvValue: (row) => row.record.default_cost_cents ?? "", sortValue: (row) => row.defaultVehicleCost },
              { key: "category", header: "Category", render: (row) => row.record.category ?? "-" },
              { key: "stockStatus", header: "Stock status", render: (row) => <StockPill status={row.stockStatus} /> },
              { key: "active", header: "Active", render: (row) => <FinancePill active={row.active} /> }
            ]}
          />
        </section>
        {drawerOpen ? (
          <Drawer title={selected ? `${selected.brand} ${selected.model}` : "Add Vehicle"} onClose={() => setDrawerOpen(false)}>
            <div className={financeStyles.drawerStack}>
              <section className={financeStyles.drawerSection}>
                <h3>Vehicle reference</h3>
                <div className={financeStyles.controlGrid}>
                  <label>
                    <span>Brand</span>
                    <input value={form.brand} onChange={(event) => updateForm("brand", event.target.value)} />
                  </label>
                  <label>
                    <span>Model</span>
                    <input value={form.model} onChange={(event) => updateForm("model", event.target.value)} />
                  </label>
                  <label>
                    <span>Variant</span>
                    <input value={form.variant} onChange={(event) => updateForm("variant", event.target.value)} />
                  </label>
                  <label>
                    <span>Year</span>
                    <input type="number" min="0" value={form.year} onChange={(event) => updateForm("year", event.target.value)} />
                  </label>
                  <label>
                    <span>Category</span>
                    <input value={form.category} onChange={(event) => updateForm("category", event.target.value)} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={form.status} onChange={(event) => updateForm("status", event.target.value as FinancePartnerStatusRecord)}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className={financeStyles.drawerSection}>
                <h3>Reference economics</h3>
                <div className={financeStyles.controlGrid}>
                  <label>
                    <span>Default sale price</span>
                    <input type="number" min="0" value={form.defaultPriceDollars} onChange={(event) => updateForm("defaultPriceDollars", event.target.value)} />
                  </label>
                  <label>
                    <span>Default vehicle cost</span>
                    <input type="number" min="0" value={form.defaultCostDollars} onChange={(event) => updateForm("defaultCostDollars", event.target.value)} />
                  </label>
                  <label>
                    <span>Stock count</span>
                    <input type="number" min="0" value={form.stockCount} onChange={(event) => updateForm("stockCount", event.target.value)} />
                  </label>
                </div>
              </section>

              {selectedItem ? (
                <section className={financeStyles.drawerSection}>
                  <h3>Current record</h3>
                  <div className={financeStyles.detailGridTwo}>
                    <DetailField label="Reference ID" value={selected?.id ?? "-"} />
                    <DetailField label="Reference margin" value={formatMoney(selectedItem.defaultSalePrice - selectedItem.defaultVehicleCost)} />
                    <DetailField label="Stock" value={`${selectedItem.stockCount} units - ${selectedItem.stockStatus}`} />
                    <DetailField label="Updated" value={selected?.updated_at ? formatDate(selected.updated_at) : "-"} />
                  </div>
                </section>
              ) : null}

              <section className={financeStyles.drawerSection}>
                <h3>Notes</h3>
                <label className={financeStyles.fullWidthControl}>
                  <span>Notes</span>
                  <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
                </label>
              </section>

              {formError ? <p className={financeStyles.note}>{formError}</p> : null}
              <div className={financeStyles.saveBar}>
                <span>{selected ? "Updates the catalog reference only. No contract, GPS device, or operational workflow is changed." : "Creates a catalog reference only. No contract, GPS device, or operational workflow is created."}</span>
                <div>
                  <button className="secondary-button" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</button>
                  <button type="button" className="primary-button" onClick={saveVehicle} disabled={saving}>{saving ? "Saving..." : selected ? "Save vehicle" : "Add vehicle"}</button>
                </div>
              </div>
            </div>
          </Drawer>
        ) : null}
      </div>
    </FinanceGate>
  );
}
