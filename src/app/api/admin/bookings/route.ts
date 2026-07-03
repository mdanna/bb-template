import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  await ensureSchema();
  const result = await pool.query<Booking>(
    `SELECT * FROM bookings ORDER BY created_at DESC`
  );

  return NextResponse.json({ bookings: result.rows });
}
