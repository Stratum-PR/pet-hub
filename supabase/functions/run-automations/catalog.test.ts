import { describe, expect, it } from "vitest";
import {
  actionsForTrigger,
  conditionsMatch,
  couponDiscountCents,
  couponOfferLabel,
  groupRows,
  isMarketingMessage,
  makeCouponCode,
  resolveRange,
  scheduleDue,
  TEMPLATES,
  toCsv,
  triggerDef,
  zonedDayStartUtc,
  type LocalNow,
} from "./catalog.ts";

const at = (ymd: string, hour: number, minute = 0, weekday?: number): LocalNow => ({
  year: Number(ymd.slice(0, 4)),
  month: Number(ymd.slice(5, 7)),
  day: Number(ymd.slice(8, 10)),
  hour,
  minute,
  weekday: weekday ?? new Date(`${ymd}T12:00:00Z`).getUTCDay(),
});

describe("scheduleDue", () => {
  it("daily: due once after the time", () => {
    expect(scheduleDue({ frequency: "daily", time: "07:00" }, at("2026-10-12", 6, 59), null)).toBe(false);
    expect(scheduleDue({ frequency: "daily", time: "07:00" }, at("2026-10-12", 7, 0), null)).toBe(true);
    expect(scheduleDue({ frequency: "daily", time: "07:00" }, at("2026-10-12", 9, 0), "2026-10-12")).toBe(false);
    expect(scheduleDue({ frequency: "daily", time: "07:00" }, at("2026-10-13", 9, 0), "2026-10-12")).toBe(true);
  });
  it("weekly: only on the weekday", () => {
    // 2026-10-12 is a Monday
    expect(scheduleDue({ frequency: "weekly", weekday: 1, time: "08:00" }, at("2026-10-12", 8, 15), null)).toBe(true);
    expect(scheduleDue({ frequency: "weekly", weekday: 1, time: "08:00" }, at("2026-10-13", 8, 15), null)).toBe(false);
  });
  it("monthly: day 31 means the last day", () => {
    expect(scheduleDue({ frequency: "monthly", monthday: 31, time: "08:00" }, at("2026-02-28", 9), null)).toBe(true);
    expect(scheduleDue({ frequency: "monthly", monthday: 31, time: "08:00" }, at("2026-02-27", 9), null)).toBe(false);
  });
  it("pay period: the day a new period starts", () => {
    const pay = { anchor: "2026-10-05", cadenceWeeks: 2 };
    expect(scheduleDue({ frequency: "pay_period", time: "08:00" }, at("2026-10-19", 9), null, { kind: "schedule", pay })).toBe(true);
    expect(scheduleDue({ frequency: "pay_period", time: "08:00" }, at("2026-10-12", 9), null, { kind: "schedule", pay })).toBe(false);
  });
  it("daily-kind triggers ignore frequency", () => {
    expect(scheduleDue({ frequency: "weekly", weekday: 3, time: "09:00" }, at("2026-10-12", 9), null, { kind: "daily" })).toBe(true);
  });
});

describe("resolveRange", () => {
  it("weeks start Monday", () => {
    // Wednesday 2026-10-14
    expect(resolveRange("this_week", "2026-10-14")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(resolveRange("last_week", "2026-10-14")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });
  it("months", () => {
    expect(resolveRange("last_month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(resolveRange("this_month", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("last pay period", () => {
    expect(resolveRange("last_pay_period", "2026-10-21", { anchor: "2026-10-05", cadenceWeeks: 2 })).toEqual({ from: "2026-10-05", to: "2026-10-18" });
  });
  it("all", () => {
    expect(resolveRange("all", "2026-10-21")).toEqual({ from: null, to: null });
  });
});

describe("conditionsMatch", () => {
  it("matches species and amount", () => {
    expect(conditionsMatch([{ field: "species", op: "in", value: ["dog"] }], { species: "dog" })).toBe(true);
    expect(conditionsMatch([{ field: "species", op: "in", value: ["cat"] }], { species: "dog" })).toBe(false);
    expect(conditionsMatch([{ field: "min_amount", op: "gte", value: 100 }], { amount: 120 })).toBe(true);
    expect(conditionsMatch([{ field: "min_amount", op: "gte", value: 100 }], { amount: 80 })).toBe(false);
  });
  it("missing facts never match", () => {
    expect(conditionsMatch([{ field: "staff_id", op: "in", value: ["s1"] }], {})).toBe(false);
  });
  it("no conditions always matches", () => {
    expect(conditionsMatch([], {})).toBe(true);
    expect(conditionsMatch(null, {})).toBe(true);
  });
});

describe("coupons", () => {
  const lines = [
    { type: "service" as const, reference_id: "bath", unit_price: 3000, line_total: 3000 },
    { type: "product" as const, reference_id: "p1", unit_price: 1500, line_total: 3000 },
  ];
  it("percent and amount", () => {
    expect(couponDiscountCents({ kind: "percent", value: 10 }, lines)).toBe(600);
    expect(couponDiscountCents({ kind: "amount", value: 5 }, lines)).toBe(500);
    expect(couponDiscountCents({ kind: "amount", value: 500 }, lines)).toBe(6000); // never above subtotal
  });
  it("free service / product: one unit", () => {
    expect(couponDiscountCents({ kind: "free_service", value: null, service_id: "bath" }, lines)).toBe(3000);
    expect(couponDiscountCents({ kind: "free_product", value: null, product_id: "p1" }, lines)).toBe(1500);
    expect(couponDiscountCents({ kind: "free_service", value: null, service_id: "cut" }, lines)).toBe(0);
  });
  it("codes are readable and unique-ish", () => {
    const code = makeCouponCode("Luna Ñ");
    expect(code).toMatch(/^LUNAN-[A-HJ-NP-Z2-9]{6}$/);
    expect(makeCouponCode("")).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
  it("labels", () => {
    expect(couponOfferLabel({ kind: "percent", value: 10 })).toBe("10% de descuento");
    expect(couponOfferLabel({ kind: "amount", value: 5 }, "en")).toBe("$5 off");
    expect(couponOfferLabel({ kind: "free_service", value: null, service_name: "Baño" })).toBe("Baño gratis");
  });
});

describe("reports", () => {
  it("groups and totals", () => {
    const rows = [
      { staff: "Ana", total: 10, tip: 1 },
      { staff: "Ana", total: 5.5, tip: 0 },
      { staff: "Beto", total: 20, tip: 2 },
    ];
    const out = groupRows(rows, ["staff", "total", "tip"], "staff", new Set(["total", "tip"]));
    expect(out).toEqual([
      { staff: "Ana", count: 2, total: 15.5, tip: 1 },
      { staff: "Beto", count: 1, total: 20, tip: 2 },
      { staff: "TOTAL", count: 3, total: 35.5, tip: 3 },
    ]);
  });
  it("csv escapes and guards formulas", () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: "x,y" }, { a: -5, b: "ok" }], ["a", "b"], { a: "A", b: "B" });
    expect(csv).toBe('﻿A,B\r\n"\'=HYPERLINK(""x"")","x,y"\r\n-5,ok');
  });
});

describe("catalog consistency", () => {
  it("every template uses a known trigger and an allowed action", () => {
    for (const t of TEMPLATES) {
      expect(triggerDef(t.trigger_type), t.key).toBeTruthy();
      expect(actionsForTrigger(t.trigger_type), t.key).toContain(t.action_type);
    }
  });
  it("coupons make a message promotional", () => {
    expect(isMarketingMessage("appointment_status", false)).toBe(false);
    expect(isMarketingMessage("appointment_status", true)).toBe(true);
    expect(isMarketingMessage("pet_birthday", false)).toBe(true);
  });
  it("zoned day start (Puerto Rico is UTC-4)", () => {
    expect(zonedDayStartUtc("2026-10-12", "America/Puerto_Rico")).toBe("2026-10-12T04:00:00.000Z");
  });
});
