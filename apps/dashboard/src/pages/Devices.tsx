import { exportUrl } from "../api";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { useModule } from "../components/useModule";
import { useFilters } from "../filters";

const SECTIONS: Array<[string, string]> = [
  ["deviceClasses", "Geräteklassen"],
  ["browsers", "Browser"],
  ["operatingSystems", "Betriebssysteme"],
  ["viewports", "Viewport-Buckets"],
  ["languages", "Sprachen"]
];

export function DevicesPage() {
  const { data, error } = useModule("devices");
  const filters = useFilters();
  return (
    <Layout title="Devices" sub="Grobe, serverseitig abgeleitete Kategorien. Kein Fingerprinting.">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <div className="grid cols-2">
          {SECTIONS.map(([key, title]) => (
            <div className="card" key={key}>
              <h2>
                {title}{" "}
                {data.tables?.[key] && (
                  <a style={{ float: "right", fontSize: "0.75rem" }} href={exportUrl("devices", key, filters.params)}>
                    CSV
                  </a>
                )}
              </h2>
              {data.tables?.[key] && <DataTable table={data.tables[key]} />}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
