import { exportUrl } from "../api";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { useModule } from "../components/useModule";
import { useFilters } from "../filters";

export function AcquisitionPage() {
  const { data, error } = useModule("acquisition");
  const filters = useFilters();
  const card = (key: string, title: string) => (
    <div className="card" key={key}>
      <h2>
        {title}{" "}
        {data?.tables?.[key] && (
          <a style={{ float: "right", fontSize: "0.75rem" }} href={exportUrl("acquisition", key, filters.params)}>
            CSV
          </a>
        )}
      </h2>
      {data?.tables?.[key] ? <DataTable table={data.tables[key]} /> : <div className="empty">Keine Daten.</div>}
    </div>
  );
  return (
    <Layout title="Acquisition" sub="Referrer und UTM-Kampagnen (nur allowlistete Parameter).">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <div className="grid cols-2">
          {card("referrers", "Referrer")}
          {card("sources", "Sources (utm_source)")}
          {card("mediums", "Mediums (utm_medium)")}
          {card("campaigns", "Kampagnen")}
        </div>
      )}
    </Layout>
  );
}
