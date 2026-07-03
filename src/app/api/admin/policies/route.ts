import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { POLICIES, type Policies } from "@/lib/policies";

const FILE_PATH = "src/data/policies.json";

function isValidPolicies(body: unknown): body is Policies {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.airbnbIcalUrl === "string" &&
    typeof b.cityTaxPerPersonPerNight === "number" &&
    typeof b.cityTaxMaxNights === "number" &&
    typeof b.defaultDepositRate === "number" &&
    typeof b.minDepositRate === "number" &&
    typeof b.balanceDueDays === "number" &&
    typeof b.cancelFullRefundDays === "number" &&
    typeof b.cancelHalfRefundDays === "number" &&
    typeof b.cancelPartialRefundPct === "number" &&
    typeof b.cancelFeePercent === "number" &&
    typeof b.minAdvanceBookingDays === "number" &&
    typeof b.minNights === "number" &&
    typeof b.maxNights === "number" &&
    typeof b.maxGuests === "number" &&
    typeof b.balanceReminderDaysFirst === "number" &&
    typeof b.balanceReminderDaysSecond === "number" &&
    typeof b.checkinTime === "string" &&
    typeof b.checkoutTime === "string"
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
    return NextResponse.json(POLICIES);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidPolicies(body)) {
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
    await putFile(FILE_PATH, content, sha, "Update policies", token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
