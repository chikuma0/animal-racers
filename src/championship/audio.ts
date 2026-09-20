/** Original synthesized score and foley. No downloaded samples or autoplay dependency. */
export class ChampionshipAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private capture: MediaStreamAudioDestinationNode | null = null;
  private strings = new Map<number, AudioBuffer>();
  private muted = false;
  private nextNote = 0;
  private beat = 0;
  private lastEvent = 0;
  private lastStep = 0;
  async unlock() {
    try {
      this.ctx ??= new AudioContext();
      if (!this.master) {
        this.master = this.ctx.createGain();
        this.capture = this.ctx.createMediaStreamDestination();
        this.master.connect(this.ctx.destination);
        this.master.connect(this.capture);
      }
      this.master.gain.value = this.muted ? 0 : 0.22;
      await this.ctx.resume();
      return this.ctx.state === "running";
    } catch {
      return false;
    }
  }
  recordingTrack() {
    return this.capture?.stream.getAudioTracks()[0]?.clone();
  }
  /** Damped vibrating string; original procedural guitar, cached by pitch. */
  private pluck(frequency: number, volume = 0.18, delay = 0) {
    if (!this.ctx || !this.master) return;
    let buffer = this.strings.get(frequency);
    if (!buffer) {
      const count = Math.floor(this.ctx.sampleRate * 1.25),
        period = Math.round(this.ctx.sampleRate / frequency);
      buffer = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < period; i++)
        data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / period);
      for (let i = period; i < count; i++)
        data[i] = 0.496 * (data[i - period] + data[i - period + 1]);
      this.strings.set(frequency, buffer);
    }
    const voice = this.ctx.createBufferSource(),
      gain = this.ctx.createGain();
    voice.buffer = buffer;
    gain.gain.value = volume;
    voice.connect(gain).connect(this.master);
    voice.start(this.ctx.currentTime + delay);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
    };
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.22,
        this.ctx.currentTime,
        0.05,
      );
  }
  private tone(
    freq: number,
    length: number,
    type: OscillatorType = "triangle",
    vol = 0.25,
    slide = 1,
    delay = 0,
  ) {
    if (!this.ctx || !this.master || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime + delay,
      osc = this.ctx.createOscillator(),
      gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq * slide),
      t + length,
    );
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + length + 0.01);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  private noise(length: number, volume: number, frequency: number) {
    if (!this.ctx || !this.master) return;
    const n = Math.round(this.ctx.sampleRate * length),
      buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  update(
    phase: string,
    speed: number,
    events: { id: number; type: string; slot?: number }[],
    time: number,
    characters: readonly string[] = [],
  ) {
    if (!this.ctx || this.ctx.state !== "running" || this.muted) {
      this.lastEvent = Math.max(this.lastEvent, ...events.map((e) => e.id));
      return;
    }
    if (time > this.nextNote) {
      const notes =
        phase === "fight"
          ? [
              110, 0, 164.81, 110, 130.81, 0, 164.81, 0, 98, 0, 146.83, 98,
              123.47, 0, 146.83, 0,
            ]
          : [
              146.83, 0, 220, 0, 261.63, 220, 196, 0, 130.81, 0, 196, 0, 246.94,
              196, 164.81, 0, 110, 0, 164.81, 0, 220, 196, 164.81, 0, 146.83, 0,
              220, 0, 293.66, 0, 0, 0,
            ];
      const f = notes[this.beat++ % notes.length];
      if (f) {
        this.pluck(f, 0.26);
        if (this.beat % 8 === 1) {
          this.pluck(f / 2, 0.22);
          this.pluck(f * 1.5, 0.1, 0.035);
        }
        if (this.beat % 16 === 13)
          this.tone(f * 2, 0.55, "sine", 0.075, 0.985, 0.025);
      }
      this.nextNote = time + (phase === "fight" ? 0.24 : 0.3);
    }
    if (
      phase === "race" &&
      speed > 2 &&
      time - this.lastStep > Math.max(0.11, 0.3 - speed * 0.007)
    ) {
      this.noise(0.055, 0.1, 400);
      this.tone(75, 0.055, "sine", 0.18, 0.5);
      this.lastStep = time;
    }
    for (const e of events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (e.type === "hit") {
        this.noise(0.13, 0.8, 1300);
        this.tone(125, 0.12, "triangle", 0.6, 0.45);
      } else if (e.type === "jump") this.tone(190, 0.13, "sine", 0.15, 1.8);
      else if (e.type === "special") {
        const species = characters[e.slot ?? 0];
        if (species === "lion") {
          this.noise(0.30, 0.22, 740);
          this.tone(90, 0.30, "sawtooth", 0.08, 0.7);
        } else if (species === "wolf") {
          this.noise(0.24, 0.12, 3400);
          this.tone(250, 0.25, "sine", 0.10, 1.3);
          this.tone(500, 0.20, "sine", 0.04, 1.3);
        } else {
          [440, 660, 880].forEach((f, i) =>
            this.tone(f, 0.4, "sine", 0.14, 1, i * 0.04),
          );
        }
      } else if (e.type === "evade") {
        this.noise(.16, .12, 2700);
      } else if (e.type === "evade-success") {
        this.tone(590, .1, "sine", .19, 1.2);
        this.tone(880, .14, "sine", .14, 1, .05);
      } else if (e.type === "pass") {
        this.pluck(293.66, .28);
        this.pluck(440, .22, .08);
      } else if (e.type === "draft-start") {
        this.noise(.22, .1, 1700);
      } else if (e.type === "draft-ready" || e.type === "boost") {
        this.noise(0.28, 0.16, 1100);
        this.tone(120, 0.28, "sine", 0.12, 1.8);
      } else if (e.type === "block")
        this.tone(430, 0.12, "triangle", 0.25, 0.8);
      else if (e.type === "land") {
        this.noise(0.08, 0.15, 550);
        this.tone(65, 0.09, "sine", 0.2, 0.65);
      } else if (e.type === "guard-break") {
        this.noise(0.14, 0.45, 2000);
        this.tone(280, 0.22, "triangle", 0.25, 0.4);
      } else if (e.type === "finish" || e.type === "results") {
        [146.83, 196, 220, 293.66].forEach((f, i) =>
          this.tone(f, 0.45, "triangle", 0.3, 1, i * 0.12),
        );
      } else if (e.type === "stumble" || e.type === "obstacle") {
        this.noise(0.22, 0.35, 800);
        this.tone(90, 0.2, "triangle", 0.2, 0.5);
      }
    }
  }
  reset() {
    this.lastEvent = 0;
    this.nextNote = 0;
    this.beat = 0;
  }
  dispose() {
    this.capture?.stream.getTracks().forEach((track) => track.stop());
    this.strings.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.capture = null;
  }
}
