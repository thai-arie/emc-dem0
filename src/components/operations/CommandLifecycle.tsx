import StatusBadge from "../StatusBadge";

const STEPS = ["REQUESTED", "APPROVED", "SENT", "ACKNOWLEDGED"] as const;

type CommandStatus = "REQUESTED" | "APPROVED" | "SENT" | "ACKNOWLEDGED" | "FAILED" | "";

interface CommandLifecycleProps {
  status: CommandStatus;
  commandType?: string | null;
  compact?: boolean;
}

export default function CommandLifecycle({ status, commandType, compact = false }: CommandLifecycleProps) {
  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number]);
  const failed = status === "FAILED";

  return (
    <div className={compact ? "command-lifecycle compact" : "command-lifecycle"}>
      <div className="command-lifecycle-header">
        <span>{commandType || "GPS command"}</span>
        <StatusBadge status={status || "REQUESTED"} />
      </div>
      <div className="command-lifecycle-rail" aria-label="GPS command lifecycle">
        {STEPS.map((step, index) => {
          const active = !failed && currentIndex >= index;
          return (
            <div className={active ? "command-lifecycle-step active" : "command-lifecycle-step"} key={step}>
              <span />
              <small>{step}</small>
            </div>
          );
        })}
        {failed && (
          <div className="command-lifecycle-step failed">
            <span />
            <small>FAILED / RETRY</small>
          </div>
        )}
      </div>
    </div>
  );
}
