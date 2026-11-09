"use client";
import Image from "next/image";
import { hudSnapshot, UiUpdates, type HudSnapshot } from "@/championship/ui-updates";
import { ChildControls } from "@/championship/child-controls";
import { bindResultInteraction, ResultInteraction } from "@/championship/result-interaction";
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
import { CPU_DIFFICULTIES, CPU_DIFFICULTY_SETTINGS, DEFAULT_CPU_DIFFICULTY, loadCpuDifficulty, saveCpuDifficulty, type CpuDifficulty } from "@/championship/difficulty";
import { ROSTER, CHARACTER_IDS } from "@/championship/content";
import {
  createMatch,
  createDuelMatch,
  stepMatch,
  cpuInput,
  neutralInput,
  COURSE_LENGTH,
  FIGHT_DURATION,
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
    ["championship", "duel"].includes(m.format) &&
    Number.isSafeInteger(m.tick) &&
    m.tick >= 0 &&
    ["countdown", "race", "transition", "fight", "results"].includes(m.phase) &&
    Number.isFinite(m.phaseTime) &&
    Number.isInteger(m.hitPause) && m.hitPause >= 0 && m.hitPause <= 4 &&
    Array.isArray(m.players) &&
    m.players.length === 2 &&
    m.players.every(
      (p) =>
        validCharacter(p.character) &&
        [p.x, p.y, p.z, p.hp, p.speed, p.draft, p.dodgeCooldown, p.counterWindow, p.strikeWindup, p.guard, p.comboWindow, p.slow, p.actionTime, p.strikeId].every(Number.isFinite) &&
        p.strikeWindup > 0 && ["quick", "power"].includes(p.strikeKind) &&
        [0, 1].includes(p.comboStep) && typeof p.guardBroken === "boolean" && typeof p.ward === "boolean" && typeof p.drafting === "boolean" && typeof p.action === "string",
    ) &&
    Array.isArray(m.events) &&
    m.events.length < 128 &&
    m.events.every(e => e && Number.isSafeInteger(e.id) && typeof e.type === "string" &&
      Number.isFinite(e.x) && Number.isFinite(e.z) &&
      (e.strikeKind === undefined || ["quick", "power"].includes(e.strikeKind)))
  );
}
const formatTime = (s: number | null) =>
  s === null ? "DNF" : `${s.toFixed(2)}s`;

export default function Championship() {
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>(DEFAULT_CPU_DIFFICULTY);
  const cpuDifficultyRef = useRef<CpuDifficulty>(DEFAULT_CPU_DIFFICULTY);
  useEffect(() => {
    const saved = loadCpuDifficulty();
    setCpuDifficulty(saved); cpuDifficultyRef.current = saved;
  }, []);
  const chooseDifficulty = (difficulty: CpuDifficulty) => {
    setCpuDifficulty(difficulty); cpuDifficultyRef.current = difficulty; saveCpuDifficulty(difficulty);
  };
  const presentation = useRef(new PresentationBuffer());
  const prediction = useRef(new GuestPrediction(1));
  const workMeasurements = useRef(new WorkMeasurements());
  const controls = useRef(new InputControls());
  const childControls = useRef(new ChildControls());
  const resultInput = useRef(new ResultInteraction());
  const reportVisible = useRef(false);
  const [resultStatus, setResultStatus] = useState<ReturnType<ResultInteraction["status"]>>("inactive");
  const [resultSeconds, setResultSeconds] = useState(4);
  const resultReady = resultStatus === "ready";
  const [loadingLabel, setLoadingLabel] = useState("どうぶつを よんでいるよ…");
  const playTrace = useRef<{ lastId: number; events: { tick: number; phase: string; phaseTime: number; type: string; slot: number; x: number; z: number; strikeKind?: "quick" | "power" }[] }>({ lastId: 0, events: [] });
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
    [practice, setPractice] = useState(false),
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
    [view, setView] = useState<HudSnapshot | null>(null),
    [rotate, setRotate] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => bindResultInteraction(resultInput.current, window, document), []);
  const resultPhase = screen === "play" && view?.phase === "results";
  useEffect(() => {
    const gate = resultInput.current;
    if (!resultPhase) { gate.leave(); setResultStatus("inactive"); return; }
    gate.enter(performance.now());
    const updateNotice = () => {
      const now = performance.now();
      setResultStatus(gate.status(now));
      setResultSeconds(gate.remainingSeconds(now));
    };
    updateNotice();
    const timer = window.setInterval(updateNotice, 50);
    return () => window.clearInterval(timer);
  }, [resultPhase]);
  const resultAction = (name: string, action: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault(); resultInput.current.start(`p${e.pointerId}`, name);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      if (resultInput.current.finish(`p${e.pointerId}`, name, e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) action();
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (["Enter", " "].includes(e.key)) { e.preventDefault(); resultInput.current.start(`k${e.key}`, name); }
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (["Enter", " "].includes(e.key)) { e.preventDefault(); if(resultInput.current.finish(`k${e.key}`, name, true)) action(); }
    },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      // Assistive-technology activation has no pointer/key gesture.
      if (e.detail === 0 && resultInput.current.ready(performance.now())) action();
    },
  });
  const setPage = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  }, []);
  const localSlot = mode === "guest" ? 1 : 0;
  const publishControls = useCallback(() => {
    const previousInput = input.current;
    if (modeRef.current !== "solo" && !connected.current) childControls.current.clear();
    input.current = childControls.current.update(controls.current.value(), modeRef.current !== "solo" && !connected.current ? null : match.current, modeRef.current === "guest" ? 1 : 0, performance.now());
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
    (characters: [CharacterId, CharacterId], newEpoch: string, duelOnly = false) => {
      match.current = (duelOnly ? createDuelMatch : createMatch)(characters, 6827);
      if (modeRef.current === "solo") match.current.soloCpu = { slot: 1, difficulty: cpuDifficultyRef.current };
      epoch.current = newEpoch;
      prediction.current.reset(newEpoch);
      playTrace.current = { lastId: 0, events: [] };
      latestTick.current = -1;
      presentation.current.clear();
      remoteSeq.current = -1;
      inputSender.current.reset();
      controls.current.clear();
      childControls.current.clear();
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
      setView(hudSnapshot(match.current));
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
      childControls.current.clear();
    prediction.current.disconnect();
    setPage("select");
    setStatus("");
    setError("");
    setInterrupted(false);
    setRematchWaiting(false);
    rematchPending.current = false;
    void renderer.current?.setCharacters([selectedRef.current, rival]);
  }, [rival, setPage, setError]);
  useEffect(() => {
    if (!canvas.current) return;
    let alive = true;
    try {
      const r = new ChampionshipRenderer(canvas.current);
      renderer.current = r;
      audio.current = new ChampionshipAudio();
      r.load((label) => { if (alive) setLoadingLabel(label); })
        .then(() => {
          if (alive) setLoaded(true);
        })
        .catch((e) => {
          if (alive)
            setError(
              `どうぶつを よみこめなかったよ。もういちど ひらいてね。 ${e instanceof Error ? e.message : ""}`,
            );
        });
    } catch {
      setError(
        "ゲームを ひらけなかったよ。SafariかChromeで ひらいてね。",
      );
    }
    let frame = 0,
      previous = performance.now(),
      accumulator = 0,
      lastSend = 0,
      lastUrgentEvent = 0,
      sentEpoch = "",
      previousCallbackEnd = 0;
    const uiUpdates = new UiUpdates();
    const animate = (now: number) => {
      if (!alive) return;
      const callbackStart = performance.now();
      const realDt = (now - previous) / 1000;
      previous = now;
      const dt = Math.min(realDt, 0.1);
      publishControls();
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
            "つうしんが きれたよ。けっかは のこらないよ。",
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
            type: event.type, slot: event.slot, x: event.x, z: event.z,
            ...(event.strikeKind ? { strikeKind: event.strikeKind } : {}) });
        }
        if (playTrace.current.events.length > 256) playTrace.current.events.splice(0, playTrace.current.events.length - 256);
      }
      const simulationEnd = performance.now();
      if (sentEpoch !== epoch.current) { sentEpoch = epoch.current; lastUrgentEvent = 0; }
      const urgentSnapshot = host && Boolean(m?.events.some(event => event.id > lastUrgentEvent
        && ["attack", "combo", "power", "block", "guard-break", "ward-block", "counter", "evade", "hit", "fight", "transition", "results"].includes(event.type)));
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
      if (match.current && uiUpdates.hudDue(now, match.current)) setView(hudSnapshot(match.current));
      if (uiUpdates.reportDue(now, reportVisible.current)) setReport(renderer.current?.report() ?? null);
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
      if (e.repeat || e.isComposing || (e.target as HTMLElement).matches("input,textarea,select,[contenteditable=true]")) return;
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
      childControls.current.clear();
      publishControls();
    };
    const releasePointer = (e: PointerEvent) => {
      controls.current.pointerUp(e.pointerId);
      publishControls();
    };
    const cancelPointer = (e: PointerEvent) => {
      controls.current.pointerCancel(e.pointerId);
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
          "がめんを とじたので おわったよ。けっかは のこらないよ。",
        );
        setInterrupted(true);
      }
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("lostpointercapture", cancelPointer);
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
      window.removeEventListener("pointercancel", cancelPointer);
      window.removeEventListener("lostpointercapture", cancelPointer);
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
      setAudioStatus("おとを だせないよ。がめんを みて あそんでね。");
  };
  const connect = async (asHost: boolean) => {
    if (connecting.current) return;
    connecting.current = true;
    setBusy(true);
    await network.current?.disconnect();
    network.current = null;
    setError("");
    setStatus("つないでいるよ…");
    setPractice(false);
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
      setError("ともだちからの10もじのコードを いれてね。");
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
        setStatus("ともだちが きたよ！ じゅんびができたら おしてね。");
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
            "ともだちとの つうしんが きれたよ。けっかは のこらないよ。",
          );
        } else setStatus("ともだちが おわったよ。もういちど さそってね。");
      } else if (["error", "room-full", "room-conflict"].includes(s)) {
        setError(
          s === "room-full"
            ? "このへやは いっぱいだよ。"
            : `Connection problem (${s}). Return and try a new invitation.`,
        );
      } else if (s === "waiting")
        setStatus(
          asHost
            ? "コードを ともだちに おしえてね。"
            : "ともだちを さがしているよ…",
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
        data.match.format === "championship" &&
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
      childControls.current.clear();
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
        setView(hudSnapshot(data.match));
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
          "ともだちが おわったよ。けっかは のこらないよ。",
        );
      }
    };
    try {
      await net.connect(invite, asHost);
      setPage("lobby");
      await unlock();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "つながらなかったよ。もういちど ためしてね。",
      );
      void net.disconnect();
      network.current = null;
    } finally {
      connecting.current = false;
      setBusy(false);
    }
  };
  const solo = async (duelOnly = false) => {
    setPractice(duelOnly);
    modeRef.current = "solo";
    setMode("solo");
    await unlock();
    setPage("intro");
  };
  const rematch = () => {
    if (mode === "solo") {
      begin([selected, rival], crypto.randomUUID(), match.current?.format === "duel");
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
      controls.current.pointerCancel(e.pointerId);
      publishControls();
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      controls.current.pointerCancel(e.pointerId);
      publishControls();
    },
  });
  const isRace = view?.phase === "race" || view?.phase === "countdown";
  const isFight = view?.phase === "fight";
  const p = view?.players[localSlot],
    op = view?.players[localSlot === 0 ? 1 : 0],
    character = ROSTER[selected];
  const latestContact = view?.latestContact;
  const racePoints = view?.racePoints;
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
    const currentMatch = match.current;
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
      phase: currentMatch?.phase ?? screen,
      match: currentMatch
        ? {
            format: currentMatch.format,
            tick: currentMatch.tick,
            phaseTime: currentMatch.phaseTime,
            raceTime: currentMatch.raceTime,
            fightTime: currentMatch.fightTime,
            result: currentMatch.result,
            players: currentMatch.players.map((p) => ({
              character: p.character,
              hp: p.hp,
              guard: p.guard,
              action: p.action,
              strikeKind: p.strikeKind,
              comboStep: p.comboStep,
              finishTime: p.finishTime,
              raceStatus: p.raceStatus,
            })),
          }
        : null,
      recording,
      playTrace: { note: "Bounded observed authoritative events; tick is observation time, not a claim of exact event timestamp. No predicted contacts.", events: playTrace.current.events },
      frames: renderer.current?.report() ?? null,
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
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        aria-label="アニマルレーサーのゲーム画面"
      />
      {!loaded && <Image className="loading-preview" src="/assets/previews/lion-menu.webp" alt="" fill priority unoptimized onLoad={() => performance.mark("animal-first-preview")} />}
      <div className="cinema-shade" />
      <header className="masthead">
        <button
          className="wordmark"
          {...(resultPhase ? resultAction("home", leave) : { onClick: leave })}
          aria-label="どうぶつを えらびなおす"
        >
          AR<span>アニマルレーサー</span>
        </button>
        <div className="header-actions">
          <span className="edition">はしって たたかう アニマルレース</span>
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
            {muted ? "🔇 おと なし" : "🔊 おと あり"}
          </button>
          <button
            className="quiet-button report-toggle"
            aria-label="うごきの きろく"
            onClick={() => {
              reportVisible.current = !reportVisible.current;
              if (reportVisible.current) setReport(renderer.current?.report() ?? null);
              setShowReport(reportVisible.current);
            }}
          >
            ⋯
          </button>
        </div>
      </header>
      {screen === "select" && (
        <section className="selection">
          <div className="selection-copy">
            <p className="eyebrow">
              <span /> すきな どうぶつで あそぼう
            </p>
            <h1>
              アニマル<br /><em>レーサー</em>
            </h1>
            <p className="intro-copy">
              はしって、たたかって、<br />トロフィーを めざそう！
            </p>
            <div className="event-pill">
              <span>🏁 はしる</span>
              <i>+</i>
              <span>🥊 たたかう</span>
            </div>
          </div>
          <div className="selection-panel">
            <p className="eyebrow">どうぶつを えらんでね</p>
            <div className="roster" role="group" aria-label="どうぶつを えらぶ">
              {CHARACTER_IDS.map((id) => (
                <button
                  key={id}
                  className={`roster-card ${id === selected ? "selected" : ""}`}
                  style={
                    { "--accent": ROSTER[id].color } as React.CSSProperties
                  }
                  disabled={!loaded}
                  onClick={() => setSelected(id)}
                  aria-pressed={id === selected}
                >
                  <span className="animal-sigil">{({lion: "🦁", wolf: "🐺", unicorn: "🦄"})[id]}</span>
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
              {loaded ? "あそぶ" : loadingLabel}
              <span>→</span>
            </button>
            <button className="practice-button secondary-button" disabled={!loaded || busy} onClick={() => void solo(true)}>
              バトルだけ あそぶ <span>🥊</span>
            </button>
            <div className="online-actions">
              <button
                className="secondary-button"
                disabled={!loaded || busy}
                onClick={() => void connect(true)}
              >
                ともだちと あそぶ
              </button>
              <div className="join">
                <input
                  aria-label="しょうたいコード"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 12),
                    )
                  }
                  placeholder="コード"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <button
                  disabled={!loaded || busy || joinCode.length !== 10}
                  onClick={() => void connect(false)}
                  aria-label="ともだちのところへ"
                >
                  →
                </button>
              </div>
            </div>
            <p className="fine-print">
              すきな どうぶつを えらんで「あそぶ」
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
          <section className={`intro-panel kids-intro ${practice ? "duel-intro" : ""}`}>
            <h2>{practice ? "たたいてみよう！" : "さあ、いこう！"}</h2>
            <div className="lesson-grid">
              {!practice && <article><h3>🏁 はしる</h3><ChampionshipGuide event="race" /><p>← → よける　↑ ジャンプ</p></article>}
              <article><h3>🥊 たたかう</h3><ChampionshipGuide event="fight" /><p>🥊 を おすと、ちかづいて たたく</p></article>
              {!practice && <article><h3>🏆 やったね！</h3><ChampionshipGuide event="cup" /><p>さいごに トロフィー！</p></article>}
            </div>
            <details className="game-settings"><summary>⚙ あいて・つよさ：{CPU_DIFFICULTY_SETTINGS[cpuDifficulty].label}</summary>
            <div className="cpu-pick cpu-options">
              <label htmlFor="cpu-rival">あいて</label>
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
              <fieldset className="cpu-difficulty" aria-describedby="difficulty-description">
                <legend>つよさ</legend>
                <div>
                  {CPU_DIFFICULTIES.map(difficulty => (
                    <label key={difficulty} className={cpuDifficulty === difficulty ? "selected" : ""}>
                      <input type="radio" name="cpu-difficulty" value={difficulty} checked={cpuDifficulty === difficulty}
                        onChange={() => chooseDifficulty(difficulty)} />
                      {CPU_DIFFICULTY_SETTINGS[difficulty].label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p id="difficulty-description" className="difficulty-note">{CPU_DIFFICULTY_SETTINGS[cpuDifficulty].description}</p>
            </div>
            </details>
            <button
              className="primary-button"
              onClick={() => begin([selected, rival], crypto.randomUUID(), practice)}
            >
              {practice ? "たたかう！" : "スタート！"} <span>→</span>
            </button>
          </section>
        </div>
      )}
      {screen === "lobby" && (
        <div className="overlay">
          <section className="lobby-panel">
            <p className="eyebrow">ともだちと あそぶ</p>
            <h2>
              {mode === "host" ? "ともだちを よぼう" : "ともだちと あそぼう"}
            </h2>
            <button
              className="invite-code"
              onClick={() => void share()}
              title="しょうたいリンクを コピー"
            >
              {code}
              <small>
                {copied ? "コピーしたよ" : "おすと リンクを コピー"}
              </small>
            </button>
            <p className="lobby-status" role="status">
              {status}
            </p>
            <div className="rival-slots">
              <div>
                <b>{ROSTER[selected].symbol}</b>
                <span>{ROSTER[selected].name}</span>
                <small>{ready ? "じゅんびOK" : "じぶん"}</small>
              </div>
              <i>vs</i>
              <div>
                <b>{peer ? ROSTER[peer.character].symbol : "?"}</b>
                <span>
                  {peer ? ROSTER[peer.character].name : "ともだちを まっているよ"}
                </span>
                <small>{peer?.ready ? "じゅんびOK" : "あいて"}</small>
              </div>
            </div>
            <p className="touch-note">
              ← → move · Space leap / evade · J strike<br />
              K power · L / Shift guard · Keep both screens open.
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
              {ready ? "じゅんびOK！ あいてを まっているよ" : "じゅんびOK！"}
              <span>→</span>
            </button>
            <button className="quiet-button" onClick={leave}>
              どうぶつを えらびなおす
            </button>
          </section>
        </div>
      )}
      {screen === "play" && view && (
        <>
          {isRace && (
            <div className="race-hud">
              <div>
                <span className="eyebrow">🏁 はしる</span>
                <strong>
                  {p!.z >= op!.z ? "1ばん" : "2ばん"}
                  <small> / 2</small>
                </strong>
                <span className="rival-gap">
                  {Math.abs(p!.z - op!.z) < 1 ? "ならんだ！" : `${Math.abs(p!.z - op!.z).toFixed(0)}m ${p!.z > op!.z ? "まえ" : "で あいて"}`}
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
                  {view.raceTime.toFixed(1)}s <b>◆ じぶん</b> ◇ あいて
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
                <small>{Math.ceil(view.players[0].hp)} げんき{view.format === "championship" && ` · レース ${racePoints?.[0].toFixed(1)}てん`}</small>
                <div className={`guard-meter ${view.players[0].guardBroken ? "broken" : ""}`} aria-label={`まもる ちから ${Math.round(view.players[0].guard)}%`}><i style={{ width: `${view.players[0].guard}%` }} /></div>
              </div>
              <div className="fight-clock">
                <span>{view.format === "duel" ? "れんしゅう" : "たたかう"}</span>
                <strong>
                  {Math.ceil(Math.max(0, FIGHT_DURATION - view.fightTime))}
                </strong>
              </div>
              <div className="health-block rival-health">
                <span>{ROSTER[view.players[1].character].name} ◇</span>
                <div>
                  <i style={{ width: `${view.players[1].hp}%` }} />
                </div>
                <small>{Math.ceil(view.players[1].hp)} げんき{view.format === "championship" && ` · レース ${racePoints?.[1].toFixed(1)}てん`}</small>
                <div className={`guard-meter ${view.players[1].guardBroken ? "broken" : ""}`} aria-label={`まもる ちから ${Math.round(view.players[1].guard)}%`}><i style={{ width: `${view.players[1].guard}%` }} /></div>
              </div>
            </div>
          )}
          {view.phase === "countdown" && (
            <div className="countdown">
              <span>よーい…</span>
              <strong>{Math.max(1, Math.ceil(3 - view.phaseTime))}</strong>
              <p>← → よける　↑ ジャンプ</p>
            </div>
          )}
          {view.phase === "transition" && (
            <div className="transition-card">
              <p className="eyebrow">{view.format === "duel" ? "バトル はじまるよ" : "ゴール！"}</p>
              <h2>{view.format === "duel" ? "たたいてみよう！" : "つぎは バトル！"}</h2>
              <div>
                {view.players.map((r, i) => (
                  <span key={i}>
                    {ROSTER[r.character].name}
                    <b>{view.format === "duel" ? ROSTER[r.character].special : formatTime(r.finishTime)}</b>
                    <small>{view.format === "duel" ? ROSTER[r.character].counter : `${racePoints?.[i].toFixed(1)}てん`}</small>
                  </span>
                ))}
              </div>
              <p>{view.format === "duel" ? "🥊 を おしてみよう" : "げんき いっぱいで スタート"}</p>
              <small>← → で うごく。🥊 で たたく。</small>
            </div>
          )}
          {(isRace || isFight) && (
            <>
              <div className="match-hint">
                {isFight && latestContact && (p!.stun > 0 || op!.stun > 0 || view.hitPause > 0) ? (latestContact.type === "hit" ? latestContact.slot === localSlot ? "だいじょうぶ！" : "あたった！" : "ガード！") : p!.stun > 0
                  ? isRace ? "だいじょうぶ！ つづけよう" : "だいじょうぶ！"
                  : isRace
                    ? p!.finishTime !== null
                      ? "ゴール！ あいてを まっているよ"
                      : Math.abs(p!.x) > RACE.shoulderStart
                        ? "← → で みちに もどろう"
                      : p!.draft >= .8
                        ? "あとすこし！"
                        : p!.drafting
                          ? "しょうがいぶつを よけよう"
                          : p!.z < op!.z
                            ? "← → よける　↑ ジャンプ"
                            : "そのちょうし！"
                    : p!.guardBroken
                      ? "すこし はなれよう"
                      : p!.comboWindow > 0
                        ? "もういっかい！"
                      : p!.slow > 0
                        ? "すこし ゆっくり"
                      : p!.counterWindow > 0
                        ? "いまだ！ たたこう"
                      : p!.action === "guard"
                        ? "まもっているよ"
                      : p!.action === "attack"
                        ? p!.strikePhase === "recovery" ? "つぎの パンチを じゅんび" : p!.strikeKind === "power" ? "つよい パンチ！" : "パンチ！"
                        : p!.action === "evade"
                          ? "よけた！"
                          : childControls.current.approaching ? "ちかづくよ！" : p!.attackConnected ? "あたった！" : "🥊 を おしてみよう"}
                {isRace && p!.finishTime === null && (
                  <span className="draft-meter" aria-label={`あいての うしろ ${Math.round(p!.draft * 100)}%`}>
                    <i style={{ width: `${p!.draft * 100}%` }} />
                  </span>
                )}
              </div>
              <div className={`touch-controls ${isFight ? "duel-controls" : ""}`}>
                <div className="movement">
                  <button aria-label="ひだりへ" {...press("move", -1)}>
                    ←
                  </button>
                  <button aria-label="みぎへ" {...press("move", 1)}>
                    →
                  </button>
                </div>
                <div className="action-controls">
                  {isFight ? <button className={`control strike ${p!.comboWindow > 0 ? "link-ready" : ""}`} {...press("attack", true)} aria-label="たたく">
                    <b>🥊</b><span>たたく</span>
                  </button> : <button className="control leap" {...press("jump", true)} aria-label="ジャンプ">
                    <b>↑</b><span>ジャンプ</span>
                  </button>}
                </div>
              </div>
            </>
          )}
          {view.phase === "results" && view.result && (
            <section className="results-panel" ref={resultsPanel}>
              <p className="eyebrow">{view.format === "duel" ? "バトル おしまい" : "けっか はっぴょう"}{mode === "solo" && ` · ${CPU_DIFFICULTY_SETTINGS[cpuDifficulty].label}`}</p>
              <h2>
                {view.result.winner === null
                  ? "ひきわけ！"
                  : view.result.winner === localSlot
                    ? view.format === "duel" ? "やったね！" : "やったね！"
                    : "がんばったね！"}
              </h2>
              <p className="result-winner">
                {view.result.winner === null
                  ? view.format === "duel" ? "もういっかい あそぼう" : "ふたりとも がんばったね！"
                  : `${ROSTER[view.players[view.result.winner].character].name}の かち！`}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>どうぶつ</th>
                    {view.format === "championship" && <th>レース</th>}
                    <th>{view.format === "duel" ? "げんき" : "バトル"}</th>
                    {view.format === "championship" && <th>ごうけい</th>}
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
                          {view.format === "championship" && `${formatTime(r.finishTime)} · `}{Math.round(r.hp)} げんき
                        </small>
                      </th>
                      {view.format === "championship" && <td>{view.result!.race[i].toFixed(1)}</td>}
                      <td>{view.format === "duel" ? `${Math.ceil(r.hp)} げんき` : view.result!.fight[i].toFixed(1)}</td>
                      {view.format === "championship" && <td>{view.result!.total[i].toFixed(1)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="score-explanation result-notice">{resultStatus === "ceremony" || resultStatus === "inactive"
                ? `🏆 けっか はっぴょう！ あと ${resultSeconds}びょう`
                : resultStatus === "release" ? "てを はなしてね"
                  : resultStatus === "pause" ? "もうすぐ おせるよ"
                    : "もういちど あそぶ？"}</p>
              <div className="result-actions">
                <button
                  className="primary-button"
                  aria-disabled={!resultReady || rematchWaiting}
                  {...resultAction("again", rematch)}
                  disabled={
                    rematchWaiting || (mode !== "solo" && !connected.current)
                  }
                >
                  {mode !== "solo" && !connected.current
                    ? "あいてが おわったよ"
                    : rematchWaiting
                      ? "あいてを まっているよ"
                      : view.format === "duel" ? "もういちど" : "もういちど"}{" "}
                  <span>↻</span>
                </button>
                <button className="secondary-button" aria-disabled={!resultReady} {...resultAction("leave", leave)}>
                  どうぶつを えらぶ
                </button>
              </div>
            </section>
          )}
        </>
      )}
      {interrupted && screen === "play" && (
        <div className="overlay">
          <section className="lobby-panel">
            <p className="eyebrow">つうしんが きれたよ</p>
            <h2>もういちど あそぼう</h2>
            <p className="touch-note">
              つうしんが きれたので、このゲームは おしまい。もういちど はじめてね。
            </p>
            <button className="primary-button" onClick={leave}>
              どうぶつを えらぶ <span>→</span>
            </button>
          </section>
        </div>
      )}
      {recording && (
        <button className="recording-indicator" onClick={toggleRecord}>
          ● ろくがちゅう・おして ほぞん
        </button>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="とじる" onClick={() => setError("")}>
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
        <div className="rotate-hint">↻ よこにすると ひろく みえるよ</div>
      )}
      {showReport && (
        <aside className="performance-panel">
          <h3>うごきの きろく</h3>
          <p>
            このブラウザの うごきを きろくするよ。
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
            きろくを はじめる
          </button>
          <button className="secondary-button" onClick={downloadReport}>
            きろくを ほぞん
          </button>
          <button
            className="secondary-button"
            onClick={() => void captureFrame()}
          >
            しゃしんを ほぞん
          </button>
          <button className="secondary-button" onClick={toggleRecord}>
            {recording ? "ろくがを とめて ほぞん" : "ろくがする"}
          </button>
        </aside>
      )}
      <footer className="edition-footer">
        <span>アニマルレーサー</span>
        <span>
          {screen === "play"
            ? "アニマルレーサー"
            : "はしって たたかって トロフィー！"}
        </span>
      </footer>
    </main>
  );
}
