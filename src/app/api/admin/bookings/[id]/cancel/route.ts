import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { unmarkNightsBooked } from "@/lib/syncAvailability";
import { parseDateOnly } from "@/lib/dateOnly";

const REFUND_WINDOW_DAYS = 10;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureSchema();

  const before = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE id = $1 AND status IN ('pending', 'approved', 'completed')`,
    [id]
  );
  const previous = before.rows[0];
  if (!previous) {
    return NextResponse.json(
      { error: "Prenotazione non trovata o già rifiutata/annullata" },
      { status: 404 }
    );
  }

  const wasPaid = previous.status === "completed";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilCheckin = Math.round(
    (parseDateOnly(previous.checkin).getTime() - today.getTime()) / 86_400_000
  );
  const refundDue = wasPaid && daysUntilCheckin >= REFUND_WINDOW_DAYS;

  const result = await pool.query<Booking>(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *`,
    [id]
  );
  const booking = result.rows[0];

  let calendarError: string | null = null;
  // Se la richiesta era ancora "pending" il calendario non aveva nulla di bloccato per queste
  // date: rimuovere un override inesistente è comunque un'operazione innocua (no-op).
  try {
    await unmarkNightsBooked(booking.checkin, booking.checkout);
  } catch (err) {
    calendarError = err instanceof Error ? err.message : "Sincronizzazione calendario fallita";
  }

  // Il rimborso della anticipo non è automatico: lo gestisce l'host manualmente da Stripe.
  // Qui calcoliamo solo se spetta (cancellazione di una prenotazione pagata con almeno 10
  // giorni di anticipo sul check-in) e lo segnaliamo chiaramente in risposta.
  const refundNotice = wasPaid
    ? refundDue
      ? `Rimborso dovuto: l'anticipo di €${booking.deposit_amount ?? "?"} va restituito manualmente all'ospite (cancellazione con ${daysUntilCheckin} giorni di anticipo, oltre la soglia di ${REFUND_WINDOW_DAYS}).`
      : `Nessun rimborso dovuto: cancellazione a ${daysUntilCheckin} giorni dal check-in, sotto la soglia di ${REFUND_WINDOW_DAYS} giorni.`
    : null;

  return NextResponse.json({ ok: true, booking, calendarError, refundDue, refundNotice });
}
