import { getFile, putFile, requireBotToken } from "./githubContent";
import { enumerateDateOnly } from "./dateOnly";

const FILE_PATH = "src/data/availability.json";

interface DayRate {
  date: string;
  price: number;
  status: "available" | "booked";
  source?: "airbnb" | "app" | "blocked";
  note?: string;
}

interface AvailabilityData {
  defaultPrice: number;
  overrides: DayRate[];
}

// Segna come "booked" le notti di un soggiorno (dal check-in al check-out escluso, coerente
// con la semantica già usata nel calendario admin) committando l'aggiornamento su GitHub,
// così il calendario pubblico riflette automaticamente le prenotazioni approvate/pagate.
export async function markNightsBooked(checkin: string | Date, checkout: string | Date, guestName?: string) {
  const allDates = enumerateDateOnly(checkin, checkout);
  const nights = allDates.length > 1 ? allDates.slice(0, -1) : allDates;
  if (nights.length === 0) return;

  const token = requireBotToken();
  const { content, sha } = await getFile(FILE_PATH, token);
  const data = JSON.parse(content) as AvailabilityData;

  const nextOverrides = data.overrides.filter((o) => !nights.includes(o.date));
  for (const date of nights) {
    const existing = data.overrides.find((o) => o.date === date);
    nextOverrides.push({
      date,
      price: existing?.price ?? data.defaultPrice,
      status: "booked",
      source: "app",
      ...(guestName ? { note: guestName } : {}),
    });
  }
  nextOverrides.sort((a, b) => a.date.localeCompare(b.date));

  const nextContent = JSON.stringify(
    { defaultPrice: data.defaultPrice, overrides: nextOverrides },
    null,
    2
  );

  await putFile(
    FILE_PATH,
    nextContent,
    sha,
    `Block booked nights from confirmed reservation`,
    token
  );
}

// Rimuove il blocco "booked" dalle notti di un soggiorno annullato, riportandole al prezzo
// di base (o a un eventuale prezzo personalizzato già impostato dall'host per quei giorni).
export async function unmarkNightsBooked(checkin: string | Date, checkout: string | Date) {
  const allDates = enumerateDateOnly(checkin, checkout);
  const nights = allDates.length > 1 ? allDates.slice(0, -1) : allDates;
  if (nights.length === 0) return;

  const token = requireBotToken();
  const { content, sha } = await getFile(FILE_PATH, token);
  const data = JSON.parse(content) as AvailabilityData;

  const nextOverrides = data.overrides.filter(
    (o) => !(nights.includes(o.date) && o.status === "booked")
  );
  nextOverrides.sort((a, b) => a.date.localeCompare(b.date));

  const nextContent = JSON.stringify(
    { defaultPrice: data.defaultPrice, overrides: nextOverrides },
    null,
    2
  );

  await putFile(
    FILE_PATH,
    nextContent,
    sha,
    `Unblock nights from cancelled reservation`,
    token
  );
}
