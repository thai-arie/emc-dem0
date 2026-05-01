import StatusBadge from "./StatusBadge";
import styles from "./WorkflowStepper.module.css";

const steps = ["OPEN", "SMS_SENT", "IMMOBILIZER_ARMED", "CURED"];

export default function WorkflowStepper({ status }: { status: string }) {
  const active = status === "CLOSED" ? steps.indexOf("CURED") : Math.max(steps.indexOf(status), 0);
  return (
    <div className={styles.stepper}>
      {steps.map((step, index) => (
        <div key={step} className={index <= active ? styles.activeStep : styles.step}>
          <StatusBadge status={step} />
        </div>
      ))}
    </div>
  );
}
