import { NavLink } from "react-router-dom";
import RoleGate from "./RoleGate";
import styles from "./Sidebar.module.css";

const operations = [
  { label: "Overview", to: "/" },
  { label: "Contracts", to: "/contracts" },
  { label: "Payments", to: "/payments" },
  { label: "Collections", to: "/collections", roles: ["CEO", "COLLECTIONS"] as const },
  { label: "GPS", to: "/gps" }
];

const system = [
  { label: "Notifications", to: "/notifications" },
  { label: "Audit Log", to: "/audit" }
];

export default function Sidebar() {
  const item = (entry: { label: string; to: string }) => (
    <NavLink className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`} to={entry.to} end={entry.to === "/"}>
      {entry.label}
    </NavLink>
  );
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>EMC MVP</div>
      <div className={styles.groupTitle}>OPERATIONS</div>
      <nav className={styles.nav}>
        {operations.map((entry) =>
          "roles" in entry ? (
            <RoleGate key={entry.to} roles={entry.roles ? [...entry.roles] : []}>
              {item(entry)}
            </RoleGate>
          ) : (
            <div key={entry.to}>{item(entry)}</div>
          )
        )}
      </nav>
      <div className={styles.groupTitle}>SYSTEM</div>
      <nav className={styles.nav}>{system.map((entry) => <div key={entry.to}>{item(entry)}</div>)}</nav>
    </aside>
  );
}
