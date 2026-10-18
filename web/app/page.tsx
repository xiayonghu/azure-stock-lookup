"use client";

import { FormEvent, useState } from "react";

type Row = Record<string, string | number | null>;
type StockResponse = { symbol?: string; count?: number; results?: Row[]; error?: string };

export default function Home() {
  const [symbol, setSymbol] = useState("");
  const [data, setData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    const s = symbol.trim();
    if (!s) return;
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(s)}`);
      setData(await res.json());
    } catch {
      setData({ error: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  // Newest first when the table has a Date column.
  const rows = [...(data?.results ?? [])].sort((a, b) =>
    String(b.Date ?? "").localeCompare(String(a.Date ?? ""))
  );
  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <main>
      <h1>Stock Lookup</h1>
      <form onSubmit={lookup}>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Symbol, e.g. BROS"
          maxLength={15}
          aria-label="Stock symbol"
        />
        <button type="submit" disabled={loading || !symbol.trim()}>
          {loading ? "Loading…" : "Search"}
        </button>
      </form>

      {data?.error && <p className="error">{data.error}</p>}

      {rows.length > 0 && (
        <>
          <p className="summary">
            {data?.symbol}: {data?.count} row(s)
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c}>
                        {typeof row[c] === "number" ? row[c]!.toLocaleString() : row[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
