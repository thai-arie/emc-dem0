import { Link } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useUi } from "../store/ui";
import { actorFromUser, api, useApiData } from "../services/api";
import StatusBadge from "./StatusBadge";
import styles from "./NotificationPanel.module.css";

export default function NotificationPanel() {
  const { data, reload } = useApiData(api.getAlerts);
  const alerts = (data ?? []).filter((alert) => !alert.resolved_at);
  const user = useAuth((state) => state.user);
  const toast = useUi((state) => state.addToast);
  return (
    <div className={styles.panel}>
      {alerts.length ? (
        alerts.map((alert) => (
          <div className={styles.item} key={alert.id}>
            <div className={styles.itemHead}>
              <strong>{alert.title}</strong>
              <StatusBadge status={alert.severity} />
            </div>
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
}
