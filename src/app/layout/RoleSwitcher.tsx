import type { Role } from "../../entities/types";
import { useAuth } from "../../store/auth";
import styles from "./Topbar.module.css";

const roles: { label: string; value: Role }[] = [
  { label: "CEO", value: "CEO" },
  { label: "Collections officer", value: "COLLECTIONS" },
  { label: "Ops", value: "OPS" }
];

export default function RoleSwitcher() {
  const user = useAuth((state) => state.user);
  const switchRole = useAuth((state) => state.switchRole);
  return (
    <select className={styles.userChip} value={user?.role ?? "CEO"} onChange={(event) => switchRole(event.target.value as Role)}>
      {roles.map((role) => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
