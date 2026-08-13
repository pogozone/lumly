import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { useModule } from "../components/useModule";

export function GeographyPage() {
  const { data, error } = useModule("geography");
  const available = data?.meta?.available === true;

  return (
    <Layout title="Geography" sub="Nur verfügbar, wenn grobe Geo-Auswertung aktiviert ist (GEO_ENABLED + lokale MMDB).">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && !available && (
        <div className="info-box">
          Geo-Auswertung ist deaktiviert. Aktivierung erfordert eine lokale GeoIP-Datenbank und eine eigene
          rechtliche Bewertung durch den Betreiber. Es werden niemals IP-Adressen gespeichert — nur maximal das Land.
        </div>
      )}
      {data && available && (
        <div className="grid cols-2">
          <div className="card">
            <h2>Länder</h2>
            {data.tables?.countries && <DataTable table={data.tables.countries} />}
          </div>
          <div className="card">
            <h2>Regionen</h2>
            {data.tables?.regions && data.tables.regions.rows.length > 0 ? (
              <DataTable table={data.tables.regions} />
            ) : (
              <div className="empty">Regionen werden derzeit nicht aufgelöst (Ländergranularität).</div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
