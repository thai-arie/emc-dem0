import { NavLink } from "react-router-dom";
import RoleGate from "./RoleGate";
import { useAuth } from "../../store/auth";
import type { Role } from "../../entities/types";
import styles from "./Sidebar.module.css";

type SidebarEntry = {
  label: string;
  to: string;
  roles?: readonly Role[];
  strictRoles?: readonly Role[];
};

const operations: SidebarEntry[] = [
  { label: "Overview", to: "/" },
  { label: "Contracts", to: "/contracts" },
  { label: "Payments", to: "/payments" },
  { label: "Collections", to: "/collections", strictRoles: ["CEO", "FINANCIAL_CONTROLLER", "COLLECTIONS"] as const },
  { label: "GPS", to: "/gps" },
  { label: "Devices", to: "/devices" },
  { label: "Reporting", to: "/reporting", roles: ["CEO", "FINANCIAL_CONTROLLER"] as const }
];

const system = [
  { label: "Notifications", to: "/notifications" },
  { label: "Audit Log", to: "/audit" }
];

export default function Sidebar() {
  const role = useAuth((state) => state.user?.role);
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
          entry.strictRoles ? (
            role && entry.strictRoles.includes(role) ? <div key={entry.to}>{item(entry)}</div> : null
          ) : 
          entry.roles ? (
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
