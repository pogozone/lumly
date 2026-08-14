import { useEffect, useState } from "react";
import { api, ApiError, type SiteDto } from "../api";
import { Layout } from "../components/Layout";

function normalizeOriginInput(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function siteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message) return error.message;

    switch (error.code) {
      case "invalid_name":
        return "Bitte einen gültigen Namen angeben.";
      case "invalid_domain":
        return "Bitte die Domain ohne Protokoll und ohne Pfad angeben, z. B. shop.example.org.";
      case "invalid_allowed_origins":
        return "Bitte mindestens eine vollständige HTTP- oder HTTPS-Origin angeben, z. B. http://app.example.local oder https://shop.example.org.";
      case "invalid_retention_days":
        return "Retention muss zwischen 1 und 3650 Tagen liegen.";
      default:
        return `Die Site konnte nicht angelegt werden (${error.code}).`;
    }
  }

  return error instanceof Error ? error.message : "Die Site konnte nicht angelegt werden.";
}

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
    setSnippets((current) => ({ ...current, [id]: res.html }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const rawOrigins = origins
      .split(/[\n,]+/)
      .map((origin) => origin.trim())
      .filter(Boolean);

    const normalizedOrigins = rawOrigins.map(normalizeOriginInput);
    const invalidOrigins = rawOrigins.filter((_, index) => normalizedOrigins[index] === null);

    if (rawOrigins.length === 0) {
      setError("Bitte mindestens eine erlaubte Origin angeben.");
      return;
    }

    if (invalidOrigins.length > 0) {
      setError(
        `Ungültige Origin: ${invalidOrigins.join(", ")}. ` +
        "Bitte immer http:// oder https:// angeben. Ein abschließender Slash oder Pfad ist erlaubt und wird automatisch entfernt."
      );
      return;
    }

    try {
      await api.post("/api/v1/sites", {
        name: name.trim(),
        domain: domain.trim().toLowerCase(),
        allowedOrigins: [...new Set(normalizedOrigins as string[])],
        retentionDays: Number(retentionDays)
      });

      setName("");
      setDomain("");
      setOrigins("");
      setRetentionDays("90");
      await load();
    } catch (err) {
      setError(siteErrorMessage(err));
    }
  }

  async function remove(id: string) {
    try {
      setError(null);
      await api.del(`/api/v1/sites/${id}`);
      await load();
    } catch (err) {
      setError(siteErrorMessage(err));
    }
  }

  return (
    <Layout title="Sites" sub="Verwaltete Webseiten und Integrationssnippets.">
      <div className="grid" style={{ gap: "1rem" }}>
        {sites.map((site) => (
          <div className="card" key={site.id}>
            <h2>
              {site.name}{" "}
              <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>({site.domain})</span>
            </h2>
            <table>
              <tbody>
                <tr>
                  <td>Site-ID</td>
                  <td className="num"><code>{site.id}</code></td>
                </tr>
                <tr>
                  <td>Erlaubte Origins</td>
                  <td className="num">{site.allowedOrigins.join(", ")}</td>
                </tr>
                <tr>
                  <td>Retention</td>
                  <td className="num">{site.retentionDays} Tage</td>
                </tr>
                <tr>
                  <td>Geo</td>
                  <td className="num">{site.geoEnabled ? "aktiviert" : "deaktiviert"}</td>
                </tr>
                <tr>
                  <td>Query-Allowlist</td>
                  <td className="num">{site.queryAllowlist.join(", ") || "—"}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}>
              <button onClick={() => void showSnippet(site.id)}>Snippet anzeigen</button>
              <button className="danger" onClick={() => void remove(site.id)}>Site löschen</button>
            </div>
            {snippets[site.id] && (
              <>
                <div className="code-box" style={{ marginTop: "0.7rem" }}>{snippets[site.id]}</div>
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
          <form
            onSubmit={(e) => void create(e)}
            style={{ display: "flex", flexDirection: "column", gap: "0.7rem", maxWidth: 520 }}
          >
            <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
              Domain (z. B. shop.example.org)
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </label>

            <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
              Erlaubte Origins (eine pro Zeile, z. B. http://shop.example.local oder https://shop.example.org)
              <textarea
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                rows={3}
                required
                placeholder={"http://shop.example.local\nhttps://shop.example.org"}
                style={{
                  font: "inherit",
                  fontFamily: "var(--mono)",
                  fontSize: "0.85rem",
                  padding: "0.5rem",
                  border: "1px solid var(--line)",
                  borderRadius: 6
                }}
              />
              <span style={{ display: "block", marginTop: "0.35rem", fontSize: "0.78rem", color: "var(--ink-3)" }}>
                Eine Origin besteht aus Protokoll, Host und optional Port. Abschließende Slashes und Pfade werden automatisch entfernt.
              </span>
            </label>

            <label style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>
              Retention (Tage)
              <input
                type="number"
                min={1}
                max={3650}
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
              />
            </label>

            {error && <div className="error-box">{error}</div>}
            <button className="primary" type="submit">Site anlegen</button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
