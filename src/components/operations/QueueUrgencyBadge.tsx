import type { QueueUrgency } from "../../lib/operationsState";

interface QueueUrgencyBadgeProps {
  level: QueueUrgency;
  label?: string;
}

export default function QueueUrgencyBadge({ level, label }: QueueUrgencyBadgeProps) {
  return <span className={`queue-urgency ${level.toLowerCase()}`}>{label ?? level}</span>;
}
