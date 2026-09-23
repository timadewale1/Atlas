import { NextResponse } from "next/server";

const API_KEY = process.env.REST_COUNTRIES_API_KEY;

export async function GET(request: Request) {
  if (!API_KEY) return NextResponse.json({ message: "REST Countries API key is not configured" }, { status: 500 });
  const ip = new URL(request.url).searchParams.get("ip");
  const endpoint = ip ? `https://api.restcountries.com/ip/v1/${encodeURIComponent(ip)}` : "https://api.restcountries.com/ip/v1";
  try {
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${API_KEY}` }, next: { revalidate: 300 } });
    if (!response.ok) return NextResponse.json({ message: "IP location unavailable" }, { status: response.status });
    const payload = (await response.json()) as { data?: { objects?: unknown[] } };
    return NextResponse.json(payload.data?.objects?.[0] ?? null);
  } catch {
    return NextResponse.json({ message: "IP location unavailable" }, { status: 502 });
  }
}
