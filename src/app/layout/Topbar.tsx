import NotificationBell from "../../components/NotificationBell";
import { api } from "../../services/api";
import { useAuth } from "../../store/auth";
import { useNavigate } from "react-router-dom";
import styles from "./Topbar.module.css";

export default function Topbar() {
  const user = useAuth((state) => state.user);
  const clearUser = useAuth((state) => state.clearUser);
  const navigate = useNavigate();
  const logout = async () => {
    try {
      await api.logout();
    } finally {
      clearUser();
      navigate("/login", { replace: true });
    }
  };
  return (
    <header className={styles.topbar}>
      <div>
        <div className={styles.brand}>EMC Operations</div>
        <div className={styles.subtle}>Mock data demo</div>
      </div>
      <div className={styles.actions}>
        <NotificationBell />
        <div className={styles.userChip}>{user ? `${user.email} · ${user.role}` : ""}</div>
        <button className={styles.logoutButton} onClick={logout} type="button">
          Logout
        </button>
      </div>
    </header>
  );
}
