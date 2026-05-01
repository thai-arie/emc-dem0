import { useState } from "react";
import { api, useApiData } from "../services/api";
import NotificationPanel from "./NotificationPanel";
import styles from "./NotificationPanel.module.css";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useApiData(api.getAlerts);
  const count = (data ?? []).filter((alert) => !alert.resolved_at).length;
  return (
    <div style={{ position: "relative" }}>
      <button className={styles.link} onClick={() => setOpen((value) => !value)} aria-label="Notifications">
        Bell {count ? `(${count})` : ""}
      </button>
      {open ? <NotificationPanel /> : null}
    </div>
  );
}
