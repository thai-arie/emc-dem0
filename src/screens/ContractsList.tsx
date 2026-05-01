import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import { actorFromUser, api, useApiData } from "../services/api";
import { formatMoney } from "../lib/formatMoney";
import { useAuth } from "../store/auth";

const today = new Date().toISOString().slice(0, 10);

export default function ContractsList() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const { data, reload } = useApiData(api.getContracts);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
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
    down_payment: "2000.00",
    financed_amount: "10000.00",
    monthly_total: "325.00",
    term_months: "36",
    start_date: today
  });
  const rows = data?.contracts ?? [];
  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">Contracts</h1>
        <button className="primary-button" onClick={() => setCreating(true)}>+ New Contract</button>
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
            <div className="form-grid">
              <input placeholder="Client full name" value={form.client_name} onChange={(event) => setForm({ ...form, client_name: event.target.value })} />
              <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <input placeholder="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              <input placeholder="National ID / passport" value={form.national_id} onChange={(event) => setForm({ ...form, national_id: event.target.value })} />
              <input placeholder="Emergency contact name" value={form.emergency_contact_name} onChange={(event) => setForm({ ...form, emergency_contact_name: event.target.value })} />
              <input placeholder="Emergency contact phone" value={form.emergency_contact_phone} onChange={(event) => setForm({ ...form, emergency_contact_phone: event.target.value })} />
              <input placeholder="Vehicle brand" value={form.vehicle_brand} onChange={(event) => setForm({ ...form, vehicle_brand: event.target.value })} />
              <input placeholder="Vehicle model" value={form.vehicle_model} onChange={(event) => setForm({ ...form, vehicle_model: event.target.value })} />
              <input placeholder="VIN" value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value })} />
              <input placeholder="Plate" value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value })} />
              <input placeholder="Vehicle price" value={form.vehicle_price} onChange={(event) => setForm({ ...form, vehicle_price: event.target.value })} />
              <input placeholder="Down payment" value={form.down_payment} onChange={(event) => setForm({ ...form, down_payment: event.target.value })} />
              <input placeholder="Financed amount" value={form.financed_amount} onChange={(event) => setForm({ ...form, financed_amount: event.target.value })} />
              <input placeholder="Monthly payment" value={form.monthly_total} onChange={(event) => setForm({ ...form, monthly_total: event.target.value })} />
              <input placeholder="Term months" value={form.term_months} onChange={(event) => setForm({ ...form, term_months: event.target.value })} />
              <input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
            </div>
          }
          confirmLabel="Create"
          onCancel={() => setCreating(false)}
          onConfirm={() => {
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
              vehicle_price: Math.round(Number(form.vehicle_price) * 100),
              down_payment: Math.round(Number(form.down_payment) * 100),
              financed_amount: Math.round(Number(form.financed_amount) * 100),
              monthly_total: Math.round(Number(form.monthly_total) * 100),
              term_months: Number(form.term_months),
              start_date: form.start_date,
              ...actorFromUser(user)
            }).then(() => {
              setCreating(false);
              reload();
            });
          }}
        />
      ) : null}
    </div>
  );
}
