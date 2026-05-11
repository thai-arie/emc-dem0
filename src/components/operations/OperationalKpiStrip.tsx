interface OperationalKpi {
  label: string;
  value: string | number;
  tone?: "default" | "pending" | "critical";
}

export default function OperationalKpiStrip({ items }: { items: OperationalKpi[] }) {
  return (
    <section className="ops-kpi-strip" aria-label="Collections operating summary">
      {items.map((item) => (
        <div className={`ops-kpi-card ${item.tone === "pending" ? "is-pending" : item.tone === "critical" ? "is-critical" : ""}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
