/** Fixed-memory frame histograms. Delays are recorded raw, never simulation-clamped. */
export class FrameMeasurements {
  private phases = new Map<
    string,
    {
      bins: Uint32Array;
      samples: number;
      elapsedMs: number;
      maxMs: number;
      over16: number;
      over33: number;
      over50: number;
    }
  >();
  readonly startedAt = new Date().toISOString();
  add(phase: string, ms: number) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    let row = this.phases.get(phase);
    if (!row) {
      row = {
        bins: new Uint32Array(4001),
        samples: 0,
        elapsedMs: 0,
        maxMs: 0,
        over16: 0,
        over33: 0,
        over50: 0,
      };
      this.phases.set(phase, row);
    }
    row.bins[Math.min(4000, Math.ceil(ms * 4))]++;
    row.samples++;
    row.elapsedMs += ms;
    row.maxMs = Math.max(row.maxMs, ms);
    if (ms > 16.67) row.over16++;
    if (ms > 33.34) row.over33++;
    if (ms > 50) row.over50++;
  }
  report() {
    return {
      startedAt: this.startedAt,
      quantileResolutionMs: 0.25,
      overflowAtMs: 1000,
      phases: Object.fromEntries(
        [...this.phases].map(([phase, row]) => {
          const q = (p: number) => {
            const target = Math.max(1, Math.ceil(row.samples * p));
            let n = 0;
            for (let i = 0; i < row.bins.length; i++) {
              n += row.bins[i];
              if (n >= target) return i === 4000 ? row.maxMs : i / 4;
            }
            return 0;
          };
          return [
            phase,
            {
              samples: row.samples,
              elapsedMs: Math.round(row.elapsedMs),
              p50Ms: q(0.5),
              p95Ms: q(0.95),
              p99Ms: q(0.99),
              maxMs: Math.round(row.maxMs * 100) / 100,
              over16_67: row.over16,
              over33_34: row.over33,
              over50: row.over50,
            },
          ];
        }),
      ),
    };
  }
}
