export const statusTaxonomy: Record<string, { label: string; tone: "green" | "red" | "amber" | "blue" | "slate" }> = {
  ACTIVE: { label: "ACTIVE", tone: "green" },
  OVERDUE: { label: "OVERDUE", tone: "red" },
  SCHEDULED: { label: "SCHEDULED", tone: "slate" },
  DUE: { label: "DUE", tone: "amber" },
  PAID: { label: "PAID", tone: "green" },
  OPEN: { label: "OPEN", tone: "amber" },
  SMS_SENT: { label: "SMS_SENT", tone: "blue" },
  IMMOBILIZER_ARMED: { label: "IMMOBILIZER_ARMED", tone: "red" },
  CURED: { label: "CURED", tone: "green" },
  CLOSED: { label: "CLOSED", tone: "slate" },
  ONLINE: { label: "ONLINE", tone: "green" },
  INFO: { label: "INFO", tone: "blue" },
  WARN: { label: "WARN", tone: "amber" },
  CRITICAL: { label: "CRITICAL", tone: "red" }
};
