import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { formatFriendlyDate, formatFriendlyDateOnly } from "@/lib/emailDates";
import { getMethodLabel } from "@/lib/emailTemplates";
import type { LocaleCode } from "@/i18n/index";
import { verifyAccessToken } from "@/lib/accessToken";
import { CONTENT } from "@/lib/siteContent";

// pdf-lib's standard fonts only support Latin (WinAnsi) glyphs, quindi per le lingue
// CJK la ricevuta PDF usa le etichette in inglese invece di rompersi con testo non renderizzabile.
const CJK: LocaleCode[] = ["zh", "ja", "ko"];

type PdfLabels = {
  title: string; subtitle: string;
  locatore: string; immobile: string; cfLocatore: string;
  code: string; guest: string; guests: string;
  checkin: string; checkout: string; total: string;
  method: string; paidOn: string; thanks: string; na: string;
};

const PDF_LABELS: Record<string, PdfLabels> = {
  it: {
    title: CONTENT.siteTitle.it,
    subtitle: "Conferma di prenotazione e ricevuta di pagamento",
    locatore: "Locatore",
    immobile: "Immobile",
    cfLocatore: "P.IVA / C.F.",
    code: "Codice prenotazione",
    guest: "Ospite",
    guests: "Numero ospiti",
    checkin: "Check-in",
    checkout: "Check-out",
    total: "Importo totale",
    method: "Metodo di pagamento",
    paidOn: "Data pagamento",
    thanks: `Grazie per aver scelto ${CONTENT.siteTitle.it}.`,
    na: "n.d.",
  },
  en: {
    title: CONTENT.siteTitle.en,
    subtitle: "Booking confirmation and payment receipt",
    locatore: "Landlord",
    immobile: "Property",
    cfLocatore: "VAT / Tax ID",
    code: "Booking code",
    guest: "Guest",
    guests: "Number of guests",
    checkin: "Check-in",
    checkout: "Check-out",
    total: "Total amount",
    method: "Payment method",
    paidOn: "Payment date",
    thanks: `Thank you for choosing ${CONTENT.siteTitle.en}.`,
    na: "n/a",
  },
  fr: {
    title: CONTENT.siteTitle.fr,
    subtitle: "Confirmation de réservation et reçu de paiement",
    locatore: "Bailleur",
    immobile: "Bien loué",
    cfLocatore: "TVA / N° fiscal",
    code: "Code de réservation",
    guest: "Hôte",
    guests: "Nombre de voyageurs",
    checkin: "Arrivée",
    checkout: "Départ",
    total: "Montant total",
    method: "Méthode de paiement",
    paidOn: "Date de paiement",
    thanks: `Merci d'avoir choisi ${CONTENT.siteTitle.fr}.`,
    na: "n/d",
  },
  de: {
    title: CONTENT.siteTitle.de,
    subtitle: "Buchungsbestätigung und Zahlungsbeleg",
    locatore: "Vermieter",
    immobile: "Mietobjekt",
    cfLocatore: "USt-ID / Steuer-Nr.",
    code: "Buchungscode",
    guest: "Gast",
    guests: "Anzahl der Gäste",
    checkin: "Anreise",
    checkout: "Abreise",
    total: "Gesamtbetrag",
    method: "Zahlungsmethode",
    paidOn: "Zahlungsdatum",
    thanks: `Vielen Dank, dass Sie sich für ${CONTENT.siteTitle.de} entschieden haben.`,
    na: "k.A.",
  },
  es: {
    title: CONTENT.siteTitle.es,
    subtitle: "Confirmación de reserva y recibo de pago",
    locatore: "Arrendador",
    immobile: "Inmueble",
    cfLocatore: "IVA / NIF",
    code: "Código de reserva",
    guest: "Huésped",
    guests: "Número de huéspedes",
    checkin: "Llegada",
    checkout: "Salida",
    total: "Importe total",
    method: "Método de pago",
    paidOn: "Fecha de pago",
    thanks: `Gracias por elegir ${CONTENT.siteTitle.es}.`,
    na: "n/d",
  },
  pt: {
    title: CONTENT.siteTitle.pt,
    subtitle: "Confirmação de reserva e recibo de pagamento",
    locatore: "Locador",
    immobile: "Imóvel",
    cfLocatore: "NIF / N.º fiscal",
    code: "Código da reserva",
    guest: "Hóspede",
    guests: "Número de hóspedes",
    checkin: "Check-in",
    checkout: "Check-out",
    total: "Valor total",
    method: "Método de pagamento",
    paidOn: "Data do pagamento",
    thanks: `Obrigado por escolher ${CONTENT.siteTitle.pt}.`,
    na: "n/d",
  },
};

function drawRow(
  page: ReturnType<PDFDocument["addPage"]>,
  label: string, value: string, y: number, left: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  dark: ReturnType<typeof rgb>,
) {
  page.drawText(label, { x: left, y, size: 11, font: bold, color: dark });
  page.drawText(value, { x: left + 200, y, size: 11, font, color: dark });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const token = new URL(request.url).searchParams.get("t");
  if (!verifyAccessToken(code, token)) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  await ensureSchema();

  const result = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE code = $1 AND status = 'completed'`,
    [code]
  );
  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json({ error: "Ricevuta non disponibile" }, { status: 404 });
  }

  const bookingLocale = (booking.locale as LocaleCode) ?? "it";
  const pdfLocale = CJK.includes(bookingLocale) ? "en" : bookingLocale;
  const rawLabels = PDF_LABELS[pdfLocale] ?? PDF_LABELS.it;

  const L = rawLabels;
  const dateLocale: LocaleCode = CJK.includes(bookingLocale) ? "en" : bookingLocale;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.72, 0.57, 0.25);
  const dark = rgb(0.12, 0.16, 0.27);
  const gray = rgb(0.45, 0.45, 0.45);

  let y = 780;
  const left = 60;
  const pageWidth = 595;

  // ── Intestazione ──────────────────────────────────────────────────────────
  page.drawText(L.title, { x: left, y, size: 20, font: bold, color: dark });
  y -= 22;
  page.drawText(L.subtitle, { x: left, y, size: 12, font, color: gold });
  y -= 32;

  // Linea separatrice
  page.drawLine({ start: { x: left, y }, end: { x: pageWidth - left, y }, thickness: 0.5, color: gold });
  y -= 18;

  // ── Dati locatore ─────────────────────────────────────────────────────────
  page.drawText(L.locatore.toUpperCase(), { x: left, y, size: 8, font: bold, color: gray });
  y -= 14;
  page.drawText(CONTENT.hostName, { x: left, y, size: 11, font: bold, color: dark });
  y -= 14;
  if (CONTENT.address) {
    page.drawText(CONTENT.address, { x: left, y, size: 10, font, color: dark });
    y -= 14;
  }
  if (CONTENT.vatNumber) {
    page.drawText(`${L.cfLocatore}: ${CONTENT.vatNumber}`, { x: left, y, size: 10, font, color: dark });
    y -= 14;
  }
  page.drawText(CONTENT.email, { x: left, y, size: 10, font, color: dark });
  y -= 20;

  // ── Dati immobile ─────────────────────────────────────────────────────────
  page.drawText(L.immobile.toUpperCase(), { x: left, y, size: 8, font: bold, color: gray });
  y -= 14;
  page.drawText(CONTENT.siteTitle.it, { x: left, y, size: 11, font: bold, color: dark });
  y -= 14;
  page.drawText(CONTENT.address, { x: left, y, size: 10, font, color: dark });
  y -= 14;
  page.drawText(`CIN: ${CONTENT.cin}`, { x: left, y, size: 10, font, color: dark });
  y -= 24;

  // Linea separatrice
  page.drawLine({ start: { x: left, y }, end: { x: pageWidth - left, y }, thickness: 0.5, color: gold });
  y -= 20;

  // ── Dati prenotazione ─────────────────────────────────────────────────────
  const method =
    booking.payment_method === "card" || booking.payment_method === "paypal"
      ? getMethodLabel(bookingLocale, booking.payment_method)
      : (booking.payment_method ?? L.na);

  const rows: [string, string][] = [
    [L.code, booking.code],
    [L.guest, `${booking.first_name} ${booking.last_name}`],
    [L.guests, String(booking.guests)],
    [L.checkin, formatFriendlyDateOnly(booking.checkin, dateLocale)],
    [L.checkout, formatFriendlyDateOnly(booking.checkout, dateLocale)],
    [L.total, booking.total_price ? `€ ${booking.total_price}` : L.na],
    [L.method, method],
    [L.paidOn, booking.paid_at ? formatFriendlyDate(booking.paid_at, dateLocale) : L.na],
  ];

  for (const [label, value] of rows) {
    drawRow(page, label, value, y, left, font, bold, dark);
    y -= 24;
  }

  // ── Chiusura ──────────────────────────────────────────────────────────────
  y -= 14;
  page.drawLine({ start: { x: left, y }, end: { x: pageWidth - left, y }, thickness: 0.5, color: gold });
  y -= 16;
  page.drawText(L.thanks, { x: left, y, size: 11, font, color: dark });
  y -= 14;
  page.drawText(`${CONTENT.city}, Italia · ${CONTENT.phone}`, { x: left, y, size: 9, font, color: gray });

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="conferma-${booking.code}.pdf"`,
    },
  });
}
