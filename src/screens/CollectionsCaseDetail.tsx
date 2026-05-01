import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import WorkflowStepper from "../components/WorkflowStepper";
import ConfirmDialog from "../components/ConfirmDialog";
import RoleGate from "../app/layout/RoleGate";
import StatusBadge from "../components/StatusBadge";
import { actorFromUser, api, useApiData } from "../services/api";
import { useAuth } from "../store/auth";
import { useUi } from "../store/ui";
import { formatDate } from "../lib/formatDate";

export default function CollectionsCaseDetail() {
  const { id } = useParams();
  const [confirm, setConfirm] = useState(false);
  const user = useAuth((state) => state.user);
  const toast = useUi((state) => state.addToast);
  const { data, reload } = useApiData(api.getCollections);
  const kase = data?.cases.find((item) => item.id === id);
  const actions = (data?.actions ?? []).filter((item) => item.case_id === id);
  if (!kase) return <div className="screen-panel">Case not found</div>;
  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">{kase.id}</h1>
          <p className="screen-muted">{kase.contract_id} · <Link to={`/clients/${kase.client_id}`}>{kase.client}</Link></p>
        </div>
        <StatusBadge status={kase.status} />
      </div>
      <WorkflowStepper status={kase.status} />
      <RoleGate roles={["COLLECTIONS"]}>
        <div className="button-row">
          <button className="primary-button" disabled={kase.status !== "OPEN"} onClick={() => { api.sendSms(kase.id, actorFromUser(user)).then(() => { toast("SMS sent"); reload(); }); }}>
            Send SMS
          </button>
          <button className="danger-button" disabled={kase.status !== "SMS_SENT"} onClick={() => setConfirm(true)}>
            Arm immobilizer
          </button>
        </div>
      </RoleGate>
      <DataTable
        rows={actions}
        rowKey={(row) => row.id}
        columns={[
          { key: "type", header: "Type" },
          { key: "performed_by", header: "Performed by" },
          { key: "performed_at", header: "Performed at", render: (row) => formatDate(row.performed_at) }
        ]}
      />
      {confirm ? (
        <ConfirmDialog
          title="Arm immobilizer"
          message={`Arm immobilizer for ${kase.contract_id}?`}
          confirmLabel="Arm immobilizer"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            api.immobilize(kase.id, actorFromUser(user)).then(() => {
              toast("Immobilizer armed");
              setConfirm(false);
              reload();
            });
          }}
        />
      ) : null}
    </div>
  );
}
