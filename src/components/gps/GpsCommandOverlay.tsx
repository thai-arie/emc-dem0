import React from "react";

type Props = {
  visible: boolean;
  isWarning: boolean;
  isTimeout: boolean;
};

export const GpsCommandOverlay: React.FC<Props> = ({
  visible,
  isWarning,
  isTimeout,
}) => {
  if (!visible) return null;

  let title = "GPS command in progress";
  let subtitle = "System is controlling the vehicle command. Operator actions are locked.";
  let status = "SENDING";
  let color = "#111827";
  let border = "#e5e7eb";

  if (isWarning) {
    title = "Waiting for GPS device response";
    subtitle = "The command was sent, but the device has not confirmed yet.";
    status = "WAITING";
    color = "#b45309";
    border = "#f59e0b";
  }

  if (isTimeout) {
    title = "GPS response delayed";
    subtitle = "Escalation required if the command does not complete automatically.";
    status = "ESCALATION";
    color = "#b91c1c";
    border = "#ef4444";
  }

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.card, borderColor: border }}>
        <div style={styles.topRow}>
          <span style={{ ...styles.badge, color, borderColor: border }}>{status}</span>
        </div>

        <div style={styles.spinner} />

        <h2 style={{ margin: 0, color }}>{title}</h2>

        <p style={styles.subtitle}>{subtitle}</p>

        <div style={styles.lockBox}>
          <strong>UI locked</strong>
          <span>No manual action is required after Execute.</span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(248,250,252,0.82)",
    backdropFilter: "blur(5px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  card: {
    background: "#ffffff",
    padding: "30px",
    borderRadius: "18px",
    boxShadow: "0 24px 80px rgba(15,23,42,0.18)",
    textAlign: "center",
    width: "390px",
    border: "1px solid #e5e7eb",
  },
  topRow: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "18px",
  },
  badge: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    padding: "6px 10px",
    border: "1px solid",
    borderRadius: "999px",
    background: "#ffffff",
  },
  spinner: {
    width: "44px",
    height: "44px",
    margin: "0 auto 18px",
    border: "4px solid #e5e7eb",
    borderTop: "4px solid #111827",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  subtitle: {
    color: "#4b5563",
    marginTop: "10px",
    lineHeight: 1.45,
  },
  lockBox: {
    marginTop: "18px",
    padding: "12px",
    borderRadius: "12px",
    background: "#f9fafb",
    color: "#374151",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "13px",
  },
};

export default GpsCommandOverlay;
