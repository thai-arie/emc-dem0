import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../store/auth";
import { useUi } from "../store/ui";
import { actorFromUser, api, useApiData } from "../services/api";
import StatusBadge from "./StatusBadge";
import styles from "./NotificationPanel.module.css";
import type { Alert } from "../entities/types";

function alertType(alert: Alert) {
  if (alert.severity === "CRITICAL") return "Immobilizer armed";
  if (alert.severity === "WARN") return "Overdue contract";
  return "INFO";
}

export default function NotificationPanel() {
  const { data, reload } = useApiData(api.getAlerts);
  const alerts = (data ?? []).filter((alert) => !alert.resolved_at);
  const user = useAuth((state) => state.user);
  const toast = useUi((state) => state.addToast);
  const panel = (
    <div className={styles.panel}>
      {alerts.length ? (
        alerts.map((alert) => (
          <div className={`${styles.item} ${alert.severity === "CRITICAL" ? styles.critical : ""}`} key={alert.id}>
            <div className={styles.itemHead}>
              <strong>{alert.title}</strong>
              <StatusBadge status={alert.severity} />
            </div>
            <div className={styles.type}>{alertType(alert)}</div>
            <p>{alert.message}</p>
            {!alert.acknowledged_at ? (
              <button
                onClick={() => {
                  api.acknowledgeAlert(alert.id, actorFromUser(user)).then(() => {
                    toast("Alert acknowledged");
                    reload();
                  });
                }}
              >
                Acknowledge
              </button>
            ) : null}
          </div>
        ))
      ) : (
        <p className={styles.empty}>No unresolved alerts</p>
      )}
      <Link className={styles.link} to="/notifications">
        Open notifications
      </Link>
    </div>
  );
  return createPortal(panel, document.body);
}
