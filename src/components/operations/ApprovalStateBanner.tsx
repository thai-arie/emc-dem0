import StatusBadge from "../StatusBadge";

interface ApprovalStateBannerProps {
  title: string;
  detail: string;
  status: string;
  critical?: boolean;
}

export default function ApprovalStateBanner({ title, detail, status, critical = false }: ApprovalStateBannerProps) {
  return (
    <section className={`workflow-state-card ${critical ? "is-critical" : "is-pending"}`}>
      <div>
        <span>Current workflow state</span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <StatusBadge status={status} />
    </section>
  );
}
