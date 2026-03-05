import { useCallback, useRef } from "react";

const SOUNDS_KEY = "pulse-sounds-enabled";

function getSoundsEnabled(): boolean {
  try {
    return localStorage.getItem(SOUNDS_KEY) === "true";
  } catch {
    return false;
  }
}

function setSoundsEnabled(v: boolean) {
  try {
    localStorage.setItem(SOUNDS_KEY, v ? "true" : "false");
  } catch {}
}

let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freqStart: number, freqEnd: number, duration = 0.08) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

export function useTradeSounds() {
  const enabledRef = useRef(getSoundsEnabled());

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setSoundsEnabled(next);
    // Resume audio context on user gesture
    if (next && audioCtx?.state === "suspended") audioCtx.resume();
    return next;
  }, []);

  const playBuy = useCallback(() => {
    if (!enabledRef.current) return;
    playTone(600, 900, 0.08);
  }, []);

  const playSell = useCallback(() => {
    if (!enabledRef.current) return;
    playTone(500, 300, 0.08);
  }, []);

  return {
    enabled: enabledRef.current,
    toggle,
    playBuy,
    playSell,
    isEnabled: () => enabledRef.current,
  };
}
