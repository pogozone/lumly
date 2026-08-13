import { useState } from "react";
import { api } from "../api";
import { Layout } from "../components/Layout";
import { useModule } from "../components/useModule";
import { useFilters } from "../filters";

interface FunnelComputed {
  id: number;
  name: string;
  steps: Array<{ step: { type: string; value: string }; count: number; conversionFromPrevious: number | null; consentedOnly: boolean }>;
}

export function FunnelsPage() {
  const { data, error } = useModule("funnels");
  const filters = useFilters();
  const [name, setName] = useState("");
  const [stepsText, setStepsText] = useState("/produkte\ncta_click\n/checkout\npurchase_completed");
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const computed = ((data?.meta?.computed as FunnelComputed[]) ?? []);

  async function createFunnel(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((v) => (v.startsWith("/") ? { type: "page" as const, value: v } : { type: "event" as const, value: v }));
    try {
      await api.post("/api/v1/funnels", { site: filters.site, name, steps });
      setName("");
      setReloadKey((k) => k + 1);
      location.reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function removeFunnel(id: number) {
    await api.del(`/api/v1/funnels/${id}?site=${filters.site}`);
    location.reload();
  }

  void reloadKey;

  return (
    <Layout
      title="Funnels"
      sub="Geordnete Ereignisfolgen. Erfordern Consented-Sessions — aus Basic-Daten sind Funnels nicht berechenbar."
    >
      {error && <div className="error-box">{error}</div>}
      {!data && !error && <div className="loading">Lade Daten…</div>}
      {data && (
        <>
          {computed.length === 0 && <div className="info-box">Noch keine Funnels definiert.</div>}
          {computed.map((f) => {
            const maxCount = Math.max(1, ...f.steps.map((s) => s.count));
            return (
              <div className="card" key={f.id} style={{ marginBottom: "1rem" }}>
                <h2>
                  {f.name}{" "}
                  <button className="danger" style={{ float: "right", fontSize: "0.75rem" }} onClick={() => void removeFunnel(f.id)}>
                    Löschen
                  </button>
                </h2>
                {f.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.4rem" }}>
                    <span style={{ width: 240, fontFamily: "var(--mono)", fontSize: "0.8rem" }}>
                      {s.step.type === "page" ? "Seite" : "Event"}: {s.step.value}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        className="funnel-bar"
                        style={{ width: `${Math.max(1, (s.count / maxCount) * 100)}%` }}
                        role="img"
                        aria-label={`${s.count} Sessions`}
                      />
                    </div>
                    <span style={{ width: 80, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {s.consentedOnly ? "n/v" : s.count.toLocaleString("de-DE")}
                    </span>
                    <span style={{ width: 70, textAlign: "right", color: "var(--ink-3)", fontSize: "0.82rem" }}>
                      {s.conversionFromPrevious !== null ? `${(s.conversionFromPrevious * 100).toFixed(1)} %` : ""}
                    </span>
                  </div>
                ))}
                {f.steps.some((s) => s.consentedOnly) && (
                  <p style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                    Keine Consented-Sessions im Zeitraum — Funnel nicht berechenbar.
                  </p>
                )}
              </div>
            );
          })}
          <div className="card">
            <h2>Neuer Funnel</h2>
            <form onSubmit={(e) => void createFunnel(e)} style={{ display: "flex", flexDirection: "column", gap: "0.7rem", maxWidth: 520 }}>
              <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
                Name
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
              </label>
              <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
                Schritte (ein Schritt pro Zeile; Pfade beginnen mit /, sonst Event-Name)
                <textarea
                  value={stepsText}
                  onChange={(e) => setStepsText(e.target.value)}
                  rows={5}
                  style={{ font: "inherit", fontFamily: "var(--mono)", fontSize: "0.85rem", padding: "0.5rem", border: "1px solid var(--line)", borderRadius: 6 }}
                />
              </label>
              {formError && <div className="error-box">{formError}</div>}
              <button className="primary" type="submit">Funnel anlegen</button>
            </form>
          </div>
        </>
      )}
    </Layout>
  );
}
