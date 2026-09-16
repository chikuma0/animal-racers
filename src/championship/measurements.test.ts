import { describe, it, expect } from "vitest";
import { FrameMeasurements } from "./measurements";
describe("frame evidence", () => {
  it("keeps stalls and separates phases without clipping to simulation delta", () => {
    const m = new FrameMeasurements();
    for (let i = 0; i < 99; i++) m.add("race", 16.6);
    m.add("race", 1450.28);
    m.add("fight", 33.8);
    const r = m.report();
    expect(r.phases.race).toMatchObject({
      samples: 100,
      p50Ms: 16.75,
      p95Ms: 16.75,
      p99Ms: 16.75,
      maxMs: 1450.28,
      over33_34: 1,
      over50: 1,
    });
    expect(r.phases.fight.samples).toBe(1);
    expect(r.phases.race.elapsedMs).toBe(3094);
  });
  it("rejects invalid values and retains sustained-session counts beyond rolling window", () => {
    const m = new FrameMeasurements();
    m.add("race", NaN);
    m.add("race", 0);
    for (let i = 0; i < 120000; i++) m.add("race", 20);
    expect(m.report().phases.race).toMatchObject({
      samples: 120000,
      elapsedMs: 2400000,
      p95Ms: 20,
      over16_67: 120000,
      over33_34: 0,
    });
  });
});
