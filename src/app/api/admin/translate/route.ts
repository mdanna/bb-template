import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { localeOrder, type LocaleCode } from "@/i18n/index";

const LOCALE_NAMES: Record<LocaleCode, string> = {
  it: "Italian", en: "English", fr: "French", de: "German",
  es: "Spanish", pt: "Portuguese", zh: "Chinese (Simplified)",
  ja: "Japanese", ko: "Korean",
};

// Body: { texts: Record<string, string>, sourceLocale?: LocaleCode }
//   texts keys are field names, values are source texts written in `sourceLocale` (default "it").
// Returns: { translations: Record<string, Record<LocaleCode, string>> } — one entry per target locale.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as { texts?: Record<string, string>; sourceLocale?: LocaleCode } | null;
  if (!body?.texts || typeof body.texts !== "object") {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const sourceLocale: LocaleCode = body.sourceLocale && LOCALE_NAMES[body.sourceLocale] ? body.sourceLocale : "it";
  // Targets are every supported locale except the source.
  const targetLocales: LocaleCode[] = localeOrder.filter((l) => l !== sourceLocale);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurata" }, { status: 503 });

  const client = new Anthropic({ apiKey });

  const fieldKeys = Object.keys(body.texts);
  const fieldsList = Object.entries(body.texts)
    .map(([key, val]) => `- ${key}: ${JSON.stringify(val)}`)
    .join("\n");

  // Build tool schema with one string property per field × per target language
  const localeProps = targetLocales.reduce<Record<string, { type: "string" }>>((acc, l) => {
    acc[l] = { type: "string" };
    return acc;
  }, {});

  const fieldProps = fieldKeys.reduce<Record<string, { type: "object"; properties: typeof localeProps; required: string[] }>>((acc, key) => {
    acc[key] = { type: "object", properties: localeProps, required: targetLocales as string[] };
    return acc;
  }, {});

  const prompt = `You are a professional translator for a B&B accommodation website.
Translate the following ${LOCALE_NAMES[sourceLocale]} text fields into: ${targetLocales.map(l => LOCALE_NAMES[l]).join(", ")}.

${LOCALE_NAMES[sourceLocale]} source texts:
${fieldsList}

Rules:
- Keep proper nouns and place names in their conventional translated form
- Maintain a warm, elegant tone
- Do not add or remove sentences`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      tools: [
        {
          name: "save_translations",
          description: "Save all translated fields",
          input_schema: {
            type: "object" as const,
            properties: fieldProps,
            required: fieldKeys,
          },
        },
      ],
      tool_choice: { type: "tool", name: "save_translations" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Risposta non valida dall'API");
    }
    const translations = toolUse.input as Record<string, Record<string, string>>;
    return NextResponse.json({ translations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore traduzione" },
      { status: 502 }
    );
  }
}
