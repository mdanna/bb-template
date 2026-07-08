import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";

// Completa l'associazione/disassociazione al portale DAL LATO SITO (auth-gated:
// admin di QUESTA struttura). Scrive src/data/portal-link.json sul proprio repo
// (col proprio bot token) e poi notifica il portale (register/unregister)
// inoltrando il token firmato che il portale aveva emesso.
const FILE = "src/data/portal-link.json";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const portal = String(body.portal ?? "").trim().replace(/\/+$/, "");
  const name = String(body.name ?? "").trim();
  const t = String(body.token ?? "");
  const action = body.action === "unlink" ? "unlink" : "link";
  if (!/^https?:\/\//i.test(portal)) {
    return NextResponse.json({ error: "URL del portale non valido" }, { status: 400 });
  }

  try {
    // 1) Scrivi il link (di proprietà del sito) sul proprio repo → il footer lo legge.
    const token = requireBotToken();
    let sha = "";
    try {
      ({ sha } = await getFile(FILE, token));
    } catch {
      sha = "";
    }
    const linkData = action === "link" ? { url: portal, name } : { url: "", name: "" };
    const content = JSON.stringify(linkData, null, 2) + "\n";
    await putFile(
      FILE,
      content,
      sha,
      action === "link" ? `Collega al portale ${name}` : "Scollega dal portale",
      token,
    );

    // 2) Notifica il portale, inoltrando il token firmato.
    const endpoint = action === "link" ? "/api/register" : "/api/unregister";
    let portalOk = false;
    let portalErr = "";
    try {
      const res = await fetch(`${portal}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
        signal: AbortSignal.timeout(10000),
      });
      portalOk = res.ok;
      if (!res.ok) {
        portalErr = (await res.json().catch(() => ({})))?.error || `HTTP ${res.status}`;
      }
    } catch (e) {
      portalErr = e instanceof Error ? e.message : "portale non raggiungibile";
    }

    return NextResponse.json({ ok: true, action, portalOk, portalErr });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 },
    );
  }
}
