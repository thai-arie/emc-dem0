import { useState } from "react";
import { useParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import RoleGate from "../app/layout/RoleGate";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { actorFromUser, api, useApiData } from "../services/api";
import { useAuth } from "../store/auth";
import { useUi } from "../store/ui";
import { formatDate } from "../lib/formatDate";
import { formatMoney } from "../lib/formatMoney";

type LogActionType = "NOTE" | "CALL_ATTEMPT" | "SEND_REMINDER" | "REQUEST_IMMOBILIZER";

export default function CollectionsCaseDetail() {
  const { id } = useParams();
  const [note, setNote] = useState("");
  const user = useAuth((state) => state.user);
  const role = user?.role;
  const toast = useUi((state) => state.addToast);
  const { data, reload } = useApiData(api.getCollections);
  const kase = data?.cases.find((item) => item.id === id);
  const actions = (data?.actions ?? []).filter((item) => item.case_id === id);

  const logAction = (type: LogActionType) => {
    if (!kase) return;
    api.logCollectionAction(kase.id, { type, note, ...actorFromUser(user) }).then(() => {
      toast("Action logged");
      setNote("");
      reload();
    });
  };

  const approveImmobilizer = () => {
    if (!kase) return;
    api.approveImmobilizer(kase.id, actorFromUser(user)).then(() => {
      toast("Immobilizer approved");
      reload();
    });
  };

  const executeImmobilizer = () => {
    if (!kase) return;
    api.immobilize(kase.id, actorFromUser(user)).then(() => {
      toast("Immobilizer armed");
      reload();
    });
  };

  const approveRestoreAccess = () => {
    if (!kase) return;
    api.approveRestoreAccess(kase.id, actorFromUser(user)).then(() => {
      toast("Restore approved");
      reload();
    });
  };

  const executeRestoreAccess = () => {
    if (!kase) return;
    api.executeRestoreAccess(kase.id, actorFromUser(user)).then(() => {
      toast("Restore command sent");
      reload();
    });
  };

  if (role === "OPS" || role === "ADMIN") return <EmptyState title="Collections hidden" hint="This screen is not available for this role." />;
  if (!kase) return <div className="screen-panel">Case not found</div>;

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">{kase.id}</h1>
          <p className="screen-muted">{kase.contract_id} · {kase.client}</p>
        </div>
        <StatusBadge status={kase.status} />
      </div>

      <section className="screen-panel">
        <h2>Case detail</h2>
          <div className="screen-grid">
          <div><strong>Contract</strong><p>{kase.contract_id}</p></div>
          <div><strong>Client</strong><p>{kase.client}</p></div>
          <div><strong>DPD</strong><p>{kase.dpd}</p></div>
          <div><strong>Overdue amount</strong><p>{formatMoney(kase.overdue_amount)}</p></div>
          <div><strong>GPS status</strong><p><StatusBadge status={kase.gps_status} /></p></div>
          <div><strong>Restore status</strong><p>{kase.restore_command_status || "Not requested"}</p></div>
        </div>
      </section>

      <RoleGate roles={["COLLECTIONS"]}>
        <section className="screen-panel">
          <h2>Actions</h2>
          <div className="form-grid">
            <input placeholder="Optional text" value={note} onChange={(event) => setNote(event.target.value)} />
            <div className="button-row">
              <button className="secondary-button" onClick={() => logAction("NOTE")}>Add note</button>
              <button className="secondary-button" onClick={() => logAction("CALL_ATTEMPT")}>Log call</button>
              <button className="secondary-button" onClick={() => logAction("SEND_REMINDER")}>Send reminder</button>
              <button className="secondary-button" disabled={kase.status !== "OPEN" || (kase.workflow_next_action_type ?? kase.next_action_type) === "APPROVE_IMMOBILIZER" || kase.gps_status === "IMMOBILIZER_ARMED"} onClick={() => logAction("REQUEST_IMMOBILIZER")}>Request immobilizer</button>
              <button className="primary-button" disabled={kase.status !== "APPROVED"} onClick={executeImmobilizer}>Execute immobilizer</button>
              <button className="primary-button" disabled={kase.gps_status !== "IMMOBILIZER_ARMED" || kase.restore_command_status !== "APPROVED"} onClick={executeRestoreAccess}>Execute restore</button>
            </div>
          </div>
        </section>
      </RoleGate>

      <RoleGate roles={["FINANCIAL_CONTROLLER"]}>
        <section className="screen-panel">
          <h2>Controller approval</h2>
          <div className="button-row">
            <button className="primary-button" disabled={kase.status !== "OPEN" || (kase.workflow_next_action_type ?? kase.next_action_type) !== "APPROVE_IMMOBILIZER"} onClick={approveImmobilizer}>Approve immobilizer</button>
            <button className="primary-button" disabled={kase.gps_status !== "IMMOBILIZER_ARMED" || kase.overdue_amount > 0 || kase.restore_command_status === "APPROVED"} onClick={approveRestoreAccess}>Approve restore</button>
          </div>
        </section>
      </RoleGate>

      <section className="screen-panel">
        <h2>Timeline</h2>
        <DataTable
          rows={actions}
          rowKey={(row) => row.id}
          columns={[
            { key: "performed_at", header: "Timestamp", render: (row) => formatDate(row.performed_at) },
            { key: "type", header: "Type" },
            { key: "performed_by", header: "User" }
          ]}
        />
      </section>
    </div>
  );
}
