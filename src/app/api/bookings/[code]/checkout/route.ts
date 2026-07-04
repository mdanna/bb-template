import { NextResponse } from "next/server";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rateLimit";
import { computePricingBreakdown, MIN_DEPOSIT_RATE, MAX_DEPOSIT_RATE, DEFAULT_DEPOSIT_RATE } from "@/lib/pricing";
import { POLICIES } from "@/lib/policies";
import { CONTENT } from "@/lib/siteContent";
import { verifyAccessToken } from "@/lib/accessToken";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const rate = checkRateLimit(request, "bookings-checkout", 10, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra qualche minuto." },
      { status: 429 }
    );
  }

  const { code } = await context.params;
  const token = new URL(request.url).searchParams.get("t");
  if (!verifyAccessToken(code, token)) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  // Parse optional depositRate from body
  let bodyDepositRate: number | undefined;
  try {
    const body = await request.json();
    if (typeof body?.depositRate === "number") {
      bodyDepositRate = Math.min(Math.max(body.depositRate, MIN_DEPOSIT_RATE), MAX_DEPOSIT_RATE);
    }
  } catch { /* body is optional */ }

  await ensureSchema();

  const result = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE code = $1 AND status = 'approved'`,
    [code]
  );
  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json(
      { error: "Prenotazione non trovata o non in stato approvato" },
      { status: 404 }
    );
  }
  if (!booking.total_price || booking.total_price <= 0) {
    return NextResponse.json({ error: "Importo non valido per il pagamento" }, { status: 400 });
  }

  // Always recompute pricing with the chosen deposit rate (or fall back to stored rate / default)
  const depositRate =
    bodyDepositRate ??
    (booking.deposit_rate != null ? Number(booking.deposit_rate) : undefined);

  const pricing = computePricingBreakdown(
    Number(booking.total_price),
    booking.guests,
    booking.checkin,
    booking.checkout,
    depositRate
  );

  await pool.query(
    `UPDATE bookings SET deposit_amount = $2, city_tax = $3, balance_due = $4, deposit_rate = $5 WHERE id = $1`,
    [booking.id, pricing.depositAmount, pricing.cityTax, pricing.balanceDue, pricing.depositRate]
  );

  const depositPct = Math.round((pricing.depositRate ?? DEFAULT_DEPOSIT_RATE) * 100);
  const isFullPayment = depositPct >= 100;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(pricing.depositAmount * 100),
            product_data: {
              name: isFullPayment
                ? `Pagamento completo · ${CONTENT.siteTitle.it} · ${booking.code}`
                : `Anticipo ${depositPct}% · ${CONTENT.siteTitle.it} · ${booking.code}`,
              description: isFullPayment
                ? `Check-in ${booking.checkin} → Check-out ${booking.checkout} · Tassa di soggiorno €${pricing.cityTax} riscossa separatamente al check-in`
                : `Check-in ${booking.checkin} → Check-out ${booking.checkout} · Saldo di €${pricing.balanceDue} da versare entro ${POLICIES.balanceDueDays} giorni prima del check-in · Tassa di soggiorno €${pricing.cityTax} riscossa separatamente al check-in`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: booking.email,
      client_reference_id: booking.code,
      metadata: { bookingCode: booking.code },
      success_url: `${siteUrl()}/confirmation/${booking.code}?session_id={CHECKOUT_SESSION_ID}&t=${encodeURIComponent(token!)}`,
      cancel_url: `${siteUrl()}/pay/${booking.code}?t=${encodeURIComponent(token!)}`,
    });

    if (!session.url) {
      throw new Error("Stripe non ha restituito un URL di pagamento");
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Impossibile avviare il pagamento" },
      { status: 502 }
    );
  }
}
