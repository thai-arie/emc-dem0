export function toCsv<T>(rows: T[], columns: { key: keyof T | string; header: string; render?: (row: T) => unknown }[]) {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const head = columns.map((column) => escape(column.header)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => escape(column.render ? column.render(row) : (row as Record<string, unknown>)[String(column.key)]))
        .join(",")
    )
    .join("\n");
  return [head, body].filter(Boolean).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
