import RoleSwitcher from "./RoleSwitcher";
import NotificationBell from "../../components/NotificationBell";
import { useAuth } from "../../store/auth";
import styles from "./Topbar.module.css";

export default function Topbar() {
  const user = useAuth((state) => state.user);
  return (
    <header className={styles.topbar}>
      <div>
        <div className={styles.brand}>EMC Operations</div>
        <div className={styles.subtle}>Mock data demo</div>
      </div>
      <div className={styles.actions}>
        <NotificationBell />
        <RoleSwitcher />
        <div className={styles.userChip}>{user?.full_name}</div>
      </div>
    </header>
  );
}
