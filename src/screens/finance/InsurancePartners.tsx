import { useEffect, useMemo, useState } from "react";
import DataTable from "../../components/DataTable";
import Drawer from "../../components/Drawer";
import { api, type FinancePartnerStatusRecord, type InsurancePartnerPayload, type InsurancePartnerRecord } from "../../services/api";
import { useUi } from "../../store/ui";
import { toInsurancePartnerOption } from "./financePartnerAdapters";
import { FinanceGate, FinancePill, FinanceSummaryStrip, FinanceTraffic, financeStyles } from "./FinanceReferenceShared";

type PartnerForm = {
  name: string;
  premium_pct: string;
  commission_pct: string;
  settlement_timing: string;
  status: FinancePartnerStatusRecord;
  notes: string;
};

const blankForm: PartnerForm = {
  name: "",
  premium_pct: "0",
  commission_pct: "0",
  settlement_timing: "Monthly pass-through",
  status: "ACTIVE",
  notes: ""
};

function formFromRecord(record: InsurancePartnerRecord | null): PartnerForm {
  if (!record) return blankForm;
  return {
    name: record.name,
    premium_pct: String(record.premium_pct),
    commission_pct: String(record.commission_pct),
    settlement_timing: record.settlement_timing,
    status: record.status,
    notes: record.notes
  };
}

function payloadFromForm(form: PartnerForm): InsurancePartnerPayload {
  return {
    name: form.name.trim(),
    premium_pct: Number(form.premium_pct || 0),
    commission_pct: Number(form.commission_pct || 0),
    settlement_timing: form.settlement_timing.trim(),
    status: form.status,
    notes: form.notes.trim()
  };
}

export default function InsurancePartners() {
  const [partners, setPartners] = useState<InsurancePartnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<InsurancePartnerRecord | null>(null);
  const [form, setForm] = useState<PartnerForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useUi((state) => state.addToast);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const result = await api.getInsurancePartners();
      setPartners(result.partners);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load insurance partners";
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
    const avgPremium = active.length ? active.reduce((sum, partner) => sum + partner.premium_pct, 0) / active.length : 0;
    const avgCommission = active.length ? active.reduce((sum, partner) => sum + partner.commission_pct, 0) / active.length : 0;
    return [
      { label: "Insurers", value: partners.length },
      { label: "Active", value: active.length, tone: "green" as const },
      { label: "Avg premium", value: `${avgPremium.toFixed(1)}%`, tone: "blue" as const },
      { label: "Avg commission", value: `${avgCommission.toFixed(1)}%`, tone: "amber" as const }
    ];
  }, [partners]);

  const openCreate = () => {
    setSelected(null);
    setForm(blankForm);
    setDrawerOpen(true);
  };

  const openEdit = (partner: InsurancePartnerRecord) => {
    setSelected(partner);
    setForm(formFromRecord(partner));
    setDrawerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      if (selected) {
        await api.updateInsurancePartner(selected.id, payload);
        toast("Insurance partner updated");
      } else {
        await api.createInsurancePartner(payload);
        toast("Insurance partner created");
      }
      await loadPartners();
      setDrawerOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Insurance partner save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinanceGate>
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1 className="screen-title">Insurance Partners</h1>
            <p className={financeStyles.intro}>Readonly operational screens remain untouched. Insurance partner terms here feed the Application insurance selector only.</p>
          </div>
          <button className="primary-button" onClick={openCreate}>+ Add Insurance Partner</button>
        </header>
        {error ? <p className={financeStyles.note}>{error}</p> : null}
        <FinanceSummaryStrip metrics={summary} />
        <section className="screen-panel">
          <h2>{loading ? "Loading insurers" : "Insurance reference"}</h2>
          <DataTable
            rows={partners}
            rowKey={(row) => row.id}
            onRowClick={openEdit}
            searchKey={(row) => `${row.name} ${row.settlement_timing} ${row.status} ${row.notes}`}
            filters={[
              { label: "Active", predicate: (row) => row.status === "ACTIVE" },
              { label: "Inactive", predicate: (row) => row.status === "INACTIVE" }
            ]}
            exportCSV="insurance-partners.csv"
            columns={[
              { key: "signal", header: "Signal", render: (row) => <FinanceTraffic tone={toInsurancePartnerOption(row).traffic} label={row.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"} />, sortValue: (row) => row.status },
              { key: "name", header: "Insurer", render: (row) => <span className={financeStyles.tableText}>{row.name}</span> },
              { key: "premium_pct", header: "Premium %", render: (row) => <span className={financeStyles.number}>{row.premium_pct.toFixed(1)}%</span>, sortValue: (row) => row.premium_pct },
              { key: "commission_pct", header: "Commission %", render: (row) => <span className={financeStyles.number}>{row.commission_pct.toFixed(1)}%</span>, sortValue: (row) => row.commission_pct },
              { key: "settlement_timing", header: "Settlement timing" },
              { key: "status", header: "Status", render: (row) => <FinancePill active={row.status === "ACTIVE"} label={row.status} /> },
              { key: "notes", header: "Notes", render: (row) => <span className={financeStyles.tableText}>{row.notes}</span> }
            ]}
          />
        </section>

        {drawerOpen ? (
          <Drawer title={selected ? `Edit ${selected.name}` : "Add Insurance Partner"} onClose={() => setDrawerOpen(false)}>
            <div className={financeStyles.drawerStack}>
              <section className={financeStyles.drawerSection}>
                <h3>Insurance terms</h3>
                <div className={financeStyles.controlGrid}>
                  <label>
                    <span>Insurer</span>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label>
                    <span>Premium %</span>
                    <input type="number" min="0" step="0.1" value={form.premium_pct} onChange={(event) => setForm((current) => ({ ...current, premium_pct: event.target.value }))} />
                  </label>
                  <label>
                    <span>Commission %</span>
                    <input type="number" min="0" step="0.1" value={form.commission_pct} onChange={(event) => setForm((current) => ({ ...current, commission_pct: event.target.value }))} />
                  </label>
                  <label>
                    <span>Settlement timing</span>
                    <input value={form.settlement_timing} onChange={(event) => setForm((current) => ({ ...current, settlement_timing: event.target.value }))} />
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
                <span>Reference data only. Saving this insurer does not create contracts, payments, GPS activity, or collections actions.</span>
                <div>
                  <button className="secondary-button" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</button>
                  <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save insurer"}</button>
                </div>
              </div>
            </div>
          </Drawer>
        ) : null}
      </div>
    </FinanceGate>
  );
}
