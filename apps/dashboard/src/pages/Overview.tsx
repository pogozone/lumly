import { exportUrl } from "../api";
import { LineChart } from "../components/charts";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { formatMs, Kpi, useModule } from "../components/useModule";
import { useFilters } from "../filters";

export function OverviewPage() {
  const { data, error } = useModule("overview");
  const filters = useFilters();

  const series = data?.series ?? [];
  const labels = series.map((s) => String(s.bucket));
  const meta = (data?.meta ?? {}) as { change?: Record<string, number | null>; previous?: Record<string, number | null> };

  return (
    <Layout title="Overview" sub="Kennzahlen und Verlauf. Visitors/Sessions sind nur mit Einwilligung ermittelbar.">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <>
          <div className="grid kpis">
            <Kpi label="Page Views" value={data.kpis?.pageViews ?? 0} change={meta.change?.pageViews} />
            <Kpi label="Visitors" value={data.kpis?.visitors ?? null} change={meta.change?.visitors} />
            <Kpi label="Sessions" value={data.kpis?.sessions ?? null} change={meta.change?.sessions} />
            <Kpi label="Events" value={data.kpis?.events ?? 0} change={meta.change?.events} />
            <Kpi
              label="Ø Engagement"
              value={data.kpis?.avgEngagementMs ?? null}
              note="Keine Engagement-Events"
              format={(v) => formatMs(v)}
            />
            <Kpi
              label="Consent-Anteil"
              value={data.kpis?.consentRate ?? null}
              note="Keine Page Views"
              format={(v) => `${(v * 100).toFixed(1)} %`}
            />
          </div>

          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2>Verlauf</h2>
            <LineChart
              labels={labels}
              series={[
                { label: "Page Views", values: series.map((s) => (s.pageViews as number) ?? 0) },
                { label: "Events", values: series.map((s) => (s.events as number) ?? 0), color: "#0d9488" }
              ]}
            />
          </div>

          <div className="grid cols-2">
            <div className="card">
              <h2>
                Top Pages{" "}
                <a style={{ float: "right", fontSize: "0.75rem" }} href={exportUrl("overview", "topPages", filters.params)}>
                  CSV
                </a>
              </h2>
              {data.tables?.topPages && <DataTable table={data.tables.topPages} />}
            </div>
            <div className="card">
              <h2>Tracking-Modus</h2>
              <table>
                <tbody>
                  <tr>
                    <td>Basic Page Views</td>
                    <td className="num">{(data.kpis?.basicPageViews ?? 0).toLocaleString("de-DE")}</td>
                  </tr>
                  <tr>
                    <td>Consented Page Views</td>
                    <td className="num">{(data.kpis?.consentedPageViews ?? 0).toLocaleString("de-DE")}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: "0.82rem", color: "var(--ink-3)" }}>
                Basic-Daten erlauben aus Prinzip keine Besucher- oder Sitzungszählung.
              </p>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
