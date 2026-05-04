import { useState, useEffect } from "react";
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
const [navBlocked, setNavBlocked] = useState(false);
  const user = useAuth((state) => state.user);
  const role = user?.role;
  const toast = useUi((state) => state.addToast);
  const { data, reload } = useApiData(api.getCollections);
  const { data: gpsCommands } = useApiData(() => api.getGpsCommands(id!), [id]);
  const latestCommand = gpsCommands && gpsCommands.length > 0
    ? [...gpsCommands].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;
  const isGpsPending = !!latestCommand && (latestCommand.status === "SENT" || latestCommand.status === "REQUESTED");

  useEffect(() => {
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (!isGpsPending) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const clickHandler = (e: MouseEvent) => {
      if (!isGpsPending) return;

      const target = e.target as HTMLElement | null;
      const link = target?.closest("a");

      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;

      e.preventDefault();
      e.stopPropagation();

      setNavBlocked(true);
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    document.addEventListener("click", clickHandler, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      document.removeEventListener("click", clickHandler, true);
    };
  }, [isGpsPending]);


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

    const typed = window.prompt(`Type contract ID to confirm immobilization: ${kase.contract_id}`);
    if (typed !== kase.contract_id) {
      toast("Immobilizer execution cancelled");
      return;
    }

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

    const typed = window.prompt(`Type contract ID to confirm restore: ${kase.contract_id}`);
    if (typed !== kase.contract_id) {
      toast("Restore execution cancelled");
      return;
    }

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
      {navBlocked && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0, 0, 0, 0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }}>
          <div style={{
            width: "min(560px, 100%)",
            background: "#7f1d1d",
            color: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.45)"
          }}>
            <h2 style={{ marginTop: 0, marginBottom: "12px" }}>
              GPS command still in progress
            </h2>
            <p style={{ marginBottom: "20px", lineHeight: 1.5 }}>
              You cannot leave this case until the GPS command is ACKNOWLEDGED or FAILED.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="secondary-button"
                onClick={() => setNavBlocked(false)}
              >
                Stay on page
              </button>
            </div>
          </div>
        </div>
      )}

        <div>
          <h1 className="screen-title">{kase.id}</h1>
          <p className="screen-muted">{kase.contract_id} · {kase.client}</p>
        </div>
        <StatusBadge status={kase.status} />
      </div>

      
      {isGpsPending && (
        <div style={{
          background: "#332200",
          color: "#ffcc66",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "12px"
        }}>
          GPS command in progress. Wait for confirmation before leaving this case.
        </div>
      )}

<section className="screen-panel">
        <h2>Case detail</h2>
          <div className="screen-grid">
          <div><strong>Contract</strong><p>{kase.contract_id}</p></div>
          <div><strong>Client</strong><p>{kase.client}</p></div>
          <div><strong>DPD</strong><p>{kase.dpd}</p></div>
          <div><strong>Overdue amount</strong><p>{formatMoney(kase.overdue_amount)}</p></div>
          <div><strong>GPS status</strong><p><StatusBadge status={kase.gps_status} /></p></div>
          <div><strong>Immobilizer approval</strong><p>{kase.status === "APPROVED" ? "APPROVED — ready to execute" : (kase.workflow_next_action_type ?? kase.next_action_type) === "APPROVE_IMMOBILIZER" ? "PENDING APPROVAL" : "Not requested"}</p></div>
          <div><strong>Restore status</strong><p>{kase.restore_command_status === "APPROVED" ? "APPROVED — ready to execute" : kase.restore_command_status || "Not requested"}</p></div>
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
              <button className="secondary-button" disabled={kase.status !== "OPEN" || (kase.workflow_next_action_type ?? kase.next_action_type) === "APPROVE_IMMOBILIZER" || kase.gps_status === "IMMOBILIZER_ARMED" || isGpsPending} onClick={() => logAction("REQUEST_IMMOBILIZER")}>Request immobilizer</button>
              <button className="primary-button" disabled={kase.status !== "APPROVED" || isGpsPending} onClick={executeImmobilizer}>Execute immobilizer</button>
              <button className="primary-button" disabled={kase.gps_status !== "IMMOBILIZER_ARMED" || kase.restore_command_status !== "APPROVED" || isGpsPending} onClick={executeRestoreAccess}>Execute restore</button>
            </div>
          </div>
        </section>
      </RoleGate>

      <RoleGate roles={["FINANCIAL_CONTROLLER"]}>
        <section className="screen-panel">
          <h2>Controller approval</h2>
          <div className="button-row">
            <button className="primary-button" disabled={kase.status !== "OPEN" || (kase.workflow_next_action_type ?? kase.next_action_type) !== "APPROVE_IMMOBILIZER" || isGpsPending} onClick={approveImmobilizer}>Approve immobilizer</button>
            <button className="primary-button" disabled={kase.gps_status !== "IMMOBILIZER_ARMED" || kase.overdue_amount > 0 || kase.restore_command_status === "APPROVED" || isGpsPending} onClick={approveRestoreAccess}>Approve restore</button>
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
      
      <section className="screen-panel">
        <h2>GPS Command History</h2>
        {isGpsPending && (
          <div style={{
            background: "#332200",
            color: "#ffcc66",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "12px",
            border: "1px solid #ffcc66"
          }}>
            GPS command in progress. Do not leave this case until the command is ACKNOWLEDGED or FAILED.
          </div>
        )}
        {!gpsCommands || gpsCommands.length === 0 ? (
          <p>No GPS commands yet</p>
        ) : (
          <DataTable
            rows={gpsCommands}
            rowKey={(row) => row.id}
            columns={[
              { key: "command_type", header: "Command" },
              {
  key: "status",
  header: "Status",
  render: (row) => {
    if (row.provider_response && row.provider_response.toLowerCase().includes("fail")) {
      return "FAILED";
    }
    if (row.status === "SENT" && row.provider_response) {
      return "ACKNOWLEDGED";
    }
    return row.status;
  }
},
              { key: "provider_response", header: "Provider Message" },
              { key: "requested_by", header: "Requested by" },
              { key: "approved_by", header: "Approved by" },
              { key: "created_at", header: "Created", render: (row) => formatDate(row.created_at) },
              { key: "executed_at", header: "Executed", render: (row) => row.executed_at ? formatDate(row.executed_at) : "—" },
              {
                key: "actions",
                header: "",
                render: (row) => {
                  if (row.status !== "FAILED") return null;
                  return (
                    <button
                      className="secondary-button"
                      onClick={() => {
                        api.retryGpsCommand(row.id).then(() => {
                          window.dispatchEvent(new Event("emc:data"));
                        });
                      }}
                    >
                      Retry
                    </button>
                  );
                }
              }
            ]}
          />
        )}
      </section>

</section>
    </div>
  );
}
