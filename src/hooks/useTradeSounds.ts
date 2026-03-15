import { useCallback, useRef } from "react";

const SOUNDS_KEY = "pulse-sounds-enabled";

/** Sounds are ON by default for all visitors */
function getSoundsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUNDS_KEY);
    // Default to ON if never set
    if (stored === null) return true;
    return stored === "true";
  } catch {
    return true;
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
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// ─── Sound Presets ───
// Change these to customize buy/sell sounds.
// Each preset defines frequency sweep + duration for the WebAudio tone,
// OR you can switch to .mp3/.wav files (see playAudioFile below).

type SoundPreset = "arcade" | "subtle" | "cash-register" | "custom-file";

// Change this to switch sound styles globally:
const ACTIVE_PRESET: SoundPreset = "arcade";

// ─── Tone presets (WebAudio oscillator) ───
const TONE_PRESETS: Record<string, { buy: [number, number, number, OscillatorType]; sell: [number, number, number, OscillatorType]; launch: [number, number, number, OscillatorType] }> = {
  arcade: {
    buy:  [600, 900, 0.1, "square"],   // ascending chirp
    sell: [500, 300, 0.1, "square"],   // descending chirp
    launch: [400, 1200, 0.15, "sine"],  // rising fanfare
  },
  subtle: {
    buy:  [800, 1000, 0.06, "sine"],
    sell: [600, 400, 0.06, "sine"],
    launch: [500, 1000, 0.1, "sine"],
  },
  "cash-register": {
    buy:  [1200, 1600, 0.05, "triangle"],
    sell: [800, 500, 0.05, "triangle"],
    launch: [600, 1400, 0.08, "triangle"],
  },
};

// ─── Custom audio file paths (used when ACTIVE_PRESET = "custom-file") ───
// Place your .mp3 or .wav files in /public/sounds/ and update paths here:
const CUSTOM_BUY_SOUND = "/sounds/buy.mp3";
const CUSTOM_SELL_SOUND = "/sounds/sell.mp3";
const CUSTOM_LAUNCH_SOUND = "/sounds/launch.mp3";

function playTone(freqStart: number, freqEnd: number, duration: number, waveType: OscillatorType = "square") {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveType;
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration + 0.02);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch (e) {
    console.warn("[TradeSounds] tone error:", e);
  }
}

function playAudioFile(src: string) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {}
}

function playBuySound() {
  if (ACTIVE_PRESET === "custom-file") {
    playAudioFile(CUSTOM_BUY_SOUND);
  } else {
    const [f1, f2, dur, wave] = TONE_PRESETS[ACTIVE_PRESET]?.buy ?? TONE_PRESETS.arcade.buy;
    playTone(f1, f2, dur, wave);
  }
}

function playSellSound() {
  if (ACTIVE_PRESET === "custom-file") {
    playAudioFile(CUSTOM_SELL_SOUND);
  } else {
    const [f1, f2, dur, wave] = TONE_PRESETS[ACTIVE_PRESET]?.sell ?? TONE_PRESETS.arcade.sell;
    playTone(f1, f2, dur, wave);
  }
}

function playLaunchSound() {
  if (ACTIVE_PRESET === "custom-file") {
    playAudioFile(CUSTOM_LAUNCH_SOUND);
  } else {
    const [f1, f2, dur, wave] = TONE_PRESETS[ACTIVE_PRESET]?.launch ?? TONE_PRESETS.arcade.launch;
    // Play a two-tone fanfare for launches
    playTone(f1, f2, dur, wave);
    setTimeout(() => playTone(f2, f2 + 200, dur * 0.8, wave), dur * 1000 + 30);
  }
}

export function useTradeSounds() {
  const enabledRef = useRef(getSoundsEnabled());

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setSoundsEnabled(next);
    // Resume audio context on user gesture
    if (next) getAudioCtx();
    return next;
  }, []);

  const playBuy = useCallback(() => {
    if (!enabledRef.current) return;
    playBuySound();
  }, []);

  const playSell = useCallback(() => {
    if (!enabledRef.current) return;
    playSellSound();
  }, []);

  const playLaunch = useCallback(() => {
    if (!enabledRef.current) return;
    playLaunchSound();
  }, []);

  return {
    enabled: enabledRef.current,
    toggle,
    playBuy,
    playSell,
    playLaunch,
    isEnabled: () => enabledRef.current,
  };
}
