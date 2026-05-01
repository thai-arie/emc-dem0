import { useUi } from "../store/ui";
import styles from "./Toast.module.css";

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <button className={styles.toast} onClick={onDismiss}>
      {message}
    </button>
  );
}

export default function ToastHost() {
  const toasts = useUi((state) => state.toasts);
  const dismiss = useUi((state) => state.dismissToast);
  return (
    <div className={styles.host}>
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}
