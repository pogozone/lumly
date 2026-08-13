import { exportUrl } from "../api";
import { BarChart } from "../components/charts";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { formatMs, Kpi, useModule } from "../components/useModule";
import { useFilters } from "../filters";

export function EngagementPage() {
  const { data, error } = useModule("engagement");
  const filters = useFilters();
  const scroll = data?.tables?.scrollDepth?.rows ?? [];

  return (
    <Layout title="Engagement" sub="Verweildauer, Scroll-Tiefe, externe Links und Downloads.">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <>
          <div className="grid kpis">
            <Kpi
              label="Ø Engagement-Zeit"
              value={data.kpis?.avgEngagementMs ?? null}
              note="Keine Engagement-Daten"
              format={(v) => formatMs(v)}
            />
            <Kpi label="Messungen" value={data.kpis?.engagementSamples ?? 0} />
          </div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2>Scroll-Tiefe</h2>
            <BarChart
              labels={scroll.map((r) => `${r[0]} %`)}
              series={[{ label: "Erreichungen", values: scroll.map((r) => Number(r[1])) }]}
            />
          </div>
          <div className="grid cols-2">
            <div className="card">
              <h2>
                Outbound Links{" "}
                <a style={{ float: "right", fontSize: "0.75rem" }} href={exportUrl("engagement", "outboundLinks", filters.params)}>
                  CSV
                </a>
              </h2>
              {data.tables?.outboundLinks && <DataTable table={data.tables.outboundLinks} />}
            </div>
            <div className="card">
              <h2>
                Downloads{" "}
                <a style={{ float: "right", fontSize: "0.75rem" }} href={exportUrl("engagement", "downloads", filters.params)}>
                  CSV
                </a>
              </h2>
              {data.tables?.downloads && <DataTable table={data.tables.downloads} />}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
