import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { CONTENT, type SiteContent } from "@/lib/siteContent";

const FILE_PATH = "src/data/content.json";

function isValidContent(body: unknown): body is SiteContent {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.locationDisplay === "string" &&
    typeof b.address === "string" &&
    typeof b.phone === "string" &&
    typeof b.email === "string" &&
    typeof b.hostName === "string" &&
    typeof b.airbnbUrl === "string" &&
    typeof b.airbnbRating === "number" &&
    typeof b.airbnbReviewCount === "number" &&
    typeof b.mapLat === "number" &&
    typeof b.mapLng === "number" &&
    Array.isArray(b.mapBookmarks) &&
    typeof b.heroImage === "string" &&
    Array.isArray(b.galleryImages) &&
    Array.isArray(b.amenities) &&
    Array.isArray(b.reviews) &&
    (!("heroSubtitle" in b) || typeof b.heroSubtitle === "object") &&
    (!("storyTitle" in b) || typeof b.storyTitle === "object") &&
    (!("storyParagraphs" in b) || Array.isArray(b.storyParagraphs)) &&
    (!("areaDescription" in b) || typeof b.areaDescription === "object") &&
    (!("areaPlaces" in b) || Array.isArray(b.areaPlaces)) &&
    (!("siteTitle" in b) || typeof b.siteTitle === "object") &&
    (!("details" in b) || typeof b.details === "object")
  );
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json(CONTENT);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidContent(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const token = requireBotToken();
    let sha: string;
    try {
      ({ sha } = await getFile(FILE_PATH, token));
    } catch {
      sha = "";
    }
    const content = JSON.stringify(body, null, 2) + "\n";
    await putFile(FILE_PATH, content, sha, "Update site content", token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
