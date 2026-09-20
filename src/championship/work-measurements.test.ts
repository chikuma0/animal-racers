import { describe, expect, it } from "vitest";
import { WorkMeasurements, WORK_STAGES } from "./work-measurements";

describe("stage timing evidence", () => {
  it("retains zero-cost samples, long stalls and distinct visibility without conflating GPU work", () => {
    const m = new WorkMeasurements();
    for (let i = 0; i < 99; i++) m.add("race", false, { simulation: 0, renderCall: 2 });
    m.add("race", false, { simulation: 0, renderCall: 1723.28 });
    m.add("race", true, { renderCall: 5100 });
    const r = m.report();
    expect(r.stages.simulation.phases["race/visible"]).toMatchObject({ samples: 100, p50Ms: 0, maxMs: 0 });
    expect(r.stages.renderCall.phases["race/visible"]).toMatchObject({ samples: 100, p95Ms: 2, maxMs: 1723.28, over50: 1 });
    expect(r.stages.renderCall.phases["race/hidden"].maxMs).toBe(5100);
    expect(r.note).toContain("exclude asynchronous GPU completion");
  });
  it("rejects invalid times and unexpected labels, retaining bounded aggregates across long sessions", () => {
    const m = new WorkMeasurements();
    m.add("unknown", false, { callback: 1 });
    m.add("fight", false, { callback: NaN, simulation: -1, presentation: Infinity });
    expect(m.report().stages).toEqual({});
    for (let i = 0; i < 120000; i++) m.add("fight", false, { callback: 8, renderCall: 6 });
    expect(Object.keys(m.report().stages)).toHaveLength(2);
    expect(m.report().stages.callback.phases["fight/visible"]).toMatchObject({ samples: 120000, elapsedMs: 960000, p99Ms: 8 });
    const internal = m as unknown as { stages: Map<string, { phases: Map<string, { bins: Uint32Array }> }> };
    expect(internal.stages.size).toBeLessThanOrEqual(WORK_STAGES.length);
    for (const stage of internal.stages.values()) {
      expect(stage.phases.size).toBeLessThanOrEqual(12);
      for (const phase of stage.phases.values()) expect(phase.bins.length).toBe(4001);
    }
  });
});
