import { describe, expect, it } from "vitest";
import { breakdown, factsOf, ratesOf, repeatPatterns, tallyOf } from "./statsEngine";
import type { StatRecord } from "../types";

let counter = 0;
// A record with sensible defaults. Each test changes only what it cares about.
function rec(over: Partial<StatRecord> = {}): StatRecord {
  counter += 1;
  return {
    id: `a-${counter}`,
    date: "2026-10-04",
    kind: "own",
    status: "present",
    personId: 1,
    personName: "Teacher 01",
    subject: "Math",
    excusedId: null,
    excusedName: null,
    excusedSubject: null,
    stage: "Elementary",
    type: "break",
    place: "Soccer Field",
    day: 0,
    start: "12:35",
    end: "13:05",
    hours: 0.5,
    byName: "Supervisor 01",
    ...over,
  };
}

describe("outcomes and rates", () => {
  it("counts on time, late and absent separately, and the rates add up to 100", () => {
    const records = [
      rec({ status: "present" }), rec({ status: "present" }), rec({ status: "present" }),
      rec({ status: "late" }),
      rec({ status: "absent" }),
    ];
    const t = tallyOf(factsOf(records));
    expect(t.onTime).toBe(3);
    expect(t.late).toBe(1);
    expect(t.absent).toBe(1);
    expect(t.marked).toBe(5);
    expect(t.attended).toBe(4);
    const r = ratesOf(t);
    expect(r.onTime).toBe(60);
    expect(r.late).toBe(20);
    expect(r.absent).toBe(20);
    expect(r.onTime + r.late + r.absent).toBe(100);
    expect(r.attended).toBe(80);
  });

  it("counts hours only when the person was on time or late", () => {
    const t = tallyOf(factsOf([rec({ status: "present" }), rec({ status: "late" }), rec({ status: "absent" })]));
    expect(t.hours).toBe(1);
  });

  it("does not divide by zero when nothing is marked", () => {
    expect(ratesOf(tallyOf([])).onTime).toBe(0);
  });
});

describe("substitutions", () => {
  const sub = rec({ kind: "substitute", status: "present", personId: 2, personName: "Teacher 02", excusedId: 1, excusedName: "Teacher 01" });

  it("excused is not absent and is not in the rates", () => {
    const t = tallyOf(factsOf([sub]), 1);
    expect(t.excused).toBe(1);
    expect(t.absent).toBe(0);
    expect(t.marked).toBe(0);
  });

  it("counts the duty and the hours for the substitute", () => {
    const t = tallyOf(factsOf([sub]), 2);
    expect(t.covered).toBe(1);
    expect(t.onTime).toBe(1);
    expect(t.hours).toBe(0.5);
  });

  it("counts an unmarked substitution as covered but not marked", () => {
    const t = tallyOf(factsOf([rec({ kind: "substitute", status: "unmarked", personId: 2, excusedId: 1 })]), 2);
    expect(t.covered).toBe(1);
    expect(t.marked).toBe(0);
  });
});

describe("breakdown", () => {
  it("splits the facts by stage", () => {
    const facts = factsOf([rec({ stage: "Elementary" }), rec({ stage: "Elementary" }), rec({ stage: "Foundation" })]);
    const slices = breakdown(facts, "stage");
    expect(slices.find((s) => s.key === "Elementary")?.tally.marked).toBe(2);
    expect(slices.find((s) => s.key === "Foundation")?.tally.marked).toBe(1);
  });
});

describe("repeated behaviour", () => {
  const absentOn = (date: string, status: StatRecord["status"] = "absent") => rec({ date, status });

  it("finds a teacher who is absent again and again on the same duty", () => {
    const facts = factsOf([absentOn("2026-10-04"), absentOn("2026-10-11"), absentOn("2026-10-18")]);
    const [p] = repeatPatterns(facts, "slot");
    expect(p?.kind).toBe("absent");
    expect(p?.count).toBe(3);
    expect(p?.total).toBe(3);
    expect(p?.streak).toBe(3);
  });

  it("a day on time breaks the streak", () => {
    const facts = factsOf([absentOn("2026-10-04"), absentOn("2026-10-11"), absentOn("2026-10-18", "present"), absentOn("2026-10-25")]);
    const [p] = repeatPatterns(facts, "slot");
    expect(p?.count).toBe(3);
    expect(p?.streak).toBe(2);
    expect(p?.share).toBe(75);
  });

  it("needs at least the minimum number of times", () => {
    const facts = factsOf([absentOn("2026-10-04")]);
    expect(repeatPatterns(facts, "slot")).toHaveLength(0);
    expect(repeatPatterns(facts, "slot", { minCount: 1 })).toHaveLength(1);
  });

  it("ignores duties done as a substitute", () => {
    const facts = factsOf([
      rec({ kind: "substitute", status: "late", personId: 2, date: "2026-10-04" }),
      rec({ kind: "substitute", status: "late", personId: 2, date: "2026-10-11" }),
    ]);
    expect(repeatPatterns(facts, "slot")).toHaveLength(0);
  });

  it("finds a weekday habit across different duties", () => {
    const facts = factsOf([
      rec({ status: "late", day: 0, type: "snack", date: "2026-10-04" }),
      rec({ status: "late", day: 0, type: "break", date: "2026-10-11" }),
    ]);
    expect(repeatPatterns(facts, "slot")).toHaveLength(0);
    expect(repeatPatterns(facts, "day")).toHaveLength(1);
  });
});