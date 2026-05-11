import type { CSSProperties } from "react";

interface QueuePressureStripProps {
  pending: number;
  warning: number;
  critical: number;
  failed: number;
}

function pressureStyle(value: number) {
  return { "--pressure": Math.max(1, value) } as CSSProperties & Record<"--pressure", number>;
}

export default function QueuePressureStrip({ pending, warning, critical, failed }: QueuePressureStripProps) {
  return (
    <section className="queue-pressure-strip" aria-label="Queue pressure">
      <div className="queue-pressure-label">
        <span>Queue pressure</span>
        <strong>{critical || failed ? "Immediate review required" : warning ? "Aging pressure building" : pending ? "Pending decisions active" : "No bottleneck"}</strong>
      </div>
      <div className="queue-pressure-bars">
        <span style={pressureStyle(pending)} />
        <span className="warning" style={pressureStyle(warning)} />
        <span className="critical" style={pressureStyle(critical + failed)} />
      </div>
      <div className="queue-pressure-counts">
        <span>{pending} pending</span>
        <span>{warning} warning</span>
        <span>{critical + failed} critical</span>
      </div>
    </section>
  );
}
