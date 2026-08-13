import { LineChart } from "../components/charts";
import { Layout } from "../components/Layout";
import { Kpi, useModule } from "../components/useModule";

export function RetentionPage() {
  const { data, error } = useModule("retention");
  const series = data?.series ?? [];

  return (
    <Layout
      title="Retention"
      sub="Wiederkehrende Besucher. Aus Prinzip nur aus Consented-Daten berechenbar."
    >
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <>
          <div className="grid kpis">
            <Kpi label="Consented Visitors" value={data.kpis?.consentedVisitors ?? null} />
            <Kpi label="Wiederkehrend" value={data.kpis?.returningVisitors ?? null} />
            <Kpi
              label="Return-Rate"
              value={data.kpis?.returnRate ?? null}
              format={(v) => `${(v * 100).toFixed(1)} %`}
            />
          </div>
          {data.kpis?.consentedVisitors == null && (
            <div className="info-box">
              Keine Consented-Daten im Zeitraum. Retention ohne persistente Besuchererkennung darzustellen wäre
              erfunden — deshalb zeigt lumly hier bewusst nichts.
            </div>
          )}
          {series.length > 0 && (
            <div className="card">
              <h2>Wochenverlauf</h2>
              <LineChart
                labels={series.map((s) => String(s.bucket))}
                series={[
                  { label: "Visitors", values: series.map((s) => Number(s.visitors)) },
                  { label: "Wiederkehrend", values: series.map((s) => Number(s.returning)), color: "#0d9488" }
                ]}
              />
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
