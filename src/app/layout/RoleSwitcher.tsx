import { useAuth } from "../../store/auth";
import styles from "./Topbar.module.css";

export default function RoleSwitcher() {
  const user = useAuth((state) => state.user);
  return <span className={styles.userChip}>{user?.role ?? ""}</span>;
}
