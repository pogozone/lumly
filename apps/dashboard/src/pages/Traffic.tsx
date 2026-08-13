import { BarChart, LineChart } from "../components/charts";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { useModule } from "../components/useModule";

const WEEKDAYS = ["", "So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function TrafficPage() {
  const { data, error } = useModule("traffic");
  const series = data?.series ?? [];
  const hourRows = data?.tables?.hourOfDay?.rows ?? [];
  const weekdayRows = data?.tables?.weekday?.rows ?? [];

  return (
    <Layout title="Traffic" sub="Page Views, Tageszeit- und Wochentagsverteilung.">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2>Verlauf</h2>
            <LineChart
              labels={series.map((s) => String(s.bucket))}
              series={[
                { label: "Page Views", values: series.map((s) => (s.pageViews as number) ?? 0) },
                {
                  label: "Visitors (consented)",
                  values: series.map((s) => (s.visitors as number | null) ?? null),
                  color: "#0d9488"
                },
                {
                  label: "Sessions (consented)",
                  values: series.map((s) => (s.sessions as number | null) ?? null),
                  color: "#b45309"
                }
              ]}
            />
          </div>
          <div className="grid cols-2">
            <div className="card">
              <h2>Tageszeit</h2>
              <BarChart
                labels={hourRows.map((r) => `${String(r[0]).padStart(2, "0")}:00`)}
                series={[{ label: "Page Views", values: hourRows.map((r) => Number(r[1])) }]}
              />
            </div>
            <div className="card">
              <h2>Wochentag</h2>
              <BarChart
                labels={weekdayRows.map((r) => WEEKDAYS[Number(r[0])] ?? String(r[0]))}
                series={[{ label: "Page Views", values: weekdayRows.map((r) => Number(r[1])) }]}
              />
            </div>
          </div>
          <div className="card" style={{ marginTop: "1rem" }}>
            <h2>Rohdaten Tageszeit</h2>
            {data.tables?.hourOfDay && <DataTable table={data.tables.hourOfDay} />}
          </div>
        </>
      )}
    </Layout>
  );
}
