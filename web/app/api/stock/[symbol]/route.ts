import { NextResponse } from "next/server";

// Server-side proxy to the Azure Function so the function key never reaches the browser.
const SYMBOL_RE = /^[A-Za-z0-9.\-]{1,15}$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  if (!SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "Invalid stock symbol." }, { status: 400 });
  }

  const baseUrl = process.env.STOCK_API_BASE_URL;
  const key = process.env.STOCK_API_KEY;
  if (!baseUrl || !key) {
    console.error("STOCK_API_BASE_URL or STOCK_API_KEY is not set.");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/stock/${encodeURIComponent(symbol)}`,
      { headers: { "x-functions-key": key }, cache: "no-store" }
    );
    const body = await res.json().catch(() => ({ error: "Unexpected response from stock API." }));
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error("Stock API request failed:", err);
    return NextResponse.json({ error: "Stock API is unavailable." }, { status: 502 });
  }
}
