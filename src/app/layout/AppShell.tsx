import { Navigate, Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { canAccessRoute, routeForRole } from "../roleAccess";
import { useAuth } from "../../store/auth";
import ToastHost from "../../components/Toast";
import styles from "./AppShell.module.css";

export default function AppShell() {
  const user = useAuth((state) => state.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessRoute(user.role, location.pathname)) return <Navigate to={routeForRole(user.role)} replace />;
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
