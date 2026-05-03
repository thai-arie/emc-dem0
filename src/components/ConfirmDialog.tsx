import { useEffect } from "react";
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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.backdrop} onMouseDown={onCancel}>
      <div
        className={styles.dialog}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className={styles.header}>
          <h2 id="dialog-title">{title}</h2>
          <button className={styles.closeButton} type="button" aria-label="Close" onClick={onCancel}>
            X
          </button>
        </div>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className={styles.confirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
