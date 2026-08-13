import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export function LoginPage() {
  const { login, needsSetup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [setupToken, setSetupToken] = useState("");
  const [setupDone, setSetupDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        (err as { code?: string }).code === "invalid_credentials"
          ? "E-Mail oder Passwort falsch."
          : "Anmeldung fehlgeschlagen. Bitte später erneut versuchen."
      );
    } finally {
      setBusy(false);
    }
  }

  async function setup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/auth/setup", { token: setupToken, email, password });
      setSetupDone(true);
    } catch (err) {
      setError(`Setup fehlgeschlagen: ${(err as { code?: string }).code ?? "unbekannt"}`);
    } finally {
      setBusy(false);
    }
  }

  if (needsSetup && !setupDone) {
    return (
      <div className="auth-wrap">
        <h1>lumly — Ersteinrichtung</h1>
        <p style={{ color: "var(--ink-2)", fontSize: "0.9rem" }}>
          Erstelle den initialen Admin. Erforderlich ist das <code>ADMIN_SETUP_TOKEN</code> aus der
          Server-Konfiguration. Alternativ: <code>pnpm create-admin</code> auf dem Server.
        </p>
        <form onSubmit={(e) => void setup(e)}>
          <label>
            Setup-Token
            <input type="password" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} required autoComplete="off" />
          </label>
          <label>
            E-Mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </label>
          <label>
            Passwort (min. 12 Zeichen)
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} autoComplete="new-password" />
          </label>
          {error && <div className="error-box" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={busy}>Admin anlegen</button>
        </form>
      </div>
    );
  }

  if (setupDone) {
    return (
      <div className="auth-wrap">
        <h1>Setup abgeschlossen</h1>
        <div className="info-box">Admin angelegt. Bitte jetzt anmelden.</div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <h1>lumly</h1>
      <p style={{ color: "var(--ink-2)", fontSize: "0.9rem" }}>Privacy-first Web Analytics — Dashboard-Anmeldung.</p>
      <form onSubmit={(e) => void submit(e)}>
        <label>
          E-Mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label>
          Passwort
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>Anmelden</button>
      </form>
    </div>
  );
}
