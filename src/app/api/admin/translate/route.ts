import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import type { LocaleCode } from "@/i18n/index";

const LOCALE_NAMES: Record<LocaleCode, string> = {
  it: "Italian", en: "English", fr: "French", de: "German",
  es: "Spanish", pt: "Portuguese", zh: "Chinese (Simplified)",
  ja: "Japanese", ko: "Korean",
};

const ALL_LOCALES: LocaleCode[] = ["it", "en", "fr", "de", "es", "pt", "zh", "ja", "ko"];

// Body: { texts: Record<string, string>, sourceLang?: LocaleCode }
// Returns: { translations: Record<string, Record<LocaleCode, string>> }
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as { texts?: Record<string, string>; sourceLang?: string } | null;
  if (!body?.texts || typeof body.texts !== "object") {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const sourceLang: LocaleCode = (body.sourceLang && ALL_LOCALES.includes(body.sourceLang as LocaleCode))
    ? body.sourceLang as LocaleCode
    : "it";
  const TARGET_LOCALES = ALL_LOCALES.filter((l) => l !== sourceLang);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurata" }, { status: 503 });

  const client = new Anthropic({ apiKey });

  // Drop fields with empty source text — nothing to translate, keeps Haiku from returning empty strings
  const nonEmptyTexts = Object.fromEntries(Object.entries(body.texts).filter(([, v]) => v.trim()));
  const fieldKeys = Object.keys(nonEmptyTexts);
  if (fieldKeys.length === 0) return NextResponse.json({ translations: {} });

  const fieldsList = Object.entries(nonEmptyTexts)
    .map(([key, val]) => `- ${key}: ${JSON.stringify(val)}`)
    .join("\n");

  // Build tool schema with one string property per field × per language
  const localeProps = TARGET_LOCALES.reduce<Record<string, { type: "string" }>>((acc, l) => {
    acc[l] = { type: "string" };
    return acc;
  }, {});

  const fieldProps = fieldKeys.reduce<Record<string, { type: "object"; properties: typeof localeProps; required: string[] }>>((acc, key) => {
    acc[key] = { type: "object", properties: localeProps, required: TARGET_LOCALES as string[] };
    return acc;
  }, {});

  const sourceLangName = LOCALE_NAMES[sourceLang];
  const prompt = `You are a professional translator for a B&B accommodation website in Rome, Italy.
Translate the following ${sourceLangName} text fields into: ${TARGET_LOCALES.map(l => LOCALE_NAMES[l]).join(", ")}.

${sourceLangName} source texts:
${fieldsList}

Rules:
- Keep proper nouns (Prati, Vaticano, San Pietro, Ottaviano, Morfeo) in their conventional translated form
- Maintain the warm, elegant tone of a boutique B&B
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
