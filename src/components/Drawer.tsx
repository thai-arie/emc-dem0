import type { ReactNode } from "react";
import styles from "./Drawer.module.css";

export default function Drawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <aside className={styles.drawer}>
      <div className={styles.header}>
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
      </div>
      {children}
    </aside>
  );
}
