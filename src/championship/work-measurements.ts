import { FrameMeasurements } from "./measurements";

const PHASES = ["select", "countdown", "race", "transition", "fight", "results"];
export const WORK_STAGES = [
  "simulation", "networkSend", "presentation", "renderCall", "audioAndUi",
  "callback", "betweenCallbacks", "sceneUpdate", "drawSubmission",
] as const;
type Stage = (typeof WORK_STAGES)[number];

/** Wall-clock durations, not CPU utilization or completed GPU execution time. */
export class WorkMeasurements {
  private stages = new Map<Stage, FrameMeasurements>();
  add(phase: string, hidden: boolean, values: Partial<Record<Stage, number>>) {
    if (!PHASES.includes(phase)) return;
    const key = `${phase}/${hidden ? "hidden" : "visible"}`;
    for (const stage of WORK_STAGES) {
      const ms = values[stage];
      if (ms === undefined || !Number.isFinite(ms) || ms < 0) continue;
      let measurements = this.stages.get(stage);
      if (!measurements) {
        measurements = new FrameMeasurements(true);
        this.stages.set(stage, measurements);
      }
      measurements.add(key, ms);
    }
  }
  report() {
    return {
      clock: "performance.now wall-clock milliseconds",
      note: "Zero-duration calls are retained. Render and draw submission include synchronous driver work but exclude asynchronous GPU completion. Between-callback time includes refresh pacing and other unmeasured browser/OS work; it does not identify a cause. React work scheduled after the callback is outside audioAndUi. Hidden samples are separate. Stage quantiles cannot be added.",
      stages: Object.fromEntries([...this.stages].map(([stage, m]) => [stage, m.report()])),
    };
  }
}
