import { exportUrl } from "../api";
import { BarChart } from "../components/charts";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { useModule } from "../components/useModule";
import { useFilters } from "../filters";

export function EventsPage() {
  const { data, error } = useModule("events");
  const filters = useFilters();

  const totals = data?.tables?.totals?.rows ?? [];
  const series = data?.series ?? [];
  const names = [...new Set(series.map((s) => String(s.name)))].slice(0, 5);
  const buckets = [...new Set(series.map((s) => String(s.bucket)))].sort();

  return (
    <Layout title="Events" sub="Custom Events: Häufigkeit, Entwicklung und Property-Keys (bereits sanitisiert).">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2>Häufigste Events</h2>
            <BarChart
              labels={totals.slice(0, 12).map((r) => String(r[0]))}
              series={[{ label: "Anzahl", values: totals.slice(0, 12).map((r) => Number(r[1])) }]}
            />
          </div>
          {buckets.length > 0 && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h2>Entwicklung (Top 5)</h2>
              <BarChart
                labels={buckets}
                series={names.map((name) => ({
                  label: name,
                  values: buckets.map(
                    (b) => series.find((s) => String(s.bucket) === b && s.name === name)?.count as number ?? 0
                  )
                }))}
                stacked
              />
            </div>
          )}
          <div className="grid cols-2">
            <div className="card">
              <h2>
                Alle Events{" "}
                {data.tables?.totals && (
                  <a style={{ float: "right", fontSize: "0.75rem" }} href={exportUrl("events", "totals", filters.params)}>
                    CSV
                  </a>
                )}
              </h2>
              {data.tables?.totals && <DataTable table={data.tables.totals} />}
            </div>
            <div className="card">
              <h2>Property-Keys {filters.params.event ? `(Event: ${filters.params.event})` : "(Event-Filter setzen)"}</h2>
              {data.tables?.propertyKeys && data.tables.propertyKeys.rows.length > 0 ? (
                <DataTable table={data.tables.propertyKeys} />
              ) : (
                <div className="empty">
                  Property-Keys werden angezeigt, wenn der URL-Filter <code>?event=name</code> gesetzt ist.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
