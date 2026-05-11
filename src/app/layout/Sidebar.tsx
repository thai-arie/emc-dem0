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
  { label: "Overview", to: "/overview", roles: ["VIEWER"] as const },
  { label: "Contracts", to: "/contracts", roles: ["FINANCE", "OPS", "CONTROLLER", "VIEWER"] as const },
  { label: "Payments", to: "/payments", roles: ["FINANCE", "COLLECTIONS_AGENT", "VIEWER"] as const },
  { label: "Collections", to: "/collections", roles: ["COLLECTIONS_AGENT", "CONTROLLER", "VIEWER"] as const },
  { label: "GPS", to: "/gps", roles: ["COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"] as const },
  { label: "Devices", to: "/devices", roles: ["COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"] as const },
  { label: "Reporting", to: "/reporting", roles: ["FINANCE", "CONTROLLER", "VIEWER"] as const }
];

const finance: SidebarEntry[] = [
  { label: "Applications", to: "/finance/applications", roles: ["SALES", "FINANCE", "VIEWER"] as const },
  { label: "Portfolio", to: "/finance/portfolio", roles: ["FINANCE", "VIEWER"] as const },
  { label: "Vehicle Catalog", to: "/finance/vehicle-catalog", roles: ["SALES", "FINANCE", "VIEWER"] as const },
  { label: "Pricing Tiers", to: "/finance/pricing-tiers", roles: ["SALES", "FINANCE", "VIEWER"] as const },
  { label: "Financial Partners", to: "/finance/financial-partners", roles: ["FINANCE", "VIEWER"] as const },
  { label: "Insurance Partners", to: "/finance/insurance-partners", roles: ["FINANCE", "VIEWER"] as const },
  { label: "Bank Accounts", to: "/finance/bank-accounts", roles: ["FINANCE", "VIEWER"] as const }
];

const system: SidebarEntry[] = [
  { label: "Notifications", to: "/notifications", roles: ["OPS", "CONTROLLER", "COLLECTIONS_AGENT", "VIEWER"] as const },
  { label: "Audit Log", to: "/audit", roles: ["FINANCE", "CONTROLLER", "VIEWER"] as const },
  { label: "User Management", to: "/admin/users", strictRoles: ["ADMIN"] as const }
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
      <div className={styles.groupTitle}>FINANCE</div>
      <nav className={styles.nav}>
        {finance.map((entry) => (entry.roles ? <RoleGate key={entry.to} roles={[...entry.roles]}>{item(entry)}</RoleGate> : <div key={entry.to}>{item(entry)}</div>))}
      </nav>
      <div className={styles.groupTitle}>SYSTEM</div>
      <nav className={styles.nav}>
        {system.map((entry) =>
          entry.strictRoles ? (
            role && entry.strictRoles.includes(role) ? <div key={entry.to}>{item(entry)}</div> : null
          ) : entry.roles ? (
            <RoleGate key={entry.to} roles={[...entry.roles]}>{item(entry)}</RoleGate>
          ) : (
            <div key={entry.to}>{item(entry)}</div>
          )
        )}
      </nav>
    </aside>
  );
}
