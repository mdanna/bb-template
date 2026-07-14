import { describe, it, expect } from "vitest";
import { bookedRanges, buildExportICal } from "@/lib/icalExport";
import type { DayRate } from "@/data/availability";

function day(date: string, status: DayRate["status"] = "booked", source?: DayRate["source"]): DayRate {
  return { date, price: 100, status, ...(source ? { source } : {}) };
}

describe("bookedRanges", () => {
  it("accorpa notti contigue in un solo intervallo [start, endEsclusivo)", () => {
    const r = bookedRanges([day("2026-07-27"), day("2026-07-28"), day("2026-07-29")]);
    expect(r).toEqual([{ start: "2026-07-27", end: "2026-07-30" }]);
  });

  it("separa intervalli con un buco", () => {
    const r = bookedRanges([day("2026-07-27"), day("2026-07-28"), day("2026-08-01")]);
    expect(r).toEqual([
      { start: "2026-07-27", end: "2026-07-29" },
      { start: "2026-08-01", end: "2026-08-02" },
    ]);
  });

  it("ignora le notti disponibili e deduplica/ordina", () => {
    const r = bookedRanges([day("2026-07-28"), day("2026-07-27"), day("2026-07-27"), day("2026-07-29", "available")]);
    expect(r).toEqual([{ start: "2026-07-27", end: "2026-07-29" }]);
  });

  it("include tutte le fonti (dirette, OTA, blocchi)", () => {
    const r = bookedRanges([day("2026-07-27", "booked", "app"), day("2026-07-28", "booked", "airbnb")]);
    expect(r).toEqual([{ start: "2026-07-27", end: "2026-07-29" }]);
  });
});

describe("buildExportICal", () => {
  const opts = { calName: "Villa Test — Roma", uidDomain: "villatest.com", stamp: "2026-07-14T10:00:00.000Z" };

  it("produce un VCALENDAR valido con un VEVENT per intervallo", () => {
    const ics = buildExportICal([day("2026-07-27"), day("2026-07-28")], opts);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260727");
    expect(ics).toContain("DTEND;VALUE=DATE:20260729"); // checkout esclusivo
    expect(ics).toContain("UID:2026-07-27-2026-07-29@villatest.com");
    expect(ics).toContain("DTSTAMP:20260714T100000Z");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("usa CRLF come terminatore di riga (RFC 5545)", () => {
    const ics = buildExportICal([day("2026-07-27")], opts);
    expect(ics).toContain("\r\n");
    expect(ics).not.toMatch(/[^\r]\n/); // nessun LF non preceduto da CR
  });

  it("nessun evento se non ci sono notti prenotate", () => {
    const ics = buildExportICal([day("2026-07-27", "available")], opts);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(0);
  });
});
