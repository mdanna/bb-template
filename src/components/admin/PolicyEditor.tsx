"use client";

import { useEffect, useState } from "react";
import type { Policies } from "@/lib/policies";

type SaveState = "idle" | "saving" | "success" | "error";

export default function PolicyEditor() {
  const [policies, setPolicies] = useState<Policies | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/policies")
      .then((r) => r.json())
      .then(setPolicies)
      .catch(() => setError("Errore nel caricamento"));
  }, []);

  async function handleSave() {
    if (!policies) return;
    setSaveState("saving");
    setError("");
    try {
      const res = await fetch("/api/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...policies, defaultDepositRate: policies.minDepositRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
      setSaveState("error");
    }
  }

  // Keys stored as 0–1 decimals but displayed/edited as 0–100 integers
  const percentFields = new Set<keyof Policies>(["minDepositRate"]);

  function field(
    label: string,
    key: keyof Policies,
    type: "number" | "text" = "number"
  ) {
    const isPercent = percentFields.has(key);
    const displayValue = isPercent && policies ? Math.round((policies[key] as number) * 100) : (policies?.[key] ?? "");
    return (
      <label key={key} className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/70">{label}</span>
        <input
          type={type}
          value={displayValue}
          onChange={(e) =>
            setPolicies((p) => {
              if (!p) return p;
              const raw = type === "number" ? Number(e.target.value) : e.target.value;
              return { ...p, [key]: isPercent ? (raw as number) / 100 : raw };
            })
          }
          className="rounded border border-gold/40 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
        />
      </label>
    );
  }

  function groupLabel(text: string) {
    return (
      <p className="col-span-full text-xs font-medium uppercase tracking-widest text-foreground/40 pt-2">
        {text}
      </p>
    );
  }

  if (!policies) {
    return <p className="text-sm text-foreground/60">{error || "Caricamento…"}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 items-end">
        {groupLabel("Tassa di soggiorno")}
        {field("€ per persona/notte", "cityTaxPerPersonPerNight")}
        {field("Max notti", "cityTaxMaxNights")}

        {groupLabel("Deposito e saldo")}
        {field("Deposito (%)", "minDepositRate")}
        {field("Giorni per saldo", "balanceDueDays")}
        {field("1° promemoria saldo", "balanceReminderDaysFirst")}
        {field("2° promemoria saldo", "balanceReminderDaysSecond")}

        {groupLabel("Cancellazione")}
        {field("Rimborso completo (giorni)", "cancelFullRefundDays")}
        {field("Rimborso parziale (giorni)", "cancelHalfRefundDays")}
        {field("Rimborso parziale (%)", "cancelPartialRefundPct")}
        {field("Spese di cancellazione (%)", "cancelFeePercent")}

        {groupLabel("Prenotazione")}
        {field("Preavviso minimo (giorni)", "minAdvanceBookingDays")}
        {field("Ospiti massimi", "maxGuests")}
        {field("Notti minime", "minNights")}
        {field("Notti massime", "maxNights")}

        {groupLabel("Orari")}
        {field("Orario check-in", "checkinTime", "text")}
        {field("Orario check-out", "checkoutTime", "text")}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50"
        >
          {saveState === "saving" ? "Salvataggio…" : "Salva policy"}
        </button>
        {saveState === "success" && (
          <span className="text-sm text-green-600">Salvato. Il sito si aggiornerà automaticamente in 1–2 minuti.</span>
        )}
        {saveState === "error" && (
          <span className="text-sm text-red-600">{error}</span>
        )}
      </div>
    </div>
  );
}
