import { exportUrl } from "../api";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { formatMs, Kpi, useModule } from "../components/useModule";
import { useFilters } from "../filters";

export function PerformancePage() {
  const { data, error } = useModule("performance");
  const filters = useFilters();
  const k = data?.kpis ?? {};

  return (
    <Layout title="Performance" sub="Web Vitals aus dem Browser (soweit die Browser-APIs verfügbar sind).">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <>
          <div className="grid kpis">
            <Kpi label="LCP" value={k.lcpMs ?? null} note="Keine Daten" format={(v) => formatMs(v)} />
            <Kpi label="INP" value={k.inpMs ?? null} note="Keine Daten" format={(v) => formatMs(v)} />
            <Kpi label="CLS" value={k.cls ?? null} note="Keine Daten" format={(v) => v.toFixed(3)} />
            <Kpi label="FCP" value={k.fcpMs ?? null} note="Keine Daten" format={(v) => formatMs(v)} />
            <Kpi label="TTFB" value={k.ttfbMs ?? null} note="Keine Daten" format={(v) => formatMs(v)} />
            <Kpi label="Load" value={k.loadMs ?? null} note="Keine Daten" format={(v) => formatMs(v)} />
          </div>
          <div className="card">
            <h2>
              Nach Seite{" "}
              {data.tables?.byPage && (
                <a style={{ float: "right", fontSize: "0.75rem" }} href={exportUrl("performance", "byPage", filters.params)}>
                  CSV
                </a>
              )}
            </h2>
            {data.tables?.byPage && <DataTable table={data.tables.byPage} />}
          </div>
        </>
      )}
    </Layout>
  );
}
