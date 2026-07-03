"use client";

import { useMemo, useState } from "react";
import type { DayRate, DaySource } from "@/data/availability";

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const AIRBNB_COLOR = "#FF5A5F";
const AIRBNB_BLOCKED_COLOR = "#FFCDD0"; // grigio rosato — Airbnb bloccato manualmente
const DIRECT_COLOR = "#A78BFA";

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const CONFLICT_GRADIENT = `linear-gradient(to bottom, ${AIRBNB_COLOR} 50%, rgb(96 165 250) 50%)`;

function rectStyle(src: DaySource | undefined, conflict = false): React.CSSProperties {
  if (conflict) return { background: CONFLICT_GRADIENT };
  if (src === "airbnb") return { backgroundColor: AIRBNB_COLOR };
  if (src === "airbnb-blocked") return { backgroundColor: AIRBNB_BLOCKED_COLOR };
  if (src === "app") return { backgroundColor: "rgb(96 165 250)" };
  if (src === "direct") return { backgroundColor: DIRECT_COLOR };
  return { backgroundColor: "rgba(0,0,0,0.12)" };
}

// Returns all consecutive booked dates belonging to the same run as `iso`
function findRun(iso: string, byDate: Map<string, DayRate>): string[] {
  const clicked = byDate.get(iso);
  if (!clicked || clicked.status !== "booked") return [];
  const src = clicked.source;
  const dates: string[] = [];

  // Walk backwards
  const b = new Date(iso + "T00:00:00");
  while (true) {
    const o = byDate.get(toISO(b));
    if (!o || o.status !== "booked" || o.source !== src) break;
    dates.unshift(toISO(b));
    b.setDate(b.getDate() - 1);
  }

  // Walk forwards from day after iso (iso already included above)
  const f = new Date(iso + "T00:00:00");
  f.setDate(f.getDate() + 1);
  while (true) {
    const o = byDate.get(toISO(f));
    if (!o || o.status !== "booked" || o.source !== src) break;
    dates.push(toISO(f));
    f.setDate(f.getDate() + 1);
  }

  return dates;
}

interface Popup {
  dates: string[];
  source: DaySource;
  note: string;
  conflict: boolean;
}

interface Props {
  defaultPrice: number;
  overrides: DayRate[];
  onToggleDay: (date: string) => void;
  onDeleteRun: (dates: string[]) => void;
  onEditNote: (dates: string[], note: string) => void;
}

export default function AdminCalendar({ defaultPrice, overrides, onToggleDay, onDeleteRun, onEditNote }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [popup, setPopup] = useState<Popup | null>(null);

  const overridesByDate = useMemo(() => {
    const map = new Map<string, DayRate>();
    for (const o of overrides) map.set(o.date, o);
    return map;
  }, [overrides]);

  const grid = useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  function changeMonth(delta: number) {
    setViewDate((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  function openPopup(iso: string) {
    const override = overridesByDate.get(iso);
    if (!override || override.status !== "booked") return;
    const source = override.source ?? "blocked";
    const dates = findRun(iso, overridesByDate);
    setPopup({ dates, source, note: override.note ?? "", conflict: !!override.conflict });
  }

  function handleSaveNote() {
    if (!popup) return;
    onEditNote(popup.dates, popup.note);
    setPopup(null);
  }

  function handleDelete() {
    if (!popup) return;
    onDeleteRun(popup.dates);
    setPopup(null);
  }

  // Popup checkout date = day after the last booked night
  const popupCheckout = useMemo(() => {
    if (!popup || popup.dates.length === 0) return "";
    const last = new Date(popup.dates[popup.dates.length - 1] + "T00:00:00");
    last.setDate(last.getDate() + 1);
    return toISO(last);
  }, [popup]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => changeMonth(-1)}
          className="rounded-full border border-gold/40 px-3 py-1 text-gold transition hover:bg-gold/10"
          aria-label="Mese precedente"
        >
          ‹
        </button>
        <p className="font-serif-display text-xl italic text-foreground">
          {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
        </p>
        <button
          onClick={() => changeMonth(1)}
          className="rounded-full border border-gold/40 px-3 py-1 text-gold transition hover:bg-gold/10"
          aria-label="Mese successivo"
        >
          ›
        </button>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-widest text-foreground/50">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (!d) return <div key={i} />;

          const iso = toISO(d);
          const past = d < today;

          const override = overridesByDate.get(iso);
          const booked = override?.status === "booked";
          const source: DaySource | undefined = override?.source ?? (booked ? "blocked" : undefined);
          const note = override?.note;
          const price = override?.price ?? defaultPrice;
          const customized = Boolean(override) && !booked;

          const prevDay = new Date(d);
          prevDay.setDate(prevDay.getDate() - 1);
          const prevOverride = overridesByDate.get(toISO(prevDay));
          const prevBooked = prevOverride?.status === "booked";
          const prevSource: DaySource | undefined = prevOverride?.source ?? (prevBooked ? "blocked" : undefined);

          const isAirbnb        = source === "airbnb";
          const isAirbnbBlocked = source === "airbnb-blocked";
          const isApp           = source === "app";
          const isDirect        = source === "direct";
          const isConflict      = (isApp || isDirect) && !!override?.conflict;
          const prevIsConflict  = (prevSource === "app" || prevSource === "direct") && !!prevOverride?.conflict;

          const isCheckinDay  = booked && !prevBooked;
          // isMiddle: same visual as previous night (same source AND same conflict state)
          const isMiddle      = booked && prevBooked && source === prevSource && isConflict === prevIsConflict;
          // isBothDay: source or conflict state changes → show both left and right rectangles
          const isBothDay     = booked && prevBooked && (source !== prevSource || isConflict !== prevIsConflict);
          const isCheckoutDay = !booked && prevBooked;

          // Airbnb/App/Direct booked cells open a popup; blocked/free cells toggle
          const opensPopup = !past && booked && (isAirbnb || isAirbnbBlocked || isApp || isDirect || isConflict);
          const clickable   = !past && !isAirbnb && !isAirbnbBlocked && !isApp && !isDirect && !isConflict;

          const tooltip = past
            ? undefined
            : isConflict
              ? `⚠ OVERBOOKING — prenotato sia su Airbnb che sull'app${note ? ` · ${note}` : ""}`
              : opensPopup
                ? `${isAirbnb ? "Airbnb" : isAirbnbBlocked ? "Airbnb (bloccato)" : isDirect ? "Diretta" : "Prenotazione app"}${note ? ` · ${note}` : ""} — clicca per gestire`
                : booked
                  ? "Clicca per liberare questo giorno"
                  : "Clicca per segnarlo come occupato";

          const middleBg: React.CSSProperties = isMiddle
            ? isConflict
              ? { background: CONFLICT_GRADIENT, borderColor: "transparent" }
              : isAirbnb
                ? { backgroundColor: AIRBNB_COLOR, borderColor: "transparent" }
                : isAirbnbBlocked
                  ? { backgroundColor: AIRBNB_BLOCKED_COLOR, borderColor: "transparent" }
                  : isApp
                    ? { backgroundColor: "rgb(96 165 250)", borderColor: "transparent" }
                    : isDirect
                      ? { backgroundColor: DIRECT_COLOR, borderColor: "transparent" }
                      : { backgroundColor: "rgba(0,0,0,0.10)", borderColor: "transparent" }
            : {};

          const textClass = past
            ? "text-foreground/20"
            : isMiddle && isConflict
              ? "text-white"
            : isMiddle && isAirbnbBlocked
              ? "text-foreground/60"
            : isMiddle && (isAirbnb || isApp || isDirect)
              ? "text-white"
            : isMiddle
              ? "text-foreground/40 line-through"
            : isBothDay
              ? "text-foreground/70"
            : isCheckinDay
              ? "text-foreground/70"
            : isCheckoutDay
              ? "text-foreground/80"
            : customized
              ? "text-foreground"
            : !booked
              ? "text-foreground/80"
            : "text-foreground/70";

          const cursorClass = opensPopup ? "cursor-pointer" : clickable ? "cursor-pointer" : "cursor-default";

          const borderClass = past || isMiddle || isBothDay
            ? "border-transparent"
            : customized
              ? "border-gold"
              : "border-gold/20";

          return (
            <button
              key={iso}
              onClick={() => {
                if (past) return;
                if (opensPopup) { openPopup(iso); return; }
                if (clickable) onToggleDay(iso);
              }}
              title={tooltip}
              className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-md border text-xs transition ${cursorClass} ${borderClass} ${textClass} hover:brightness-95`}
              style={middleBg}
            >
              {/* Left rectangle: checkout of previous booking (gradient if previous was conflict) */}
              {(isCheckoutDay || isBothDay) && (
                <span
                  className="absolute inset-y-0 left-0 w-[42%]"
                  style={rectStyle(prevSource, prevIsConflict)}
                />
              )}

              {/* Right rectangle: check-in of current booking (gradient if current is conflict) */}
              {(isCheckinDay || isBothDay) && (
                <span
                  className="absolute inset-y-0 right-0 w-[42%]"
                  style={rectStyle(source, isConflict)}
                />
              )}

              <span className="relative">{d.getDate()}</span>
              {!booked && !past && (
                <span className="relative text-[10px] text-gold">€{price}</span>
              )}
              {note && booked && (
                <span className="relative mt-0.5 max-w-full truncate px-0.5 text-[8px] leading-none opacity-80">
                  {note}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-foreground/60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: AIRBNB_COLOR }} />
          Airbnb
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-400" />
          Prenotazione app
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: DIRECT_COLOR }} />
          Diretta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: AIRBNB_BLOCKED_COLOR }} />
          Airbnb (bloccato)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-foreground/20" />
          Bloccato manualmente (cliccabile)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-gold bg-gold/10" />
          Prezzo personalizzato
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CONFLICT_GRADIENT }} />
          ⚠ Overbooking
        </span>
      </div>

      <p className="mt-3 text-xs text-foreground/50">
        Clicca su un giorno grigio per bloccarlo o liberarlo. Clicca su un giorno Airbnb o app per gestire la prenotazione.
      </p>

      {/* Booking popup */}
      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPopup(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg border border-gold/40 bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {popup.source === "airbnb" && (
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: AIRBNB_COLOR }} />
                )}
                {popup.source === "airbnb-blocked" && (
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: AIRBNB_BLOCKED_COLOR }} />
                )}
                {popup.source === "app" && (
                  <span className="inline-block h-3 w-3 rounded-full bg-blue-400" />
                )}
                {popup.source === "direct" && (
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: DIRECT_COLOR }} />
                )}
                <h3 className="font-serif-display text-lg italic text-foreground">
                  {popup.source === "airbnb" ? "Airbnb"
                    : popup.source === "airbnb-blocked" ? "Airbnb (bloccato)"
                    : popup.source === "app" ? "Prenotazione app"
                    : popup.source === "direct" ? "Prenotazione diretta"
                    : "Blocco manuale"}
                </h3>
              </div>
              <button
                onClick={() => setPopup(null)}
                className="text-foreground/40 transition hover:text-foreground"
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>

            {/* Overbooking warning */}
            {popup.conflict && (
              <div className="mt-3 rounded-md border border-red-400/60 bg-red-50 px-3 py-2 text-xs text-red-700">
                ⚠ <strong>Overbooking</strong> — questa notte risulta prenotata sia su Airbnb che tramite l&apos;app. Gestisci manualmente contattando uno dei clienti.
              </div>
            )}

            {/* Dates */}
            <div className="mt-3 flex gap-4 text-sm text-foreground/70">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-foreground/40">Check-in</p>
                <p>{fmtDate(popup.dates[0])}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-foreground/40">Check-out</p>
                <p>{fmtDate(popupCheckout)}</p>
              </div>
            </div>

            {/* Nome ospite / nota */}
            <div className="mt-4">
              <label className="text-[10px] uppercase tracking-widest text-foreground/40">
                {popup.source === "app" ? "Nota" : "Nome ospite"}
              </label>
              {popup.source === "app" ? (
                <p className="mt-1 text-sm text-foreground/70">{popup.note || "—"}</p>
              ) : (
                <input
                  type="text"
                  value={popup.note ?? ""}
                  onChange={(e) => setPopup((p) => p ? { ...p, note: e.target.value } : p)}
                  placeholder="Nome e cognome ospite…"
                  className="mt-1 w-full rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold"
                />
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {(popup.source === "airbnb" || popup.source === "airbnb-blocked" || popup.source === "direct") && (
                <button
                  onClick={handleSaveNote}
                  className="rounded-full border border-gold bg-gold px-4 py-1.5 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
                >
                  Salva
                </button>
              )}
              <button
                onClick={handleDelete}
                className="rounded-full border border-red-400/60 px-4 py-1.5 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-50"
              >
                Elimina
              </button>
              <button
                onClick={() => setPopup(null)}
                className="rounded-full border border-gold/30 px-4 py-1.5 text-xs uppercase tracking-widest text-foreground/60 transition hover:bg-gold/10"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
