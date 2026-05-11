import { useEffect, useMemo, useState } from "react";
import DataTable from "../../components/DataTable";
import Drawer from "../../components/Drawer";
import { api, type FinancialPartnerPayload, type FinancialPartnerRecord, type FinancePartnerStatusRecord } from "../../services/api";
import { useUi } from "../../store/ui";
import { toFinancialPartnerOption } from "./financePartnerAdapters";
import { FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";

type PartnerForm = {
  name: string;
  funding_type: string;
  cost_rate_pct: string;
  active_contracts_count: string;
  status: FinancePartnerStatusRecord;
  notes: string;
};

const blankForm: PartnerForm = {
  name: "",
  funding_type: "Bank partner",
  cost_rate_pct: "0",
  active_contracts_count: "0",
  status: "ACTIVE",
  notes: ""
};

function formFromRecord(record: FinancialPartnerRecord | null): PartnerForm {
  if (!record) return blankForm;
  return {
    name: record.name,
    funding_type: record.funding_type,
    cost_rate_pct: String(record.cost_rate_pct),
    active_contracts_count: String(record.active_contracts_count),
    status: record.status,
    notes: record.notes
  };
}

function payloadFromForm(form: PartnerForm): FinancialPartnerPayload {
  return {
    name: form.name.trim(),
    funding_type: form.funding_type.trim(),
    cost_rate_pct: Number(form.cost_rate_pct || 0),
    active_contracts_count: Math.max(0, Math.round(Number(form.active_contracts_count || 0))),
    status: form.status,
    notes: form.notes.trim()
  };
}

export default function FinancialPartners() {
  const [partners, setPartners] = useState<FinancialPartnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<FinancialPartnerRecord | null>(null);
  const [form, setForm] = useState<PartnerForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useUi((state) => state.addToast);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const result = await api.getFinancialPartners();
      setPartners(result.partners);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load financial partners";
      setError(message);
      toast(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPartners();
  }, []);

  const summary = useMemo(() => {
    const active = partners.filter((partner) => partner.status === "ACTIVE");
    const avgCost = active.length ? active.reduce((sum, partner) => sum + partner.cost_rate_pct, 0) / active.length : 0;
    return [
      { label: "Partners", value: partners.length },
      { label: "Active", value: active.length, tone: "green" as const },
      { label: "Avg cost rate", value: `${avgCost.toFixed(1)}%`, tone: "blue" as const },
      { label: "Watch partners", value: partners.filter((partner) => toFinancialPartnerOption(partner).traffic === "amber").length, tone: "amber" as const }
    ];
  }, [partners]);

  const openCreate = () => {
    setSelected(null);
    setForm(blankForm);
    setDrawerOpen(true);
  };

  const openEdit = (partner: FinancialPartnerRecord) => {
    setSelected(partner);
    setForm(formFromRecord(partner));
    setDrawerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      if (selected) {
        await api.updateFinancialPartner(selected.id, payload);
        toast("Financial partner updated");
      } else {
        await api.createFinancialPartner(payload);
        toast("Financial partner created");
      }
      await loadPartners();
      setDrawerOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Financial partner save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Financial Partners</h1>
            <p className={financeStyles.intro}>Funding partner terms used by application underwriting. These records feed the Application partner selector only.</p>
          </div>
          <button className="primary-button" onClick={openCreate}>+ Add Financial Partner</button>
        </header>
        {error ? <p className={financeStyles.note}>{error}</p> : null}
        <FinanceSummaryStrip metrics={summary} />
        <section className="screen-panel">
          <h2>{loading ? "Loading partners" : "Funding reference"}</h2>
          <DataTable
            rows={partners}
            rowKey={(row) => row.id}
            onRowClick={openEdit}
            searchKey={(row) => `${row.name} ${row.funding_type} ${row.status} ${row.notes}`}
            filters={[
              { label: "Active", predicate: (row) => row.status === "ACTIVE" },
              { label: "Watch", predicate: (row) => toFinancialPartnerOption(row).traffic === "amber" },
              { label: "Inactive", predicate: (row) => row.status === "INACTIVE" }
            ]}
            exportCSV="financial-partners.csv"
            columns={[
              { key: "signal", header: "Signal", render: (row) => <FinanceTraffic tone={toFinancialPartnerOption(row).traffic} label={row.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"} />, sortValue: (row) => row.status },
              { key: "name", header: "Partner", render: (row) => <span className={financeStyles.tableText}>{row.name}</span> },
              { key: "funding_type", header: "Funding type" },
              { key: "cost_rate_pct", header: "Cost rate", render: (row) => <span className={financeStyles.number}>{row.cost_rate_pct.toFixed(1)}%</span>, sortValue: (row) => row.cost_rate_pct },
              { key: "active_contracts_count", header: "Active contracts", render: (row) => <span className={financeStyles.number}>{row.active_contracts_count}</span>, sortValue: (row) => row.active_contracts_count },
              { key: "status", header: "Status", render: (row) => <FinancePill active={row.status === "ACTIVE"} label={row.status} /> },
              { key: "notes", header: "Notes", render: (row) => <span className={financeStyles.tableText}>{row.notes}</span> }
            ]}
          />
        </section>

        {drawerOpen ? (
          <Drawer title={selected ? `Edit ${selected.name}` : "Add Financial Partner"} onClose={() => setDrawerOpen(false)}>
            <div className={financeStyles.drawerStack}>
              <section className={financeStyles.drawerSection}>
                <h3>Partner terms</h3>
                <div className={financeStyles.controlGrid}>
                  <label>
                    <span>Partner name</span>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label>
                    <span>Funding type</span>
                    <input value={form.funding_type} onChange={(event) => setForm((current) => ({ ...current, funding_type: event.target.value }))} />
                  </label>
                  <label>
                    <span>Cost rate %</span>
                    <input type="number" min="0" step="0.1" value={form.cost_rate_pct} onChange={(event) => setForm((current) => ({ ...current, cost_rate_pct: event.target.value }))} />
                  </label>
                  <label>
                    <span>Active contracts</span>
                    <input type="number" min="0" value={form.active_contracts_count} onChange={(event) => setForm((current) => ({ ...current, active_contracts_count: event.target.value }))} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FinancePartnerStatusRecord }))}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>
                  <label className={financeStyles.fullWidthControl}>
                    <span>Notes</span>
                    <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                  </label>
                </div>
              </section>
              <div className={financeStyles.saveBar}>
                <span>Reference data only. Saving this partner does not create contracts, payments, GPS activity, or collections actions.</span>
                <div>
                  <button className="secondary-button" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</button>
                  <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save partner"}</button>
                </div>
              </div>
            </div>
          </Drawer>
        ) : null}
      </div>
    </FinanceGate>
  );
}
