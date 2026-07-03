import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, deleteFile, requireBotToken } from "@/lib/githubContent";

const IMAGES_DIR = "public/images";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const res = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPO_OWNER ?? "mdanna"}/${process.env.GITHUB_REPO_NAME ?? "la-casa-misteriosa"}/contents/${IMAGES_DIR}?ref=${process.env.GITHUB_DATA_BRANCH ?? "main"}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as Array<{ name: string; type: string; sha: string }>;
    const files = data
      .filter((f) => f.type === "file")
      .map((f) => ({ name: f.name, sha: f.sha }));
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || typeof body.base64 !== "string") {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const name = body.name as string;
  const base64 = body.base64 as string;
  const path = `${IMAGES_DIR}/${name}`;

  try {
    const token = requireBotToken();
    let sha = "";
    try {
      ({ sha } = await getFile(path, token));
    } catch {
      sha = "";
    }
    // putFile encodes utf-8 content to base64, but we already have binary base64.
    // Use raw GitHub API call instead.
    const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "mdanna";
    const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "la-casa-misteriosa";
    const DATA_BRANCH = process.env.GITHUB_DATA_BRANCH ?? "main";
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Upload image: ${name}`,
          content: base64,
          ...(sha ? { sha } : {}),
          branch: DATA_BRANCH,
        }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload fallito" },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string") {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const name = body.name as string;
  const path = `${IMAGES_DIR}/${name}`;

  try {
    const token = requireBotToken();
    const { sha } = await getFile(path, token);
    await deleteFile(path, sha, `Delete image: ${name}`, token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Eliminazione fallita" },
      { status: 502 }
    );
  }
}
