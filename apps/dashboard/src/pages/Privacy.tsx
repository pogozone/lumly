import { useState } from "react";
import { api } from "../api";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { Kpi, useModule } from "../components/useModule";
import { useFilters } from "../filters";
import { appUrl } from "../runtime";

export function PrivacyPage() {
  const { data, error } = useModule("privacy");
  const filters = useFilters();
  const meta = (data?.meta ?? {}) as {
    geoEnabled?: boolean;
    retentionDays?: number | null;
    lastRetentionRun?: string | null;
    lastRetentionDeleted?: number;
  };

  const [visitorId, setVisitorId] = useState("");
  const [opResult, setOpResult] = useState<string | null>(null);

  async function deleteVisitor() {
    if (!filters.site || !visitorId.trim()) return;
    const res = await api.del<{ deleted: number }>(
      `/api/v1/privacy/visitors/${filters.site}/${encodeURIComponent(visitorId.trim())}`
    );
    setOpResult(`Gelöschte Events: ${res.deleted}`);
  }

  async function runRetention() {
    await api.post("/api/v1/privacy/retention/run");
    setOpResult("Retention-Lauf abgeschlossen.");
  }

  return (
    <Layout title="Privacy" sub="Transparenz über gespeicherte Daten, Modi und Löschung.">
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <>
          <div className="grid kpis">
            <Kpi label="Basic Page Views" value={data.kpis?.basicPageViews ?? 0} />
            <Kpi label="Consented Page Views" value={data.kpis?.consentedPageViews ?? 0} />
            <Kpi
              label="Consent-Rate"
              value={data.kpis?.consentRate ?? null}
              note="Keine Page Views"
              format={(v) => `${(v * 100).toFixed(1)} %`}
            />
          </div>

          <div className="grid cols-2" style={{ marginBottom: "1rem" }}>
            <div className="card">
              <h2>Konfiguration</h2>
              <table>
                <tbody>
                  <tr><td>Geo-Auswertung</td><td className="num">{meta.geoEnabled ? "aktiviert" : "deaktiviert"}</td></tr>
                  <tr><td>Rohdaten-Retention</td><td className="num">{meta.retentionDays ?? "—"} Tage</td></tr>
                  <tr>
                    <td>Letzter Retention-Lauf</td>
                    <td className="num">{meta.lastRetentionRun ? new Date(meta.lastRetentionRun).toLocaleString("de-DE") : "nie"}</td>
                  </tr>
                  <tr><td>Zuletzt gelöscht</td><td className="num">{meta.lastRetentionDeleted ?? 0}</td></tr>
                </tbody>
              </table>
              <p style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                Retention-Tage sind eine technische Voreinstellung, keine Rechtsaussage.
              </p>
              <button onClick={() => void runRetention()}>Retention jetzt ausführen</button>
            </div>

            <div className="card">
              <h2>Betroffenen-Löschung (pseudonyme Consented-Daten)</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
                Löscht alle Events einer <code>visitor_id</code>. Aggregierte, nicht mehr personenbeziehbare
                Statistiken bleiben unverändert (siehe Datenschutzdoku).
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="visitor_id"
                  value={visitorId}
                  onChange={(e) => setVisitorId(e.target.value)}
                  style={{ flex: 1 }}
                  aria-label="Visitor-ID"
                />
                <button className="danger" onClick={() => void deleteVisitor()}>Löschen</button>
                {visitorId.trim() && filters.site && (
                  <a
                    className="button"
                    href={appUrl(`api/v1/privacy/visitors/${filters.site}/${encodeURIComponent(visitorId.trim())}/export`).toString()}
                  >
                    Export
                  </a>
                )}
              </div>
              {opResult && <div className="info-box" style={{ marginTop: "0.7rem" }}>{opResult}</div>}
            </div>
          </div>

          <div className="card">
            <h2>Gespeicherte Datenkategorien</h2>
            {data.tables?.dataCategories && <DataTable table={data.tables.dataCategories} numericFrom={99} />}
          </div>
        </>
      )}
    </Layout>
  );
}
