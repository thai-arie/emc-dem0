export default function EmptyState({ title = "No data available", hint }: { title?: string; hint?: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}
