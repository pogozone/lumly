import { useState } from "react";
import type { TableData } from "../api";

export function DataTable({ table, numericFrom = 1 }: { table: TableData; numericFrom?: number }) {
  const [shown, setShown] = useState(25);
  if (table.rows.length === 0) return <div className="empty">Keine Daten im Zeitraum.</div>;
  const rows = table.rows.slice(0, shown);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} className={i >= numericFrom ? "num" : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={ci >= numericFrom ? "num" : undefined}>
                  {cell === null ? <span style={{ color: "var(--ink-3)" }}>—</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > shown && (
        <div style={{ padding: "0.6rem 0", textAlign: "center" }}>
          <button onClick={() => setShown((s) => s + 50)}>
            Mehr anzeigen ({table.rows.length - shown} verbleibend)
          </button>
        </div>
      )}
    </div>
  );
}
