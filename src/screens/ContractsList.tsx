import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import RoleGate from "../app/layout/RoleGate";
import { actorFromUser, api, useApiData } from "../services/api";
import { formatMoney } from "../lib/formatMoney";
import { useAuth } from "../store/auth";
import { useUi } from "../store/ui";

const today = new Date().toISOString().slice(0, 10);
type ContractForm = {
  client_name: string;
  phone: string;
  address: string;
  national_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  vehicle_brand: string;
  vehicle_model: string;
  vin: string;
  plate: string;
  vehicle_price: string;
  down_payment_percent: string;
  apr_percent: string;
  gps_fee: string;
  service_fee: string;
  insurance_fee: string;
  term_months: string;
  start_date: string;
};
type ContractFormKey = keyof ContractForm;

export default function ContractsList() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const addToast = useUi((state) => state.addToast);
  const { data, reload } = useApiData(api.getContracts);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ContractForm>({
    client_name: "",
    phone: "",
    address: "",
    national_id: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    vehicle_brand: "",
    vehicle_model: "",
    vin: "",
    plate: "",
    vehicle_price: "12000.00",
    down_payment_percent: "20",
    apr_percent: "12",
    gps_fee: "15.00",
    service_fee: "20.00",
    insurance_fee: "35.00",
    term_months: "36",
    start_date: today
  });
  const rows = data?.contracts ?? [];

  const updateForm = (key: ContractFormKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key] && !current.form) return current;
      const { [key]: _fieldError, form: _formError, ...rest } = current;
      return rest;
    });
  };

  const closeCreateDialog = () => {
    setCreating(false);
    setErrors({});
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const requiredFields: Array<[ContractFormKey, string]> = [
      ["client_name", "Client full name"],
      ["phone", "Phone"],
      ["address", "Address"],
      ["national_id", "National ID / passport"],
      ["vehicle_brand", "Vehicle brand"],
      ["vehicle_model", "Vehicle model"],
      ["vin", "VIN"],
      ["plate", "Plate"],
      ["vehicle_price", "Vehicle price"],
      ["down_payment_percent", "Down payment %"],
      ["apr_percent", "APR %"],
      ["term_months", "Term months"],
      ["gps_fee", "GPS fee"],
      ["service_fee", "Service / risk fee"],
      ["insurance_fee", "Insurance fee"],
      ["start_date", "Start date"]
    ];

    requiredFields.forEach(([key, label]) => {
      if (!form[key].trim()) nextErrors[key] = `${label} is required`;
    });

    [
      ["vehicle_price", "Vehicle price"],
      ["down_payment_percent", "Down payment %"],
      ["apr_percent", "APR %"],
      ["gps_fee", "GPS fee"],
      ["service_fee", "Service / risk fee"],
      ["insurance_fee", "Insurance fee"]
    ].forEach(([key, label]) => {
      const value = Number(form[key as ContractFormKey]);
      if (!Number.isFinite(value) || value < 0) nextErrors[key] = `${label} must be a valid amount`;
    });

    const downPaymentPercent = Number(form.down_payment_percent);
    if (Number.isFinite(downPaymentPercent) && downPaymentPercent > 100) nextErrors.down_payment_percent = "Down payment % cannot exceed 100";

    const term = Number(form.term_months);
    if (!Number.isInteger(term) || term <= 0) nextErrors.term_months = "Term months must be a positive whole number";

    return nextErrors;
  };

  const renderField = (key: ContractFormKey, label: string, type = "text") => (
    <label className="field-label">
      <span>{label}</span>
      <input
        type={type}
        placeholder={label}
        value={form[key]}
        onChange={(event) => updateForm(key, event.target.value)}
        aria-invalid={errors[key] ? "true" : "false"}
      />
      {errors[key] ? <span className="field-error">{errors[key]}</span> : null}
    </label>
  );

  const amountCents = (value: string) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  };

  const dollars = (cents: number) => cents / 100;

  const amortizedMonthlyCents = (principalCents: number, aprPercent: number, termMonths: number) => {
    if (principalCents <= 0 || termMonths <= 0) return 0;
    const principal = dollars(principalCents);
    const monthlyRate = aprPercent / 100 / 12;
    const monthly = monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
    return Math.round(monthly * 100);
  };

  const vehiclePrice = amountCents(form.vehicle_price);
  const downPaymentPercent = Number(form.down_payment_percent) || 0;
  const aprPercent = Number(form.apr_percent) || 0;
  const termMonths = Number(form.term_months) || 0;
  const gpsFee = amountCents(form.gps_fee);
  const serviceFee = amountCents(form.service_fee);
  const insuranceFee = amountCents(form.insurance_fee);
  const downPaymentAmount = Math.round(vehiclePrice * downPaymentPercent / 100);
  const financedAmount = Math.max(0, vehiclePrice - downPaymentAmount);
  const baseMonthlyPayment = amortizedMonthlyCents(financedAmount, aprPercent, termMonths);
  const totalMonthlyPayment = baseMonthlyPayment + gpsFee + serviceFee + insuranceFee;

  const dealSummary = {
    vehiclePrice,
    downPaymentPercent,
    downPaymentAmount,
    financedAmount,
    aprPercent,
    baseMonthlyPayment,
    gpsFee,
    serviceFee,
    insuranceFee,
    totalMonthlyPayment,
    termMonths
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">Contracts</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="secondary-button" to="/contracts/void">
            Voided
          </Link>
          <RoleGate roles={["OPS", "FINANCIAL_CONTROLLER"]}>
            <button
              className="primary-button"
              onClick={() => {
                setErrors({});
                setCreating(true);
              }}
            >
              + New Contract
            </button>
          </RoleGate>
        </div>
      </div>
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/contracts/${row.id}`)}
        searchKey={(row) => `${row.id} ${row.client} ${row.status}`}
        filters={[{ label: "OVERDUE", predicate: (row) => row.status === "OVERDUE" }, { label: "ACTIVE", predicate: (row) => row.status === "ACTIVE" }]}
        exportCSV="contracts.csv"
        columns={[
          { key: "id", header: "ID" },
          { key: "client", header: "Client", render: (row) => <Link onClick={(event) => event.stopPropagation()} to={`/clients/${row.client_id}`}>{row.client}</Link> },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "monthly_total", header: "Monthly total", render: (row) => formatMoney(row.monthly_total), sortValue: (row) => row.monthly_total }
        ]}
      />
      {creating ? (
        <ConfirmDialog
          title="New Contract"
          message={
            <div className="contract-create-layout">
              <div className="form-grid">
                {errors.form ? <div className="form-error">{errors.form}</div> : null}
                {renderField("client_name", "Client full name")}
                {renderField("phone", "Phone")}
                {renderField("address", "Address")}
                {renderField("national_id", "National ID / passport")}
                {renderField("emergency_contact_name", "Emergency contact name")}
                {renderField("emergency_contact_phone", "Emergency contact phone")}
                {renderField("vehicle_brand", "Vehicle brand")}
                {renderField("vehicle_model", "Vehicle model")}
                {renderField("vin", "VIN")}
                {renderField("plate", "Plate")}
                {renderField("vehicle_price", "Vehicle price")}
                <div className="form-section-title">Loan Terms</div>
                {renderField("down_payment_percent", "Down payment %")}
                <div className="field-label">
                  <span>Down payment amount</span>
                  <input value={formatMoney(dealSummary.downPaymentAmount)} readOnly disabled />
                </div>
                <div className="field-label">
                  <span>Financed amount</span>
                  <input value={formatMoney(dealSummary.financedAmount)} readOnly disabled />
                </div>
                {renderField("apr_percent", "APR %")}
                {renderField("term_months", "Term months")}
                <div className="field-label">
                  <span>Base monthly payment</span>
                  <input value={formatMoney(dealSummary.baseMonthlyPayment)} readOnly disabled />
                </div>
                {renderField("gps_fee", "GPS fee")}
                {renderField("service_fee", "Service / risk fee")}
                {renderField("insurance_fee", "Insurance fee")}
                <div className="field-label">
                  <span>TOTAL monthly payment</span>
                  <input value={formatMoney(dealSummary.totalMonthlyPayment)} readOnly disabled />
                </div>
                {renderField("start_date", "Start date", "date")}
              </div>
              <aside className="deal-summary-panel" aria-label="Deal Summary">
                <div>
                  <span>Deal Summary</span>
                  <strong>TOTAL monthly payment</strong>
                  <p>{formatMoney(dealSummary.totalMonthlyPayment)}</p>
                </div>
                <dl>
                  <div><dt>Vehicle price</dt><dd>{formatMoney(dealSummary.vehiclePrice)}</dd></div>
                  <div><dt>Down payment %</dt><dd>{dealSummary.downPaymentPercent || 0}%</dd></div>
                  <div><dt>Down payment amount</dt><dd>{formatMoney(dealSummary.downPaymentAmount)}</dd></div>
                  <div><dt>Financed amount</dt><dd>{formatMoney(dealSummary.financedAmount)}</dd></div>
                  <div><dt>APR</dt><dd>{dealSummary.aprPercent || 0}%</dd></div>
                  <div><dt>Term</dt><dd>{dealSummary.termMonths || "-"} months</dd></div>
                  <div><dt>Base monthly payment</dt><dd>{formatMoney(dealSummary.baseMonthlyPayment)}</dd></div>
                  <div><dt>GPS fee</dt><dd>{formatMoney(dealSummary.gpsFee)}</dd></div>
                  <div><dt>Service / risk fee</dt><dd>{formatMoney(dealSummary.serviceFee)}</dd></div>
                  <div><dt>Insurance fee</dt><dd>{formatMoney(dealSummary.insuranceFee)}</dd></div>
                </dl>
              </aside>
            </div>
          }
          confirmLabel="Create"
          onCancel={closeCreateDialog}
          onConfirm={() => {
            const nextErrors = validateForm();
            if (Object.keys(nextErrors).length > 0) {
              setErrors(nextErrors);
              return;
            }
            api.createContract({
              client_name: form.client_name,
              phone: form.phone,
              address: form.address,
              national_id: form.national_id,
              emergency_contact_name: form.emergency_contact_name,
              emergency_contact_phone: form.emergency_contact_phone,
              vehicle_brand: form.vehicle_brand,
              vehicle_model: form.vehicle_model,
              vin: form.vin,
              plate: form.plate,
              vehicle_price: dealSummary.vehiclePrice,
              down_payment: dealSummary.downPaymentAmount,
              financed_amount: dealSummary.financedAmount,
              monthly_total: dealSummary.totalMonthlyPayment,
              term_months: Number(form.term_months),
              start_date: form.start_date,
              ...actorFromUser(user)
            }).then(() => {
              closeCreateDialog();
              reload();
              addToast("Contract created");
            }).catch((error: Error) => {
              setErrors({ form: error.message || "Unable to create contract" });
            });
          }}
        />
      ) : null}
    </div>
  );
}
