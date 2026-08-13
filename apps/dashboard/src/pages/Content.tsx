import { exportUrl } from "../api";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { useModule } from "../components/useModule";
import { useFilters } from "../filters";

function TableCard({ moduleId, tableKey, title }: { moduleId: string; tableKey: string; title: string }) {
  const { data } = useModule(moduleId);
  const filters = useFilters();
  const table = data?.tables?.[tableKey];
  return (
    <div className="card">
      <h2>
        {title}{" "}
        {table && (
          <a style={{ float: "right", fontSize: "0.75rem" }} href={exportUrl(moduleId, tableKey, filters.params)}>
            CSV
          </a>
        )}
      </h2>
      {table ? <DataTable table={table} /> : <div className="loading">Lade…</div>}
    </div>
  );
}

export function ContentPage() {
  const { data, error } = useModule("content");
  const consentedOnly = new Set(((data?.meta?.consentedOnlyTables as string[]) ?? []));
  return (
    <Layout title="Content" sub="Seiten, Einstiege, Ausstiege, Engagement und Scroll-Tiefe.">
      {error && <div className="error-box">{error}</div>}
      <div className="grid cols-2">
        <TableCard moduleId="content" tableKey="topPages" title="Top Pages" />
        <TableCard moduleId="content" tableKey="engagementPerPage" title="Engagement pro Seite" />
        <div className="card">
          <h2>Entry Pages (nur Consented)</h2>
          {consentedOnly.has("entryPages") && (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
              Einstiegsseiten erfordern Sessions und sind nur aus Consented-Daten ermittelbar.
            </p>
          )}
          {data?.tables?.entryPages && <DataTable table={data.tables.entryPages} />}
        </div>
        <div className="card">
          <h2>Exit Pages (nur Consented)</h2>
          {data?.tables?.exitPages && <DataTable table={data.tables.exitPages} />}
        </div>
        <TableCard moduleId="content" tableKey="scrollDepth" title="Scroll-Tiefe pro Seite" />
      </div>
    </Layout>
  );
}
