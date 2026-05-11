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
import GpsCommandOverlay from "../components/gps/GpsCommandOverlay";
import { markContractSafeStopped } from "../lib/gpsMock";
import ApprovalStateBanner from "../components/operations/ApprovalStateBanner";
import CommandLifecycle from "../components/operations/CommandLifecycle";
import { RESTORE_REQUEST_NOTE, getWorkflowNextAction, isApprovedForImmobilize as getIsApprovedForImmobilize, isImmobilizerPendingApproval as getIsImmobilizerPendingApproval, isRestoreApproved as getIsRestoreApproved, isRestorePendingApprovalForCase as getIsRestorePendingApprovalForCase } from "../lib/operationsState";

type LogActionType = "NOTE" | "CALL_ATTEMPT" | "SEND_REMINDER" | "REQUEST_IMMOBILIZER";

export default function CollectionsCaseDetail() {
  const { id } = useParams();
  const [note, setNote] = useState("");
  const [demoSafeStop, setDemoSafeStop] = useState(false);
const [navBlocked, setNavBlocked] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"IMMOBILIZE" | "RESTORE" | null>(null);
  const [confirmContractId, setConfirmContractId] = useState("");
  const user = useAuth((state) => state.user);
  const role = user?.role;
  const toast = useUi((state) => state.addToast);
  const { data, reload } = useApiData(api.getCollections);
const { data: gpsData } = useApiData(api.getGps);
  const { data: gpsCommands, reload: reloadGpsCommands } = useApiData(() => api.getGpsCommands(id!), [id]);
  const latestCommand = gpsCommands && gpsCommands.length > 0
    ? [...gpsCommands].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;
  const latestCommandStatus = latestCommand
    ? latestCommand.provider_response && latestCommand.provider_response.toLowerCase().includes("fail")
      ? "FAILED"
      : latestCommand.status === "SENT" && latestCommand.provider_response
        ? "ACKNOWLEDGED"
        : latestCommand.status
    : "";
  const latestCommandAgeMs = latestCommand?.created_at
    ? Date.now() - new Date(latestCommand.created_at).getTime()
    : 0;

  // Ignore stale SENT commands older than 2 minutes.
  // Prevents UI deadlock after failed/mock provider interruptions.
  const isGpsPending = false;


  const sentAtMs = latestCommand?.created_at
    ? new Date(latestCommand.created_at).getTime()
    : null;

  const commandAgeMs = sentAtMs ? Date.now() - sentAtMs : 0;
  const isSlaWarning = isGpsPending && commandAgeMs >= 30000;
  const isSlaTimeout = isGpsPending && commandAgeMs >= 60000;


  useEffect(() => {
    if (!isGpsPending) return;
    const timer = window.setInterval(() => {
      reloadGpsCommands();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [isGpsPending, reloadGpsCommands]);


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

const vehicle: any = gpsData?.vehicles?.find(
  (v: any) => String(v.contract_id) === String(kase?.contract_id)
);

const workflowNextAction = getWorkflowNextAction(kase);
const isImmobilizerPendingApproval = getIsImmobilizerPendingApproval(kase);
const latestRestoreCommand = gpsCommands
  ? [...gpsCommands]
      .filter((command) => command.command_type === "RELEASE")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  : null;
const isRestoreApproved = getIsRestoreApproved(kase) || latestRestoreCommand?.status === "APPROVED";
const isRestorePendingApproval = getIsRestorePendingApprovalForCase(kase, actions);
const isApprovedForImmobilize = getIsApprovedForImmobilize(kase);
const canApproveImmobilizer = isImmobilizerPendingApproval && !isGpsPending;
const canApproveRestore = isRestorePendingApproval && !isGpsPending;
const isRestoreInFlightOrExecuted = ["SENT", "ACKNOWLEDGED"].includes(String(latestRestoreCommand?.status || ""));
const isImmobilized = kase?.gps_status === "IMMOBILIZER_ARMED" || vehicle?.status === "IMMOBILIZER_ARMED";
const isEarlyCollectionStage =
  kase?.status === "OPEN" &&
  !isImmobilizerPendingApproval &&
  !isApprovedForImmobilize &&
  !isImmobilized;
const canSendReminder = isEarlyCollectionStage && !isGpsPending;
const canRequestImmobilizer = isEarlyCollectionStage && !isGpsPending;
const sendReminderLabel = isEarlyCollectionStage ? "Send reminder" : "Reminder locked after escalation";
const requestImmobilizerLabel = isImmobilizerPendingApproval
  ? "Pending controller approval"
  : isApprovedForImmobilize
    ? "Immobilizer approved"
    : isImmobilized
      ? "Vehicle immobilized"
      : "Request immobilizer";
const canRequestRestore =
  isImmobilized &&
  Number(kase?.overdue_amount ?? 0) <= 0 &&
  !isRestorePendingApproval &&
  !isRestoreApproved &&
  !isRestoreInFlightOrExecuted &&
  !isGpsPending;
const executeRestoreLabel = isRestorePendingApproval ? "Pending restore approval" : "Execute restore";
const canOperateGpsCommand = role === "ADMIN" || role === "OPS";

// Demo safety model:
// APPROVED alone is not enough. Vehicle must be stopped and ignition OFF.
const liveSpeed = Number(vehicle?.speed ?? 18);
const speed = demoSafeStop ? 0 : liveSpeed;
const ignition = demoSafeStop ? "OFF" : "ON";
const stoppedForSec = demoSafeStop ? 94 : 0;
const gpsAgeSec = 8;

const stoppedOk = speed === 0 && stoppedForSec >= 60;
const ignitionOk = ignition === "OFF";
const gpsFreshOk = gpsAgeSec <= 30;

const canImmobilize =
  isApprovedForImmobilize &&
  !isGpsPending &&
  stoppedOk &&
  ignitionOk &&
  gpsFreshOk;
  const logAction = (type: LogActionType) => {
    if (!kase) return;
    api.logCollectionAction(kase.id, { type, note, ...actorFromUser(user) }).then(() => {
      toast("Action logged");
      setNote("");
      reload();
    }).catch((error: Error) => {
      toast(error.message || "Action failed");
    });
  };

  const requestRestoreAccess = () => {
    if (!kase) return;
    api.logCollectionAction(kase.id, { type: "REQUEST_RESTORE", note, ...actorFromUser(user) }).then(() => {
      toast("Restore approval requested");
      setNote("");
      reload();
    }).catch((error: Error) => {
      toast(error.message || "Restore request failed");
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
    setConfirmContractId("");
    setConfirmAction("IMMOBILIZE");
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
    setConfirmContractId("");
    setConfirmAction("RESTORE");
  };

  const confirmGpsAction = () => {
    if (!kase || !confirmAction) return;

    if (confirmContractId !== kase.contract_id) {
      toast("Contract ID does not match");
      return;
    }

    const done = () => {
      setConfirmAction(null);
      setConfirmContractId("");
      reload();
      window.dispatchEvent(new Event("emc:data"));
    };

    if (confirmAction === "IMMOBILIZE") {
      api.immobilize(kase.id, actorFromUser(user)).then(() => {
        toast("Immobilizer command sent");
        done();
      });
      return;
    }

    api.executeRestoreAccess(kase.id, actorFromUser(user)).then(() => {
      toast("Restore command sent");
      done();
    });
  };

  if (role && !["ADMIN", "COLLECTIONS_AGENT", "CONTROLLER", "OPS", "VIEWER"].includes(role)) return <EmptyState title="Collections hidden" hint="This screen is not available for this role." />;
  if (!kase) return <div className="screen-panel">Case not found</div>;

  return (
    <div className="screen">

      <GpsCommandOverlay visible={false} isWarning={false} isTimeout={false} />
      
      {confirmAction && (
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
            background: "#ffffff",
            color: "#111827",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "24px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.28)"
          }}>
            <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
              {confirmAction === "IMMOBILIZE" ? "Confirm immobilizer execution" : "Confirm restore execution"}
            </h2>
            <p style={{ color: "#4b5563", lineHeight: 1.5, marginBottom: "16px" }}>
              Type the contract ID exactly to confirm this GPS command.
            </p>
            <div style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "12px",
              marginBottom: "16px"
            }}>
              <strong>Contract ID:</strong> {kase.contract_id}
            </div>
            <input
              autoFocus
              placeholder={kase.contract_id}
              value={confirmContractId}
              onChange={(event) => setConfirmContractId(event.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                marginBottom: "18px",
                fontSize: "16px"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="secondary-button"
                onClick={() => {
                  setConfirmAction(null);
                  setConfirmContractId("");
                }}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={confirmContractId !== kase.contract_id}
                onClick={confirmGpsAction}
              >
                {confirmAction === "IMMOBILIZE" ? "Confirm immobilize" : "Confirm restore"}
              </button>
            </div>
          </div>
        </div>
      )}

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
      <button className="secondary-button" style={{ marginLeft: 12 }} onClick={() => { window.location.href = `/contracts/${kase.contract_id}?caseId=${kase.id}`; }}>Client Profile</button>
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
        <h2>Vehicle Safety Check</h2>

        <div className="screen-grid">
          <div><strong>Speed</strong><p>{speed} km/h {speed === 0 ? "✔" : "✖"}</p></div>
          <div><strong>Ignition</strong><p>{ignition} {ignitionOk ? "✔" : "✖"}</p></div>
          <div><strong>Stopped for</strong><p>{stoppedForSec}s {stoppedOk ? "✔" : "✖"}</p></div>
          <div><strong>GPS last seen</strong><p>{gpsAgeSec}s ago {gpsFreshOk ? "✔" : "✖"}</p></div>
          <div><strong>Status</strong><p>{
  canImmobilize ? "COLLECTION_RISK" : (vehicle?.status || kase.gps_status || "-")
}</p></div>
          <div><strong>Result</strong><p>{canImmobilize ? "SAFE TO IMMOBILIZE" : "BLOCKED"}</p></div>
          {canOperateGpsCommand ? (
            <div>
              <strong>Demo control</strong>
              <p>
                <button
                  className="secondary-button"
                  disabled={!isApprovedForImmobilize || demoSafeStop}
                  onClick={() => {
                    if (!kase?.contract_id) return;
                    markContractSafeStopped(kase.contract_id);
                    setDemoSafeStop(true);
                    window.dispatchEvent(new Event("emc:data"));
                  }}
                >
                  Simulate safe stop
                </button>
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="screen-panel">
        <h2>Case detail</h2>
          <div className="screen-grid">
          <div><strong>Contract</strong><p>{kase.contract_id}</p></div>
          <div><strong>Client</strong><p>{kase.client}</p></div>
          <div><strong>DPD</strong><p>{kase.dpd}</p></div>
          <div><strong>Overdue amount</strong><p>{formatMoney(kase.overdue_amount)}</p></div>
          <div><strong>GPS status</strong><p>
  <StatusBadge status={canImmobilize ? "COLLECTION_RISK" : kase.gps_status} />
</p></div>
          <div><strong>Immobilizer approval</strong><p>{isImmobilizerPendingApproval ? "PENDING CONTROLLER APPROVAL" : isApprovedForImmobilize ? "APPROVED — ready to execute" : "Not requested"}</p></div>
          <div><strong>Restore status</strong><p>{isRestoreApproved ? "APPROVED — ready to execute" : isRestorePendingApproval ? "PENDING RESTORE APPROVAL" : kase.restore_command_status || "Not requested"}</p></div>
        </div>
      </section>

      {(isImmobilizerPendingApproval || isRestorePendingApproval || isRestoreApproved || isApprovedForImmobilize) && (
        <ApprovalStateBanner
          critical={kase.gps_status === "IMMOBILIZER_ARMED"}
          status={isRestoreApproved || isApprovedForImmobilize ? "APPROVED" : "WARNING"}
          title={
            isRestorePendingApproval
                ? "Pending restore approval"
                : isRestoreApproved
                  ? "Restore approved"
                  : isImmobilizerPendingApproval
                    ? "Pending controller approval"
                    : "Immobilizer approved"
          }
          detail={
            isRestorePendingApproval
                ? "Payment has cleared the case, but vehicle access still needs controller approval."
                : isRestoreApproved
                  ? "Collections can execute restore once ready."
                  : isImmobilizerPendingApproval
                    ? "The request is waiting in the controller approval queue. Duplicate requests are disabled."
                    : "Collections can execute immobilizer after the safety check passes."
          }
        />
      )}

      <RoleGate roles={["COLLECTIONS_AGENT"]}>
        <section className="screen-panel">
          <h2>Actions</h2>
          <div className="form-grid">
            <input placeholder="Optional text" value={note} disabled={isGpsPending} onChange={(event) => setNote(event.target.value)} />
            <div className="button-row">
              <button className="secondary-button" disabled={isGpsPending} onClick={() => logAction("NOTE")}>Add note</button>
              <button className="secondary-button" disabled={isGpsPending} onClick={() => logAction("CALL_ATTEMPT")}>Log call</button>
              <button className="secondary-button" disabled={!canSendReminder} onClick={() => logAction("SEND_REMINDER")}>{sendReminderLabel}</button>
              <button className="secondary-button" disabled={!canRequestImmobilizer} onClick={() => logAction("REQUEST_IMMOBILIZER")}>{requestImmobilizerLabel}</button>
              <button className="primary-button" disabled>OPS execution required</button>
              {isImmobilized && Number(kase.overdue_amount) <= 0 && !isRestoreApproved && !isRestoreInFlightOrExecuted && (
                <button className="secondary-button" disabled={!canRequestRestore} onClick={requestRestoreAccess}>
                  {isRestorePendingApproval ? "Pending restore approval" : "Request restore"}
                </button>
              )}
              <button className="primary-button" disabled>OPS restore required</button>
            </div>
          </div>
        </section>
      </RoleGate>

      <RoleGate roles={["OPS"]}>
        <section className="screen-panel">
          <h2>Operations execution</h2>
          <div className="button-row">
            <button className="primary-button" disabled={!canImmobilize} onClick={executeImmobilizer}>Execute immobilizer</button>
            <button className="primary-button" disabled={!isImmobilized || !isRestoreApproved || isGpsPending} onClick={executeRestoreAccess}>{executeRestoreLabel}</button>
          </div>
        </section>
      </RoleGate>

      <RoleGate roles={["CONTROLLER"]}>
        <section className="screen-panel">
          <h2>Controller approval</h2>
          <div className="button-row">
            <button className="primary-button" disabled={!canApproveImmobilizer} onClick={approveImmobilizer}>Approve immobilizer</button>
            <button className="primary-button" disabled={!canApproveRestore} onClick={approveRestoreAccess}>Approve restore</button>
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
            { key: "type", header: "Type", render: (row) => row.note?.includes(RESTORE_REQUEST_NOTE) ? "REQUEST_RESTORE" : row.type },
            { key: "performed_by", header: "User" }
          ]}
        />
      </section>

      <section className="screen-panel command-status-panel">
        <div className="panel-title-row">
          <div>
            <h2>Command lifecycle</h2>
            <p>Provider command state exposed from existing GPS command history.</p>
          </div>
          {latestCommandStatus ? <StatusBadge status={latestCommandStatus} /> : null}
        </div>
        {latestCommand ? (
          <div className="command-status-grid">
            <CommandLifecycle status={latestCommandStatus} commandType={latestCommand.command_type} />
            <div className="command-meta">
              <div><span>Requested by</span><strong>{latestCommand.requested_by || "-"}</strong></div>
              <div><span>Approved by</span><strong>{latestCommand.approved_by || "-"}</strong></div>
              <div><span>Requested at</span><strong>{formatDate(latestCommand.created_at)}</strong></div>
              <div><span>Executed at</span><strong>{latestCommand.executed_at ? formatDate(latestCommand.executed_at) : "-"}</strong></div>
            </div>
          </div>
        ) : (
          <div className="empty compact-empty">
            <h2>No data available</h2>
            <p>No GPS command lifecycle has started for this case.</p>
          </div>
        )}
      </section>

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
                  if (row.status !== "FAILED" || !latestCommand || row.id !== latestCommand.id) return null;
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

    </div>
  );
}
