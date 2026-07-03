import { pool } from "./db";

// Due soggiorni si sovrappongono se l'intervallo [checkin, checkout) di uno interseca
// quello dell'altro. Si considerano solo le prenotazioni "approved" o "completed":
// le richieste "pending" non bloccano ancora le date (l'host deve poterle confrontare).
export async function hasOverlappingBooking(
  checkin: string,
  checkout: string,
  excludeId?: number
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM bookings
     WHERE status IN ('approved', 'completed')
       AND checkin < $2
       AND checkout > $1
       AND ($3::int IS NULL OR id != $3)
     LIMIT 1`,
    [checkin, checkout, excludeId ?? null]
  );
  return (result.rowCount ?? 0) > 0;
}
