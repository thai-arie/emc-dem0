import { useMemo, useState } from "react";
import DataTable from "../../components/DataTable";
import Drawer from "../../components/Drawer";
import { formatMoney } from "../../lib/formatMoney";
import { DetailField, FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, StockPill, financeStyles } from "./FinanceReferenceShared";
import { vehicleCatalog, type VehicleCatalogItem } from "./financeReferenceData";

export default function VehicleCatalog() {
  const [selected, setSelected] = useState<VehicleCatalogItem | null>(null);
  const summary = useMemo(() => {
    const active = vehicleCatalog.filter((item) => item.active);
    const totalSale = vehicleCatalog.reduce((sum, item) => sum + item.defaultSalePrice, 0);
    const totalCost = vehicleCatalog.reduce((sum, item) => sum + item.defaultVehicleCost, 0);
    const lowStock = vehicleCatalog.filter((item) => item.stockStatus !== "IN_STOCK").length;
    return [
      { label: "Catalog models", value: vehicleCatalog.length },
      { label: "Active models", value: active.length, tone: "green" as const },
      { label: "Avg sale price", value: formatMoney(Math.round(totalSale / vehicleCatalog.length)) },
      { label: "Reference margin", value: formatMoney(totalSale - totalCost), tone: "blue" as const },
      { label: "Stock watch", value: lowStock, tone: "amber" as const }
    ];
  }, []);

  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Vehicle Catalog</h1>
            <p className={financeStyles.intro}>Readonly finance reference from the legacy vehicle catalog. These are pricing templates, not live financed assets or GPS devices.</p>
          </div>
        </header>
        <FinanceSummaryStrip metrics={summary} />
        <section className="screen-panel">
          <h2>Catalog reference</h2>
          <DataTable
            rows={vehicleCatalog}
            rowKey={(row) => row.id}
            onRowClick={setSelected}
            searchKey={(row) => `${row.brand} ${row.model} ${row.category} ${row.stockStatus}`}
            filters={[
              { label: "Active", predicate: (row) => row.active },
              { label: "In stock", predicate: (row) => row.stockStatus === "IN_STOCK" },
              { label: "Watch", predicate: (row) => row.stockStatus !== "IN_STOCK" }
            ]}
            columns={[
              { key: "traffic", header: "Signal", render: (row) => <FinanceTraffic tone={row.traffic} label={row.traffic === "green" ? "READY" : row.traffic === "amber" ? "WATCH" : "HOLD"} /> },
              { key: "brand", header: "Brand" },
              { key: "model", header: "Model" },
              { key: "year", header: "Year", sortValue: (row) => row.year },
              { key: "defaultSalePrice", header: "Default sale price", render: (row) => <span className={financeStyles.money}>{formatMoney(row.defaultSalePrice)}</span>, csvValue: (row) => row.defaultSalePrice, sortValue: (row) => row.defaultSalePrice },
              { key: "defaultVehicleCost", header: "Default vehicle cost", render: (row) => <span className={financeStyles.money}>{formatMoney(row.defaultVehicleCost)}</span>, csvValue: (row) => row.defaultVehicleCost, sortValue: (row) => row.defaultVehicleCost },
              { key: "category", header: "Category" },
              { key: "stockStatus", header: "Stock status", render: (row) => <StockPill status={row.stockStatus} /> },
              { key: "active", header: "Active", render: (row) => <FinancePill active={row.active} /> }
            ]}
          />
        </section>
        {selected ? (
          <Drawer title={`${selected.brand} ${selected.model}`} onClose={() => setSelected(null)}>
            <div className={financeStyles.detailGrid}>
              <DetailField label="Reference ID" value={selected.id} />
              <DetailField label="Default sale price" value={formatMoney(selected.defaultSalePrice)} />
              <DetailField label="Default vehicle cost" value={formatMoney(selected.defaultVehicleCost)} />
              <DetailField label="Reference margin" value={formatMoney(selected.defaultSalePrice - selected.defaultVehicleCost)} />
              <DetailField label="Stock" value={`${selected.stockCount} units - ${selected.stockStatus}`} />
              <DetailField label="Category" value={selected.category} />
              <div className={financeStyles.note}>{selected.notes}</div>
            </div>
          </Drawer>
        ) : null}
      </div>
    </FinanceGate>
  );
}

