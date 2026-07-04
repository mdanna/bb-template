import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireBotToken } from "@/lib/githubContent";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "mdanna";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "la-casa-misteriosa";

// GET /api/admin/deploy-status?sha=<commit sha>
// Vercel registra un "deployment" GitHub per ogni commit: ne interroghiamo lo stato.
// Returns: { state: "waiting" | "building" | "ready" | "error" }
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const sha = new URL(request.url).searchParams.get("sha");
  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    return NextResponse.json({ error: "SHA non valido" }, { status: 400 });
  }

  const token = requireBotToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const depRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/deployments?sha=${sha}&per_page=5`,
    { headers, cache: "no-store" }
  );
  if (!depRes.ok) {
    return NextResponse.json({ error: "Errore GitHub" }, { status: 502 });
  }
  const deployments = (await depRes.json()) as { id: number; environment: string }[];
  // Il deployment Vercel per il commit può impiegare qualche secondo a comparire
  if (deployments.length === 0) return NextResponse.json({ state: "waiting" });

  // Preferisci l'ambiente Production se presente
  const dep = deployments.find((d) => /production/i.test(d.environment)) ?? deployments[0];

  const stRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/deployments/${dep.id}/statuses?per_page=1`,
    { headers, cache: "no-store" }
  );
  if (!stRes.ok) {
    return NextResponse.json({ error: "Errore GitHub" }, { status: 502 });
  }
  const statuses = (await stRes.json()) as { state: string }[];
  const state = statuses[0]?.state ?? "pending";

  if (state === "success") return NextResponse.json({ state: "ready" });
  if (state === "error" || state === "failure") return NextResponse.json({ state: "error" });
  return NextResponse.json({ state: "building" });
}
