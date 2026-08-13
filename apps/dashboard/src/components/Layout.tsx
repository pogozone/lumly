import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { api, type SiteDto } from "../api";
import { useAuth } from "../auth";
import { RANGES, useFilters } from "../filters";

export const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/traffic", label: "Traffic" },
  { to: "/content", label: "Content" },
  { to: "/acquisition", label: "Acquisition" },
  { to: "/events", label: "Events" },
  { to: "/engagement", label: "Engagement" },
  { to: "/devices", label: "Devices" },
  { to: "/geography", label: "Geography" },
  { to: "/performance", label: "Performance" },
  { to: "/funnels", label: "Funnels" },
  { to: "/retention", label: "Retention" },
  { to: "/privacy", label: "Privacy" },
  { to: "/sites", label: "Sites" }
];

export function Layout({ children, title, sub }: { children: ReactNode; title: string; sub?: string }) {
  const { email, logout } = useAuth();
  const filters = useFilters();
  const [sites, setSites] = useState<SiteDto[]>([]);

  useEffect(() => {
    api.get<{ sites: SiteDto[] }>("/api/v1/sites").then((r) => {
      setSites(r.sites);
      if (!filters.site && r.sites.length > 0) {
        filters.set("site", r.sites[0]!.id);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSite = sites.find((s) => s.id === filters.site);

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Hauptnavigation">
        <div className="brand">
          lumly <span>analytics</span>
        </div>
        <div className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-footer">
          {email}
          <br />
          <button onClick={() => void logout()}>Abmelden</button>
        </div>
      </nav>
      <main className="main">
        <div className="filterbar" role="group" aria-label="Filter">
          <label>
            Site
            <select value={filters.site ?? ""} onChange={(e) => filters.set("site", e.target.value)}>
              {sites.length === 0 && <option value="">Keine Sites</option>}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Zeitraum
            <select value={filters.range} onChange={(e) => filters.set("range", e.target.value)}>
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {filters.range === "custom" && (
            <>
              <label>
                Von
                <input
                  type="date"
                  value={filters.from ?? ""}
                  onChange={(e) => filters.set("from", e.target.value)}
                />
              </label>
              <label>
                Bis
                <input type="date" value={filters.to ?? ""} onChange={(e) => filters.set("to", e.target.value)} />
              </label>
            </>
          )}
          <label>
            Tracking-Modus
            <select value={filters.mode ?? "all"} onChange={(e) => filters.set("mode", e.target.value === "all" ? null : e.target.value)}>
              <option value="all">Alle</option>
              <option value="basic">Basic</option>
              <option value="consented">Consented</option>
            </select>
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
            <input
              type="checkbox"
              checked={filters.includeBots}
              onChange={(e) => filters.set("includeBots", e.target.checked ? "true" : null)}
            />
            Bots einbeziehen
          </label>
          {currentSite && (
            <span className={`badge ${currentSite.defaultTrackingMode}`} style={{ alignSelf: "center" }}>
              Standard: {currentSite.defaultTrackingMode}
            </span>
          )}
        </div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
        {children}
      </main>
    </div>
  );
}
