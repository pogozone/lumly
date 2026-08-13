import { useEffect, useState } from "react";
import { api, moduleQuery, type ModuleResult } from "../api";
import { useFilters } from "../filters";

export function useModule(moduleId: string): { data: ModuleResult | null; error: string | null } {
  const filters = useFilters();
  const [data, setData] = useState<ModuleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qs = moduleQuery(filters.params);

  useEffect(() => {
    if (!filters.site) return;
    let cancelled = false;
    setError(null);
    api
      .get<ModuleResult>(`/api/v1/analytics/${moduleId}?${qs}`)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, qs, filters.site]);

  return { data, error };
}

export function Kpi({
  label,
  value,
  change,
  note,
  format
}: {
  label: string;
  value: number | null;
  change?: number | null;
  note?: string;
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v: number) => v.toLocaleString("de-DE"));
  return (
    <div className="card">
      <h2>{label}</h2>
      {value === null ? (
        <>
          <div className="kpi-na">n/v</div>
          <div className="kpi-note">{note ?? "Nicht ohne Einwilligung ermittelbar"}</div>
        </>
      ) : (
        <div className="kpi-value">{fmt(value)}</div>
      )}
      {change !== undefined && change !== null && (
        <div className={`kpi-change ${change > 0 ? "up" : change < 0 ? "down" : "flat"}`}>
          {change > 0 ? "▲" : change < 0 ? "▼" : "•"} {Math.abs(change).toFixed(1)} % vs. Vorzeitraum
        </div>
      )}
    </div>
  );
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
