import styles from "./KpiCard.module.css";

export default function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className={styles.card} style={{ borderTopColor: accent ?? "var(--color-accent)" }}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
    </div>
  );
}
