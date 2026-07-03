import { NextResponse } from "next/server";
import { getFile } from "@/lib/githubContent";

const FILE_PATH = "src/data/availability.json";

// Reads directly from GitHub so the response always reflects the latest saved data,
// without waiting for a Vercel rebuild.
export async function GET() {
  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    const data = JSON.parse(content);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore lettura disponibilità" },
      { status: 502 }
    );
  }
}
