import { useEffect, useState } from "react";
import { api, type SiteDto } from "../api";
import { Layout } from "../components/Layout";

export function SitesPage() {
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [appOrigin, setAppOrigin] = useState("");
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [origins, setOrigins] = useState("");
  const [retentionDays, setRetentionDays] = useState("90");

  async function load() {
    const res = await api.get<{ sites: SiteDto[]; appOrigin: string }>("/api/v1/sites");
    setSites(res.sites);
    setAppOrigin(res.appOrigin);
  }

  useEffect(() => {
    void load();
  }, []);

  async function showSnippet(id: string) {
    const res = await api.get<{ html: string }>(`/api/v1/sites/${id}/snippet`);
    setSnippets((s) => ({ ...s, [id]: res.html }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/v1/sites", {
        name,
        domain,
        allowedOrigins: origins.split("\n").map((o) => o.trim()).filter(Boolean),
        retentionDays: Number(retentionDays)
      });
      setName("");
      setDomain("");
      setOrigins("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    await api.del(`/api/v1/sites/${id}`);
    await load();
  }

  return (
    <Layout title="Sites" sub="Verwaltete Webseiten und Integrationssnippets.">
      <div className="grid" style={{ gap: "1rem" }}>
        {sites.map((s) => (
          <div className="card" key={s.id}>
            <h2>
              {s.name} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>({s.domain})</span>
            </h2>
            <table>
              <tbody>
                <tr><td>Site-ID</td><td className="num"><code>{s.id}</code></td></tr>
                <tr><td>Erlaubte Origins</td><td className="num">{s.allowedOrigins.join(", ")}</td></tr>
                <tr><td>Retention</td><td className="num">{s.retentionDays} Tage</td></tr>
                <tr><td>Geo</td><td className="num">{s.geoEnabled ? "aktiviert" : "deaktiviert"}</td></tr>
                <tr><td>Query-Allowlist</td><td className="num">{s.queryAllowlist.join(", ") || "—"}</td></tr>
              </tbody>
            </table>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}>
              <button onClick={() => void showSnippet(s.id)}>Snippet anzeigen</button>
              <button className="danger" onClick={() => void remove(s.id)}>Site löschen</button>
            </div>
            {snippets[s.id] && (
              <>
                <div className="code-box" style={{ marginTop: "0.7rem" }}>{snippets[s.id]}</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                  Die Site-ID ist öffentlich und kein Geheimnis. Missbrauchsschutz erfolgt über die Origin-Allowlist.
                  App-Origin: {appOrigin}
                </p>
              </>
            )}
          </div>
        ))}

        <div className="card">
          <h2>Neue Site</h2>
          <form onSubmit={(e) => void create(e)} style={{ display: "flex", flexDirection: "column", gap: "0.7rem", maxWidth: 520 }}>
            <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
              Name
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
              Domain (z. B. shop.example.org)
              <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} required />
            </label>
            <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
              Erlaubte Origins (eine pro Zeile, z. B. https://shop.example.org)
              <textarea
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                rows={3}
                required
                style={{ font: "inherit", fontFamily: "var(--mono)", fontSize: "0.85rem", padding: "0.5rem", border: "1px solid var(--line)", borderRadius: 6 }}
              />
            </label>
            <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
              Retention (Tage)
              <input type="number" min={1} max={3650} value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} />
            </label>
            {error && <div className="error-box">{error}</div>}
            <button className="primary" type="submit">Site anlegen</button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
