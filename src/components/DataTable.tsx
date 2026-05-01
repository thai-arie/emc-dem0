import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { downloadCsv, toCsv } from "../lib/csv";
import EmptyState from "./EmptyState";
import styles from "./DataTable.module.css";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}

export interface Filter<T> {
  label: string;
  predicate: (row: T) => boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchKey?: (row: T) => string;
  filters?: Filter<T>[];
  exportCSV?: string;
}

export default function DataTable<T>({ rows, columns, rowKey, onRowClick, searchKey, filters, exportCSV }: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const filtered = useMemo(() => {
    let next = rows;
    if (query && searchKey) next = next.filter((row) => searchKey(row).toLowerCase().includes(query.toLowerCase()));
    const selected = filters?.find((item) => item.label === filter);
    if (selected) next = next.filter(selected.predicate);
    if (sort) {
      const column = columns.find((item) => String(item.key) === sort.key);
      next = [...next].sort((a, b) => {
        const av = column?.sortValue ? column.sortValue(a) : String((a as Record<string, unknown>)[sort.key] ?? "");
        const bv = column?.sortValue ? column.sortValue(b) : String((b as Record<string, unknown>)[sort.key] ?? "");
        return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.dir === "asc" ? 1 : -1);
      });
    }
    return next;
  }, [columns, filter, filters, query, rows, searchKey, sort]);
  const toggleSort = (key: string) => setSort((current) => (current?.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {searchKey ? <input className={styles.search} placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} /> : <span />}
        <div className={styles.tools}>
          {filters?.length ? (
            <div className={styles.filters}>
              <button className={filter === "all" ? styles.activeFilter : styles.filter} onClick={() => setFilter("all")}>
                All
              </button>
              {filters.map((item) => (
                <button key={item.label} className={filter === item.label ? styles.activeFilter : styles.filter} onClick={() => setFilter(item.label)}>
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          {exportCSV ? (
            <button className={styles.exportButton} onClick={() => downloadCsv(exportCSV, toCsv(filtered, columns))}>
              CSV
            </button>
          ) : null}
        </div>
      </div>
      {filtered.length ? (
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)}>
                  <button onClick={() => toggleSort(String(column.key))}>{column.header}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={rowKey(row)} className={onRowClick ? styles.clickable : ""} onClick={() => onRowClick?.(row)}>
                {columns.map((column) => (
                  <td key={String(column.key)}>{column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No rows" hint="No records match the current table state." />
      )}
    </div>
  );
}
