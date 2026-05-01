import type { ReactNode } from "react";
import styles from "./ConfirmDialog.module.css";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog}>
        <h2>{title}</h2>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button onClick={onCancel}>Cancel</button>
          <button className={styles.confirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
