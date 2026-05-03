import { statusTaxonomy } from "../config/statusTaxonomy";
import styles from "./StatusBadge.module.css";

export default function StatusBadge({ status }: { status: string }) {
  const item: { label: string; tone: "green" | "red" | "orange" | "amber" | "blue" | "slate" } = statusTaxonomy[status] ?? { label: status, tone: "slate" };
  return <span className={`${styles.badge} ${styles[item.tone]}`}>{item.label}</span>;
}
