import type { PropsWithChildren, ReactNode } from "react";
import type { TrafficTone } from "./financeReferenceData";
import styles from "./FinanceReference.module.css";

type Metric = {
  label: string;
  value: ReactNode;
  tone?: "green" | "amber" | "blue" | "slate";
};

export function FinanceGate({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export function FinanceSummaryStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className={styles.summaryStrip}>
      {metrics.map((metric) => (
        <div key={metric.label} className={styles.summaryItem} data-tone={metric.tone ?? "slate"}>
          <span className={styles.summaryLabel}>{metric.label}</span>
          <strong className={styles.summaryValue}>{metric.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function FinanceTraffic({ tone, label }: { tone: TrafficTone; label: string }) {
  const toneClass = tone === "green" ? styles.signalGreen : tone === "amber" ? styles.signalAmber : tone === "red" ? styles.signalRed : tone === "blue" ? styles.signalBlue : "";
  return (
    <span className={`${styles.signal} ${toneClass}`}>
      <span className={styles.signalDot} />
      {label}
    </span>
  );
}

export function FinancePill({ active, label }: { active: boolean; label?: string }) {
  return <span className={`${styles.pill} ${active ? styles.pillGreen : styles.pillSlate}`}>{label ?? (active ? "ACTIVE" : "INACTIVE")}</span>;
}

export function StockPill({ status }: { status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" }) {
  const className = status === "IN_STOCK" ? styles.pillGreen : status === "LOW_STOCK" ? styles.pillAmber : styles.pillSlate;
  return <span className={`${styles.pill} ${className}`}>{status}</span>;
}

export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.detailCard}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}

export { styles as financeStyles };
