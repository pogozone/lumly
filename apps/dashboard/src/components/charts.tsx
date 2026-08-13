import { useId, useMemo, useState } from "react";

/** Lightweight SVG charts: labeled axes, tooltips, empty-state handling. */

export interface SeriesDef {
  label: string;
  values: (number | null)[];
  color?: string;
}

interface ChartProps {
  labels: string[];
  series: SeriesDef[];
  height?: number;
  stacked?: boolean;
  formatY?: (v: number) => string;
}

const COLORS = ["#1d4ed8", "#0d9488", "#b45309", "#7c3aed", "#be185d"];

function fmtDefault(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
}

export function LineChart({ labels, series, height = 220, formatY = fmtDefault }: ChartProps) {
  const id = useId();
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const W = 720;
  const H = height;
  const PAD = { l: 44, r: 12, t: 10, b: 26 };

  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const n = labels.length;

  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: f * max, y: y(f * max) }));
  const labelStep = Math.max(1, Math.ceil(n / 8));

  if (n === 0) return <div className="empty">Keine Daten im Zeitraum.</div>;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Zeitverlauf">
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#e7e5e0" strokeWidth="1" />
            <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="#a8a29e">
              {formatY(t.v)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % labelStep === 0 ? (
            <text key={`${l}-${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#a8a29e">
              {shortLabel(l)}
            </text>
          ) : null
        )}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`));
          const path = pts
            .reduce<string[]>((acc, p) => {
              if (p === null) acc.push("M_GAP");
              else if (acc.length === 0 || acc[acc.length - 1] === "M_GAP") acc.push(`M ${p}`);
              else acc.push(`L ${p}`);
              return acc;
            }, [])
            .filter((p) => p !== "M_GAP")
            .join(" ");
          const color = s.color ?? COLORS[si % COLORS.length];
          return <path key={si} d={path} fill="none" stroke={color} strokeWidth="1.8" />;
        })}
        {/* hover targets */}
        {labels.map((l, i) => (
          <rect
            key={`h-${i}`}
            x={x(i) - (W / Math.max(n, 1)) / 2}
            y={PAD.t}
            width={W / Math.max(n, 1)}
            height={H - PAD.t - PAD.b}
            fill="transparent"
            onMouseEnter={() =>
              setTip({
                x: x(i),
                y: PAD.t + 6,
                text: `${l} — ${series.map((s) => `${s.label}: ${s.values[i] ?? "n/v"}`).join(", ")}`
              })
            }
            onMouseLeave={() => setTip(null)}
          />
        ))}
        <desc id={id}>Liniendiagramm</desc>
      </svg>
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "var(--ink-2)", marginTop: 4 }}>
        {series.map((s, si) => (
          <span key={si}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 3,
                background: s.color ?? COLORS[si % COLORS.length],
                marginRight: 5,
                verticalAlign: "middle"
              }}
            />
            {s.label}
          </span>
        ))}
      </div>
      {tip && (
        <div className="chart-tip" style={{ left: `${(tip.x / W) * 100}%`, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

export function BarChart({ labels, series, height = 220, stacked = false, formatY = fmtDefault }: ChartProps) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const W = 720;
  const H = height;
  const PAD = { l: 44, r: 12, t: 10, b: 26 };
  const n = labels.length;

  const max = useMemo(() => {
    if (stacked) {
      return Math.max(
        1,
        ...labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
      );
    }
    return Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  }, [labels, series, stacked]);

  if (n === 0) return <div className="empty">Keine Daten im Zeitraum.</div>;

  const slot = (W - PAD.l - PAD.r) / n;
  const barW = Math.min(40, slot * 0.7);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const labelStep = Math.max(1, Math.ceil(n / 10));

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Balkendiagramm">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(f * max)} y2={y(f * max)} stroke="#e7e5e0" />
            <text x={PAD.l - 6} y={y(f * max) + 4} textAnchor="end" fontSize="10" fill="#a8a29e">
              {formatY(f * max)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => {
          const cx = PAD.l + i * slot + slot / 2;
          let acc = 0;
          const bars = series.map((s, si) => {
            const v = s.values[i] ?? 0;
            const color = s.color ?? COLORS[si % COLORS.length];
            if (stacked) {
              const y0 = y(acc + v);
              const hgt = y(acc) - y(acc + v);
              acc += v;
              return <rect key={si} x={cx - barW / 2} y={y0} width={barW} height={Math.max(0, hgt)} fill={color} />;
            }
            const w = barW / series.length;
            return (
              <rect
                key={si}
                x={cx - barW / 2 + si * w}
                y={y(v)}
                width={Math.max(1, w - 1)}
                height={Math.max(0, H - PAD.b - y(v))}
                fill={color}
              />
            );
          });
          return (
            <g key={i}>
              {bars}
              {i % labelStep === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#a8a29e">
                  {shortLabel(l)}
                </text>
              )}
              <rect
                x={cx - slot / 2}
                y={PAD.t}
                width={slot}
                height={H - PAD.t - PAD.b}
                fill="transparent"
                onMouseEnter={() =>
                  setTip({
                    x: cx,
                    y: PAD.t + 6,
                    text: `${l} — ${series.map((s) => `${s.label}: ${s.values[i] ?? 0}`).join(", ")}`
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "var(--ink-2)", marginTop: 4 }}>
        {series.map((s, si) => (
          <span key={si}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: s.color ?? COLORS[si % COLORS.length],
                marginRight: 5,
                borderRadius: 2
              }}
            />
            {s.label}
          </span>
        ))}
      </div>
      {tip && (
        <div className="chart-tip" style={{ left: `${(tip.x / W) * 100}%`, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - (v / max) * (height - 2) - 1}`)
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#1d4ed8" strokeWidth="1.5" />
    </svg>
  );
}

function shortLabel(l: string): string {
  // "2026-08-13 14:00:00" -> "14:00", "2026-08-13" -> "13.08."
  if (l.includes(" ")) return l.split(" ")[1]?.slice(0, 5) ?? l;
  const m = l.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.`;
  return l.length > 10 ? l.slice(0, 10) : l;
}
