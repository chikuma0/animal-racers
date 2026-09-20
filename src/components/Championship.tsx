"use client";
import { PresentationBuffer } from "@/championship/presentation";
import { GuestPrediction } from "@/championship/prediction";
import { WorkMeasurements } from "@/championship/work-measurements";
import { InputControls } from "@/championship/controls";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChampionshipRenderer,
  type FrameReport,
} from "@/championship/renderer";
import {
  InputSender,
  InputReceiver,
  isInputPacket,
} from "@/championship/input-buffer";
import { ChampionshipAudio } from "@/championship/audio";
import { ChampionshipGuide } from "@/championship/guide";
import { ROSTER, CHARACTER_IDS } from "@/championship/content";
import {
  createMatch,
  stepMatch,
  scoreMatch,
  cpuInput,
  neutralInput,
  COURSE_LENGTH,
  FIGHT_DURATION,
  ATTACKS,
  RACE,
  type CharacterId,
  type Match,
  type Input,
} from "@/championship/simulation";
import {
  ChampionshipNetwork,
  generateInviteCode,
} from "@/championship/network";

type Mode = "solo" | "host" | "guest";
type Screen = "select" | "intro" | "lobby" | "play";
type Lobby = { character: CharacterId; ready: boolean; name: string };
const validCharacter = (v: unknown): v is CharacterId =>
  typeof v === "string" && CHARACTER_IDS.includes(v as CharacterId);
const validInput = (v: unknown): v is Input => {
  if (!v || typeof v !== "object") return false;
  const a = v as Input;
  return (
    Number.isFinite(a.move) &&
    Math.abs(a.move) <= 1 &&
    ["jump", "attack", "special", "guard"].every(
      (k) => typeof a[k as keyof Input] === "boolean",
    )
  );
};
function isSnapshot(value: unknown): value is Match {
  if (!value || typeof value !== "object") return false;
  const m = value as Match;
  return (
    Number.isSafeInteger(m.tick) &&
    m.tick >= 0 &&
    ["countdown", "race", "transition", "fight", "results"].includes(m.phase) &&
    Number.isFinite(m.phaseTime) &&
    Array.isArray(m.players) &&
    m.players.length === 2 &&
    m.players.every(
      (p) =>
        validCharacter(p.character) &&
        [p.x, p.y, p.z, p.hp, p.speed, p.draft, p.dodgeCooldown, p.counterWindow, p.strikeWindup].every(Number.isFinite) &&
        p.strikeWindup > 0 && typeof p.drafting === "boolean" && typeof p.action === "string",
    ) &&
    Array.isArray(m.events) &&
    m.events.length < 128
  );
}
const formatTime = (s: number | null) =>
  s === null ? "DNF" : `${s.toFixed(2)}s`;

export default function Championship() {
  const presentation = useRef(new PresentationBuffer());
  const prediction = useRef(new GuestPrediction(1));
  const workMeasurements = useRef(new WorkMeasurements());
  const controls = useRef(new InputControls());
  const playTrace = useRef<{ lastId: number; events: { tick: number; phase: string; phaseTime: number; type: string; slot: number; x: number; z: number }[] }>({ lastId: 0, events: [] });
  const inputSender = useRef(new InputSender()),
    localReceiver = useRef(new InputReceiver()),
    remoteReceiver = useRef(new InputReceiver()),
    connecting = useRef(false),
    rematchPending = useRef(false),
    peerRematch = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null),
    recordedChunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false),
    [interrupted, setInterrupted] = useState(false),
    [rematchWaiting, setRematchWaiting] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    resultsPanel = useRef<HTMLElement>(null),
    renderer = useRef<ChampionshipRenderer | null>(null),
    audio = useRef<ChampionshipAudio | null>(null),
    network = useRef<ChampionshipNetwork | null>(null),
    match = useRef<Match | null>(null),
    input = useRef<Input>(neutralInput()),
    remoteInput = useRef<Input>(neutralInput()),
    modeRef = useRef<Mode>("solo"),
    screenRef = useRef<Screen>("select"),
    selectedRef = useRef<CharacterId>("lion"),
    readyRef = useRef(false),
    peerRef = useRef<Lobby | null>(null),
    epoch = useRef(""),
    lastSnapshot = useRef(0),
    lastInput = useRef(0),
    localSeq = useRef(0),
    remoteSeq = useRef(-1),
    latestTick = useRef(-1),
    connected = useRef(false),
    lastNetworkStatus = useRef("");
  const [screen, setScreen] = useState<Screen>("select"),
    [selected, setSelected] = useState<CharacterId>("lion"),
    [mode, setMode] = useState<Mode>("solo"),
    [rival, setRival] = useState<CharacterId>("wolf"),
    [code, setCode] = useState(""),
    [joinCode, setJoinCode] = useState(""),
    [peer, setPeer] = useState<Lobby | null>(null),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [muted, setMuted] = useState(false),
    [audioStatus, setAudioStatus] = useState(""),
    [report, setReport] = useState<FrameReport | null>(null),
    [showReport, setShowReport] = useState(false),
    [view, setView] = useState<Match | null>(null),
    [rotate, setRotate] = useState(false),
    [copied, setCopied] = useState(false);
  const setPage = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  }, []);
  const localSlot = mode === "guest" ? 1 : 0;
  const publishControls = useCallback(() => {
    const previousInput = input.current;
    input.current = controls.current.value();
    inputSender.current.update(input.current, match.current?.tick ?? 0);
    if (modeRef.current === "guest") {
      const visualInput = { ...input.current };
      if (match.current?.phase === "race") visualInput.move *= -1;
      prediction.current.updateInput(visualInput, performance.now());
      const changed = (Object.keys(input.current) as (keyof Input)[]).some(key => input.current[key] !== previousInput[key]);
      if (changed && connected.current && screenRef.current === "play" && match.current) {
        network.current?.send("input", {
          epoch: epoch.current, seq: ++localSeq.current,
          packet: inputSender.current.packet(match.current.tick), rematch: rematchPending.current,
        });
      }
    }
  }, []);
  useEffect(() => {
    const panel = resultsPanel.current, surface = canvas.current;
    if (screen !== "play" || view?.phase !== "results" || !panel || !surface) {
      renderer.current?.setResultsPanel(null);
      return;
    }
    const measure = () => {
      const card = panel.getBoundingClientRect(), stage = surface.getBoundingClientRect();
      renderer.current?.setResultsPanel({
        left: card.left - stage.left, top: card.top - stage.top,
        width: card.width, height: card.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel); observer.observe(surface);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect(); window.removeEventListener("resize", measure);
      renderer.current?.setResultsPanel(null);
    };
  }, [screen, view?.phase]);
  const begin = useCallback(
    (characters: [CharacterId, CharacterId], newEpoch: string) => {
      match.current = createMatch(characters, 6827);
      epoch.current = newEpoch;
      prediction.current.reset(newEpoch);
      playTrace.current = { lastId: 0, events: [] };
      latestTick.current = -1;
      presentation.current.clear();
      remoteSeq.current = -1;
      inputSender.current.reset();
      controls.current.clear();
      localReceiver.current.reset();
      remoteReceiver.current.reset();
      rematchPending.current = false;
      peerRematch.current = false;
      setRematchWaiting(false);
      setInterrupted(false);
      setStatus("");
      input.current = neutralInput();
      remoteInput.current = neutralInput();
      lastSnapshot.current = performance.now();
      lastInput.current = performance.now();
      audio.current?.reset();
      setView(structuredClone(match.current));
      setPage("play");
    },
    [setPage],
  );
  const leave = useCallback(() => {
    void network.current?.disconnect();
    network.current = null;
    match.current = null;
    setView(null);
    connected.current = false;
    readyRef.current = false;
    setReady(false);
    peerRef.current = null;
    setPeer(null);
    input.current = neutralInput();
    controls.current.clear();
    prediction.current.disconnect();
    setPage("select");
    setStatus("");
    setError("");
    setInterrupted(false);
    setRematchWaiting(false);
    rematchPending.current = false;
    void renderer.current?.setCharacters([selectedRef.current, rival]);
  }, [rival, setPage]);
  useEffect(() => {
    if (!canvas.current) return;
    let alive = true;
    try {
      const r = new ChampionshipRenderer(canvas.current);
      renderer.current = r;
      audio.current = new ChampionshipAudio();
      r.load()
        .then(() => {
          if (alive) setLoaded(true);
        })
        .catch((e) => {
          if (alive)
            setError(
              `The 3D assets could not load. Please reload to retry. ${e instanceof Error ? e.message : ""}`,
            );
        });
    } catch {
      setError(
        "This browser could not start 3D graphics. Use a current Safari or Chrome with WebGL enabled.",
      );
    }
    let frame = 0,
      previous = performance.now(),
      accumulator = 0,
      lastUI = 0,
      lastSend = 0,
      lastUrgentEvent = 0,
      sentEpoch = "",
      previousCallbackEnd = 0;
    const animate = (now: number) => {
      if (!alive) return;
      const callbackStart = performance.now();
      const realDt = (now - previous) / 1000;
      previous = now;
      const dt = Math.min(realDt, 0.1);
      accumulator = Math.min(accumulator + dt, 0.15);
      const m = match.current,
        net = network.current;
      const solo = modeRef.current === "solo",
        host = modeRef.current === "host";
      if (m && screenRef.current === "play" && m.phase !== "results") {
        if (
          !solo &&
          connected.current &&
          ((host && now - lastInput.current > 8000) ||
            (!host && now - lastSnapshot.current > 8000))
        ) {
          setStatus(
            "Connection interrupted. This match has no verified result.",
          );
          setInterrupted(true);
          connected.current = false;
        }
        while (accumulator >= 1 / 60) {
          localReceiver.current.accept(inputSender.current.packet(m.tick), m.tick);
          const local = localReceiver.current.tick(m.tick);
          if (m.phase === "race") local.move *= -1;
          if (solo) stepMatch(m, [local, cpuInput(m, 1)], 1 / 60);
          else if (host && connected.current) {
            remoteInput.current =
              now - lastInput.current > 500
                ? neutralInput()
                : remoteReceiver.current.tick(m.tick);
            const remote = { ...remoteInput.current };
            if (m.phase === "race") remote.move *= -1;
            stepMatch(m, [local, remote], 1 / 60);
          }
          accumulator -= 1 / 60;
        }
      } else accumulator = 0;
      if (m) {
        for (const event of m.events) {
          if (event.id <= playTrace.current.lastId) continue;
          playTrace.current.lastId = event.id;
          playTrace.current.events.push({ tick: m.tick, phase: m.phase, phaseTime: m.phaseTime,
            type: event.type, slot: event.slot, x: event.x, z: event.z });
        }
        if (playTrace.current.events.length > 256) playTrace.current.events.splice(0, playTrace.current.events.length - 256);
      }
      const simulationEnd = performance.now();
      if (sentEpoch !== epoch.current) { sentEpoch = epoch.current; lastUrgentEvent = 0; }
      const urgentSnapshot = host && Boolean(m?.events.some(event => event.id > lastUrgentEvent
        && ["attack", "counter", "evade", "hit", "fight", "transition", "results"].includes(event.type)));
      if (
        net &&
        connected.current &&
        (urgentSnapshot || now - lastSend >= 1000 / (net.sendHz ?? 10))
      ) {
        lastSend = now;
        if (screenRef.current === "lobby") {
          net.send("lobby", {
            character: selectedRef.current,
            ready: readyRef.current,
            name: host ? "Trailblazer" : "Challenger",
          });
          if (host && readyRef.current && peerRef.current?.ready) {
            begin(
              [selectedRef.current, peerRef.current.character],
              crypto.randomUUID(),
            );
          }
        }
        if (match.current && screenRef.current === "play") {
          if (host) {
            lastUrgentEvent = match.current.eventSequence;
            net.send("snapshot", {
              epoch: epoch.current,
              match: match.current,
              input: input.current,
              rematch: rematchPending.current,
            });
            if (
              match.current.phase === "results" &&
              rematchPending.current &&
              peerRematch.current
            )
              begin(
                [
                  match.current.players[0].character,
                  match.current.players[1].character,
                ],
                crypto.randomUUID(),
              );
          } else
            net.send("input", {
              epoch: epoch.current,
              seq: ++localSeq.current,
              packet: inputSender.current.packet(match.current.tick),
              rematch: rematchPending.current,
            });
        }
      }
      const networkEnd = performance.now();
      let displayedMatch = modeRef.current === "guest"
          ? (presentation.current.sample(
              now,
              network.current?.transport === "webrtc" ? 50 : 120,
            ) ?? match.current)
          : match.current;
      if (modeRef.current === "guest") {
        if (connected.current && displayedMatch) {
          const visualInput = { ...input.current };
          if (displayedMatch.phase === "race") visualInput.move *= -1;
          const predictionNow = performance.now();
          prediction.current.updateInput(visualInput, predictionNow);
          displayedMatch = prediction.current.sample(displayedMatch, predictionNow);
        } else prediction.current.disconnect();
      }
      const presentationEnd = performance.now();
      renderer.current?.render(
        displayedMatch,
        modeRef.current === "guest" ? 1 : 0,
        dt,
        now / 1000,
        realDt * 1000,
      );
      const renderEnd = performance.now();
      audio.current?.update(
        m?.phase ?? "select",
        m?.players[modeRef.current === "guest" ? 1 : 0].speed ?? 0,
        m?.events ?? [],
        now / 1000,
        m?.players.map((p) => p.character),
      );
      if (now - lastUI > 50) {
        lastUI = now;
        if (match.current) setView(structuredClone(match.current));
        setReport(renderer.current?.report() ?? null);
      }
      frame = requestAnimationFrame(animate);
      const callbackEnd = performance.now();
      workMeasurements.current.add(match.current?.phase ?? "select", document.hidden, {
        simulation: simulationEnd - callbackStart,
        networkSend: networkEnd - simulationEnd,
        presentation: presentationEnd - networkEnd,
        renderCall: renderEnd - presentationEnd,
        audioAndUi: callbackEnd - renderEnd,
        callback: callbackEnd - callbackStart,
        ...(previousCallbackEnd > 0 ? { betweenCallbacks: callbackStart - previousCallbackEnd } : {}),
      });
      previousCallbackEnd = performance.now();
    };
    frame = requestAnimationFrame(animate);
    const keydown = (e: KeyboardEvent) => {
      if (e.isComposing || (e.target as HTMLElement).matches("input,textarea,select,[contenteditable=true]")) return;
      if (["ArrowRight", "ArrowLeft", "ArrowUp", " "].includes(e.key))
        e.preventDefault();
      controls.current.keyDown(e.key);
      publishControls();
    };
    const keyup = (e: KeyboardEvent) => {
      controls.current.keyUp(e.key);
      publishControls();
    };
    const clear = () => {
      controls.current.clear();
      publishControls();
    };
    const releasePointer = (e: PointerEvent) => {
      controls.current.pointerUp(e.pointerId);
      publishControls();
    };
    const visibility = () => {
      clear();
      if (
        document.hidden &&
        modeRef.current !== "solo" &&
        match.current &&
        match.current.phase !== "results"
      ) {
        network.current?.send("away", {});
        connected.current = false;
        setStatus(
          "The match was interrupted in the background. No verified result.",
        );
        setInterrupted(true);
      }
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    window.addEventListener("lostpointercapture", releasePointer);
    document.addEventListener("visibilitychange", visibility);
    const orient = () => setRotate(innerHeight > innerWidth);
    orient();
    window.addEventListener("resize", orient);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
      window.removeEventListener("lostpointercapture", releasePointer);
      window.removeEventListener("resize", orient);
      document.removeEventListener("visibilitychange", visibility);
      renderer.current?.dispose();
      audio.current?.dispose();
      void network.current?.disconnect();
    };
  }, [begin, publishControls]);
  useEffect(() => {
    selectedRef.current = selected;
    renderer.current?.setSelection(selected);
  }, [selected]);
  const unlock = async () => {
    const ok = await audio.current?.unlock();
    if (!ok)
      setAudioStatus("Sound unavailable — all cues are also shown on screen.");
  };
  const connect = async (asHost: boolean) => {
    if (connecting.current) return;
    connecting.current = true;
    setBusy(true);
    await network.current?.disconnect();
    network.current = null;
    setError("");
    setStatus("Connecting to the frontier…");
    const nextMode = asHost ? "host" : "guest";
    modeRef.current = nextMode;
    setMode(nextMode);
    readyRef.current = false;
    setReady(false);
    peerRef.current = null;
    setPeer(null);
    const invite = asHost
      ? generateInviteCode()
      : joinCode.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{10}$/.test(invite)) {
      setError("Enter the full 10-character invitation code from your friend.");
      connecting.current = false;
      setBusy(false);
      return;
    }
    setCode(invite);
    const net = new ChampionshipNetwork();
    network.current = net;
    net.onPresence = (ids) => {
      connected.current = ids.length === 2;
      if (connected.current) {
        lastInput.current = performance.now();
        lastSnapshot.current = performance.now();
        setStatus("Rival connected. Both players can ready up.");
      }
    };
    net.onStatus = (s) => {
      lastNetworkStatus.current = s;
      if (s === "peer-left") {
        connected.current = false;
        readyRef.current = false;
        setReady(false);
        peerRef.current = null;
        setPeer(null);
        if (match.current && match.current.phase !== "results") {
          setInterrupted(true);
          setStatus(
            "Your rival disconnected. This match has no verified result.",
          );
        } else setStatus("Your rival left. Make a new invitation.");
      } else if (["error", "room-full", "room-conflict"].includes(s)) {
        setError(
          s === "room-full"
            ? "This invitation already has two players."
            : `Connection problem (${s}). Return and try a new invitation.`,
        );
      } else if (s === "waiting")
        setStatus(
          asHost
            ? "Share the code. Waiting for your rival."
            : "Looking for your host…",
        );
    };
    net.onMessage = (message) => {
      const data = message.data as Record<string, unknown>;
      if (!data || typeof data !== "object") return;
      if (
        message.type === "lobby" &&
        validCharacter(data.character) &&
        typeof data.ready === "boolean"
      ) {
        const p = {
          character: data.character,
          ready: data.ready,
          name: asHost ? "Challenger" : "Trailblazer",
        };
        peerRef.current = p;
        setPeer(p);
        setRival(p.character);
      }
      if (
        message.type === "snapshot" &&
        !asHost &&
        typeof data.epoch === "string" &&
        isSnapshot(data.match) &&
        validInput(data.input)
      ) {
        if (
          screenRef.current === "lobby" ||
          // All countdown packets may be lost. The admitted host's next valid
          // epoch can already be racing when our requested rematch arrives.
          (data.epoch !== epoch.current && rematchPending.current)
        ) {
          epoch.current = data.epoch;
          prediction.current.reset(data.epoch);
          playTrace.current = { lastId: 0, events: [] };
          latestTick.current = -1;
          presentation.current.clear();
          inputSender.current.reset();
          controls.current.clear();
          input.current = neutralInput();
          remoteReceiver.current.reset();
          localReceiver.current.reset();
          rematchPending.current = false;
          peerRematch.current = false;
          setRematchWaiting(false);
          setStatus("");
          setPage("play");
          audio.current?.reset();
        }
        if (
          data.epoch !== epoch.current ||
          data.match.tick < latestTick.current
        )
          return;
        peerRematch.current = data.rematch === true;
        latestTick.current = data.match.tick;
        match.current = structuredClone(data.match);
        presentation.current.push(data.match, performance.now());
        prediction.current.observe(data.epoch, data.match, performance.now());
        remoteInput.current = data.input;
        lastSnapshot.current = performance.now();
        setView(structuredClone(data.match));
      }
      if (
        message.type === "input" &&
        asHost &&
        data.epoch === epoch.current &&
        Number.isSafeInteger(data.seq) &&
        (data.seq as number) > remoteSeq.current &&
        isInputPacket(data.packet)
      ) {
        remoteSeq.current = data.seq as number;
        remoteReceiver.current.accept(data.packet, match.current?.tick ?? 0);
        peerRematch.current = data.rematch === true;
        lastInput.current = performance.now();
      }
      if (message.type === "away") {
        connected.current = false;
        if (match.current?.phase === "results") return;
        setInterrupted(true);
        setStatus(
          "Your rival left the game. This match has no verified result.",
        );
      }
    };
    try {
      await net.connect(invite, asHost);
      setPage("lobby");
      await unlock();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to join. Please try again.",
      );
      void net.disconnect();
      network.current = null;
    } finally {
      connecting.current = false;
      setBusy(false);
    }
  };
  const solo = async () => {
    modeRef.current = "solo";
    setMode("solo");
    await unlock();
    setPage("intro");
  };
  const rematch = () => {
    if (mode === "solo") {
      begin([selected, rival], crypto.randomUUID());
    } else {
      rematchPending.current = true;
      setRematchWaiting(true);
    }
  };
  const press = (key: keyof Input, value: number | boolean) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      controls.current.pointerDown(e.pointerId, key, value);
      publishControls();
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      controls.current.pointerUp(e.pointerId);
      publishControls();
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      controls.current.pointerUp(e.pointerId);
      publishControls();
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      controls.current.pointerUp(e.pointerId);
      publishControls();
    },
  });
  const isRace = view?.phase === "race" || view?.phase === "countdown";
  const isFight = view?.phase === "fight";
  const p = view?.players[localSlot],
    op = view?.players[localSlot === 0 ? 1 : 0],
    character = ROSTER[selected];
  const racePoints = view && ["transition", "fight", "results"].includes(view.phase) ? scoreMatch(view).race : null;
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}${location.pathname}?room=${code}`,
      );
      setCopied(true);
    } catch {
      setStatus(`Invite code: ${code}`);
    }
  };
  useEffect(() => {
    const invite = new URLSearchParams(location.search).get("room");
    if (invite) setJoinCode(invite.toUpperCase());
  }, []);
  const downloadReport = () => {
    const capturedAt = new Date();
    const result = {
      capturedAt: capturedAt.toISOString(),
      revision: process.env.NEXT_PUBLIC_BUILD_REVISION || "local-working-tree",
      userAgent: navigator.userAgent,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      mode,
      phase: view?.phase ?? screen,
      match: view
        ? {
            tick: view.tick,
            phaseTime: view.phaseTime,
            raceTime: view.raceTime,
            fightTime: view.fightTime,
            result: view.result,
            players: view.players.map((p) => ({
              character: p.character,
              hp: p.hp,
              finishTime: p.finishTime,
              raceStatus: p.raceStatus,
            })),
          }
        : null,
      recording,
      playTrace: { note: "Bounded observed authoritative events; tick is observation time, not a claim of exact event timestamp. No predicted contacts.", events: playTrace.current.events },
      frames: report,
      session: renderer.current?.sessionMeasurements(),
      work: workMeasurements.current.report(),
      rendererWork: renderer.current?.workMeasurements(),
      network: network.current?.stats ?? { status: lastNetworkStatus.current },
      note: "Render-loop intervals from this browser only. Device model, OS, sustained-session duration and thermal conditions require tester annotation. No inferred iPhone certification.",
    };
    saveBlob(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
      `animal-racers-performance-${capturedAt.getTime()}.json`,
    );
  };
  const saveBlob = (blob: Blob, name: string) => {
    // Optional localhost-only capture sink, absent from deployed environment/build.
    const captureOrigin = process.env.NEXT_PUBLIC_QA_CAPTURE_ORIGIN;
    if (captureOrigin && location.hostname === "localhost") {
      void fetch(`${captureOrigin}/capture`, {
        method: "POST",
        headers: { "Content-Type": blob.type, "X-Capture-Name": name },
        body: blob,
      })
        .then((r) => {
          if (!r.ok) throw new Error("capture");
        })
        .catch(() =>
          setError("Local capture failed. Check the evidence sink."),
        );
      return;
    }
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  };
  const captureFrame = async () => {
    const blob = await renderer.current?.capture();
    if (blob)
      saveBlob(
        blob,
        `animal-racers-${view?.phase ?? screen}-${Date.now()}.png`,
      );
  };
  const toggleRecord = async () => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    if (!canvas.current || typeof MediaRecorder === "undefined") {
      setError(
        "This browser cannot record the game canvas. Use the frame capture and performance report.",
      );
      return;
    }
    try {
      await audio.current?.unlock();
      const stream = canvas.current.captureStream(30);
      const soundtrack = audio.current?.recordingTrack();
      if (soundtrack) stream.addTrack(soundtrack);
      const mime = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined,
      );
      recordedChunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) recordedChunks.current.push(e.data);
      };
      rec.onstop = () => {
        saveBlob(
          new Blob(recordedChunks.current, { type: rec.mimeType }),
          `animal-racers-play-${Date.now()}.${rec.mimeType.includes("mp4") ? "mp4" : "webm"}`,
        );
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.current = rec;
      rec.start(1000);
      setRecording(true);
    } catch {
      setError(
        "Recording is unavailable in this browser. Frame capture still works.",
      );
    }
  };
  return (
    <main className="championship" data-phase={view?.phase ?? screen}>
      <canvas
        ref={canvas}
        className="world-canvas"
        aria-label="Three dimensional Animal Racers championship"
      />
      <div className="cinema-shade" />
      <header className="masthead">
        <button
          className="wordmark"
          onClick={leave}
          aria-label="Return to character selection"
        >
          AR<span>ANIMAL RACERS</span>
        </button>
        <div className="header-actions">
          <span className="edition">DUST & GLORY CHAMPIONSHIP</span>
          <button
            className="quiet-button"
            onClick={() => {
              void unlock();
              const next = !muted;
              setMuted(next);
              audio.current?.setMuted(next);
            }}
            aria-pressed={muted}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button
            className="quiet-button report-toggle"
            aria-label="Performance report"
            onClick={() => setShowReport((v) => !v)}
          >
            ⋯
          </button>
        </div>
      </header>
      {screen === "select" && (
        <section className="selection">
          <div className="selection-copy">
            <p className="eyebrow">
              <span /> THREE RIVALS. ONE GOLDEN CUP.
            </p>
            <h1>
              DUST
              <br />
              &amp; <em>GLORY.</em>
            </h1>
            <p className="intro-copy">
              Run wild through the canyon.
              <br />
              Stand tall in the saloon.
              <br />
              Become the all-round champion.
            </p>
            <div className="event-pill">
              <span>01 / THE RACE</span>
              <i>+</i>
              <span>02 / THE DUEL</span>
            </div>
          </div>
          <div className="selection-panel">
            <p className="eyebrow">CHOOSE YOUR CHAMPION</p>
            <div className="roster" role="group" aria-label="Choose champion">
              {CHARACTER_IDS.map((id) => (
                <button
                  key={id}
                  className={`roster-card ${id === selected ? "selected" : ""}`}
                  style={
                    { "--accent": ROSTER[id].color } as React.CSSProperties
                  }
                  onClick={() => setSelected(id)}
                  aria-pressed={id === selected}
                >
                  <span className="animal-sigil">{ROSTER[id].symbol}</span>
                  <span>
                    {ROSTER[id].name.split(" ").map((word, j) => (
                      <React.Fragment key={j}>
                        {word}
                        {j === 0 ? <br /> : " "}
                      </React.Fragment>
                    ))}
                  </span>
                  <b>{id === selected ? "✓" : "○"}</b>
                </button>
              ))}
            </div>
            <div className="character-description">
              <span style={{ color: character.color }}>{character.title}</span>
              <p>{character.description}</p>
            </div>
            <button
              className="primary-button"
              disabled={!loaded || busy}
              onClick={() => void solo()}
            >
              {loaded ? "RIDE AGAINST CPU" : "Preparing champions…"}
              <span>→</span>
            </button>
            <div className="online-actions">
              <button
                className="secondary-button"
                disabled={!loaded || busy}
                onClick={() => void connect(true)}
              >
                Invite a friend
              </button>
              <div className="join">
                <input
                  aria-label="Invitation code"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 12),
                    )
                  }
                  placeholder="INVITE CODE"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <button
                  disabled={!loaded || busy || joinCode.length !== 10}
                  onClick={() => void connect(false)}
                  aria-label="Join friend"
                >
                  →
                </button>
              </div>
            </div>
            <p className="fine-print">
              Two events. Equal stakes. Play in your browser.
            </p>
          </div>
          <div className="character-plaque">
            <span>
              {character.symbol} {character.name}
            </span>
            <small>{character.special}</small>
          </div>
        </section>
      )}
      {screen === "intro" && (
        <div className="overlay">
          <section className="intro-panel">
            <p className="eyebrow">WELCOME TO THE FRONTIER</p>
            <h2>
              Fast feet. <em>Good timing.</em>
            </h2>
            <div className="lesson-grid">
              <article>
                <span className="lesson-number">01</span>
                <h3>Run the canyon</h3>
                <ChampionshipGuide event="race" />
                <p>
                  You run automatically. Follow your rival’s trail to gather speed,
                  then swing out and pass. Leap the low timber; steer around wagons.
                </p>
                <div className="key-line">
                  ← → steer <kbd>Space</kbd> leap
                </div>
              </article>
              <article>
                <span className="lesson-number">02</span>
                <h3>Settle it in the saloon</h3>
                <ChampionshipGuide event="fight" />
                <p>
                  Watch your rival wind up. Evade the strike, then step in and
                  answer while they recover. Every animal has its own rhythm;
                  the same two buttons are all you need.
                </p>
                <div className="key-line">
                  ← → move <kbd>J</kbd> strike <kbd>Space</kbd> evade
                </div>
              </article>
              <article>
                <span className="lesson-number">03</span>
                <h3>Win the whole championship</h3>
                <ChampionshipGuide event="cup" />
                <p>
                  Race time and remaining fight health each split 50 points. A
                  strong second event can turn it around. Both scores decide the
                  cup.
                </p>
              </article>
            </div>
            <div className="cpu-pick">
              <label htmlFor="cpu-rival">Your CPU rival</label>
              <select
                id="cpu-rival"
                value={rival}
                onChange={(e) => setRival(e.target.value as CharacterId)}
              >
                {CHARACTER_IDS.map((id) => (
                  <option value={id} key={id}>
                    {ROSTER[id].name}
                  </option>
                ))}
              </select>
              <span>
                Same rules, same speed. Read the rival, find your moment.
              </span>
            </div>
            <p className="touch-note">
              On a phone, use the large controls at the bottom. Landscape gives
              you the clearest view.
            </p>
            <button
              className="primary-button"
              onClick={() => begin([selected, rival], crypto.randomUUID())}
            >
              LET’S RIDE <span>→</span>
            </button>
          </section>
        </div>
      )}
      {screen === "lobby" && (
        <div className="overlay">
          <section className="lobby-panel">
            <p className="eyebrow">A FRIENDLY FRONTIER RIVALRY</p>
            <h2>
              {mode === "host" ? "Your invitation." : "Challenge accepted."}
            </h2>
            <button
              className="invite-code"
              onClick={() => void share()}
              title="Copy invitation link"
            >
              {code}
              <small>
                {copied ? "LINK COPIED" : "TAP TO COPY INVITATION LINK"}
              </small>
            </button>
            <p className="lobby-status" role="status">
              {status}
            </p>
            <div className="rival-slots">
              <div>
                <b>{ROSTER[selected].symbol}</b>
                <span>{ROSTER[selected].name}</span>
                <small>{ready ? "READY" : "YOU"}</small>
              </div>
              <i>vs</i>
              <div>
                <b>{peer ? ROSTER[peer.character].symbol : "?"}</b>
                <span>
                  {peer ? ROSTER[peer.character].name : "Waiting for a rival"}
                </span>
                <small>{peer?.ready ? "READY" : "RIVAL"}</small>
              </div>
            </div>
            <p className="touch-note">
              Move ← → · leap / evade Space · strike J<br />
              Touch controls appear in the match. Keep both screens open.
            </p>
            <button
              className="primary-button"
              disabled={!peer}
              onClick={() => {
                const next = !readyRef.current;
                readyRef.current = next;
                setReady(next);
              }}
            >
              {ready ? "READY — WAITING FOR RIVAL" : "READY TO RIDE"}
              <span>→</span>
            </button>
            <button className="quiet-button" onClick={leave}>
              Return to character selection
            </button>
          </section>
        </div>
      )}
      {screen === "play" && view && (
        <>
          {isRace && (
            <div className="race-hud">
              <div>
                <span className="eyebrow">01 / THE CANYON RUN</span>
                <strong>
                  {p!.z >= op!.z ? "1ST" : "2ND"}
                  <small> / 2</small>
                </strong>
                <span className="rival-gap">
                  {Math.abs(p!.z - op!.z) < 1 ? "NECK AND NECK" : `${Math.abs(p!.z - op!.z).toFixed(0)}m ${p!.z > op!.z ? "AHEAD" : "TO YOUR RIVAL"}`}
                </span>
              </div>
              <div className="race-distance">
                <span>
                  {Math.min(100, Math.floor((p!.z / COURSE_LENGTH) * 100))}%
                </span>
                <div>
                  <i
                    style={{
                      width: `${Math.min(100, (p!.z / COURSE_LENGTH) * 100)}%`,
                    }}
                  />
                  <span className="rival-progress" style={{ left: `${Math.min(100, (op!.z / COURSE_LENGTH) * 100)}%` }} />
                </div>
                <small>
                  {view.raceTime.toFixed(1)}s <b>◆ YOU</b> ◇ RIVAL
                </small>
              </div>
              <div className="speed">
                <strong>{Math.round(p!.speed * 3.6)}</strong>
                <span>KM/H</span>
              </div>
            </div>
          )}
          {isFight && (
            <div className="fight-hud">
              <div className="health-block">
                <span>◆ {ROSTER[view.players[0].character].name}</span>
                <div>
                  <i style={{ width: `${view.players[0].hp}%` }} />
                </div>
                <small>{Math.ceil(view.players[0].hp)} HP · {racePoints?.[0].toFixed(1)} RACE PTS</small>
              </div>
              <div className="fight-clock">
                <span>THE DUEL</span>
                <strong>
                  {Math.ceil(Math.max(0, FIGHT_DURATION - view.fightTime))}
                </strong>
              </div>
              <div className="health-block rival-health">
                <span>{ROSTER[view.players[1].character].name} ◇</span>
                <div>
                  <i style={{ width: `${view.players[1].hp}%` }} />
                </div>
                <small>{Math.ceil(view.players[1].hp)} HP · {racePoints?.[1].toFixed(1)} RACE PTS</small>
              </div>
            </div>
          )}
          {isFight && op!.action === "attack" && (
            <div className={`duel-cue ${op!.actionTime >= op!.strikeWindup + ATTACKS[op!.character].active ? "opening" : ""}`}>
              {op!.actionTime < op!.strikeWindup
                ? "WATCH THE WIND-UP"
                : op!.actionTime >= op!.strikeWindup + ATTACKS[op!.character].active
                  ? "THEY’RE RECOVERING"
                  : "INCOMING"}
            </div>
          )}
          {view.phase === "countdown" && (
            <div className="countdown">
              <span>THE CANYON IS CALLING</span>
              <strong>{Math.max(1, Math.ceil(3 - view.phaseTime))}</strong>
              <p>Follow their trail. Find your pass.</p>
            </div>
          )}
          {view.phase === "transition" && (
            <div className="transition-card">
              <p className="eyebrow">THE RACE IS SETTLED</p>
              <h2>Now, stand tall.</h2>
              <div>
                {view.players.map((r, i) => (
                  <span key={i}>
                    {ROSTER[r.character].name}
                    <b>{formatTime(r.finishTime)}</b>
                    <small>{racePoints?.[i].toFixed(1)} race points</small>
                  </span>
                ))}
              </div>
              <p>Race points banked. Both rivals enter at full strength.</p>
              <small>Read the wind-up. Evade. Answer the miss.</small>
            </div>
          )}
          {(isRace || isFight) && (
            <>
              <div className="match-hint">
                {p!.stun > 0
                  ? isRace ? "Shake it off. The chase is still on." : "Hit — find your feet"
                  : isRace
                    ? p!.finishTime !== null
                      ? "Finished — waiting for your rival"
                      : Math.abs(p!.x) > RACE.shoulderStart
                        ? "Rough shoulder — steer onto the firm trail"
                      : p!.draft >= .8
                        ? "SLIPSTREAM — swing out and pass!"
                        : p!.drafting
                          ? "Hold their trail. Build your speed."
                          : p!.z < op!.z
                            ? "Follow your rival’s trail to catch up"
                            : "Keep your line. They’re coming for you."
                    : p!.counterWindow > 0
                      ? "YOUR OPENING — strike!"
                      : p!.action === "attack"
                        ? "Committed — recover, then move"
                        : p!.action === "evade"
                          ? "EVADE"
                          : "Read the wind-up. Make them miss."}
                {isRace && p!.finishTime === null && (
                  <span className="draft-meter" aria-label={`Slipstream ${Math.round(p!.draft * 100)} percent`}>
                    <i style={{ width: `${p!.draft * 100}%` }} />
                  </span>
                )}
              </div>
              <div className="touch-controls">
                <div className="movement">
                  <button aria-label="Move left" {...press("move", -1)}>
                    ←
                  </button>
                  <button aria-label="Move right" {...press("move", 1)}>
                    →
                  </button>
                </div>
                <div className="action-controls">
                  {isFight && (
                    <button
                      className={`control evade ${p!.dodgeCooldown > 0 ? "cooling" : ""}`}
                      {...press("jump", true)}
                      aria-label="Evade"
                    >
                      <b>↶</b>
                      <span>EVADE</span>
                      {p!.dodgeCooldown > 0 && <small>{p!.dodgeCooldown.toFixed(1)}</small>}
                    </button>
                  )}
                  <button
                    className={`control ${isFight ? "strike" : "leap"}`}
                    {...press(isRace ? "jump" : "attack", true)}
                    aria-label={isRace ? "Leap" : "Strike"}
                  >
                    <b>{isRace ? "↑" : ROSTER[p!.character].symbol}</b>
                    <span>{isRace ? "LEAP" : "STRIKE"}</span>
                  </button>
                </div>
              </div>
            </>
          )}
          {view.phase === "results" && view.result && (
            <section className="results-panel" ref={resultsPanel}>
              <p className="eyebrow">THE DUST HAS SETTLED</p>
              <h2>
                {view.result.winner === null
                  ? "Shared glory."
                  : view.result.winner === localSlot
                    ? "The cup is yours."
                    : "A worthy rival."}
              </h2>
              <p className="result-winner">
                {view.result.winner === null
                  ? "Two champions. One extraordinary match."
                  : `${ROSTER[view.players[view.result.winner].character].name} takes the championship`}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>CHAMPION</th>
                    <th>RACE</th>
                    <th>DUEL</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {view.players.map((r, i) => (
                    <tr
                      key={i}
                      className={i === view.result!.winner ? "winner-row" : ""}
                    >
                      <th>
                        {i === localSlot ? "◆" : "◇"} {ROSTER[r.character].name}
                        <small>
                          {formatTime(r.finishTime)} · {Math.round(r.hp)} HP
                        </small>
                      </th>
                      <td>{view.result!.race[i].toFixed(1)}</td>
                      <td>{view.result!.fight[i].toFixed(1)}</td>
                      <td>{view.result!.total[i].toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="score-explanation">{view.result.reason}</p>
              <div className="result-actions">
                <button
                  className="primary-button"
                  onClick={rematch}
                  disabled={
                    rematchWaiting || (mode !== "solo" && !connected.current)
                  }
                >
                  {mode !== "solo" && !connected.current
                    ? "RIVAL LEFT"
                    : rematchWaiting
                      ? "WAITING FOR RIVAL"
                      : "RIDE AGAIN"}{" "}
                  <span>↻</span>
                </button>
                <button className="secondary-button" onClick={leave}>
                  Back to the trail
                </button>
              </div>
            </section>
          )}
        </>
      )}
      {interrupted && screen === "play" && (
        <div className="overlay">
          <section className="lobby-panel">
            <p className="eyebrow">CONNECTION INTERRUPTED</p>
            <h2>Meet back on the trail.</h2>
            <p className="touch-note">
              Both players need a live connection. This match has no verified
              championship result.
            </p>
            <button className="primary-button" onClick={leave}>
              RETURN TO THE TRAIL <span>→</span>
            </button>
          </section>
        </div>
      )}
      {recording && (
        <button className="recording-indicator" onClick={toggleRecord}>
          ● RECORDING · STOP & SAVE
        </button>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {screen === "play" && status && mode !== "solo" && (
        <div className="network-banner" role="status">
          {status}
        </div>
      )}
      {audioStatus && (
        <div className="audio-status" role="status">
          {audioStatus}
        </div>
      )}
      {rotate && screen === "play" && (
        <div className="rotate-hint">↻ Turn sideways for a wider view</div>
      )}
      {showReport && (
        <aside className="performance-panel">
          <h3>Performance report</h3>
          <p>
            Recent frame intervals on this browser.
            <br />
            Physical device acceptance requires a sustained test.
          </p>
          <pre data-testid="performance-data">
            {JSON.stringify(
              {
                frames: report,
                network: mode === "solo" ? undefined : network.current?.stats,
              },
              null,
              2,
            )}
          </pre>
          <button
            className="secondary-button"
            onClick={() => {
              renderer.current?.resetMeasurements();
              workMeasurements.current = new WorkMeasurements();
            }}
          >
            Start fresh measurement
          </button>
          <button className="secondary-button" onClick={downloadReport}>
            Download measurements
          </button>
          <button
            className="secondary-button"
            onClick={() => void captureFrame()}
          >
            Save gameplay frame
          </button>
          <button className="secondary-button" onClick={toggleRecord}>
            {recording ? "Stop and save recording" : "Record game canvas"}
          </button>
        </aside>
      )}
      <footer className="edition-footer">
        <span>AN ORIGINAL FRONTIER CHAMPIONSHIP</span>
        <span>
          {screen === "play"
            ? "DUST & GLORY"
            : "RACE ON FOUR FEET. FIGHT ON TWO."}
        </span>
      </footer>
    </main>
  );
}
