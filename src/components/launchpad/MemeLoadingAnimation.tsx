import { useEffect, useState, useRef } from "react";

/* ── cyber status messages ── */
const STATUS_LINES = [
  "●●● NEURAL_FABRICATION v4.2.1...",
  "[SYS] Initializing quantum entropy pool...",
  "[MEME] Scanning viral vector space... 47%",
  "[GEN] Synthesizing semantic payload...",
  "[IMG] Rendering holographic archetype...",
  "[NET] Calibrating memetic resonance...",
  "[SYS] Frontrun probability: 0.00%",
  "Singularity imminent — memetic convergence approaching critical mass!",
];

/* ── Floating particle canvas ── */
function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    };
    resize();

    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 220, 255, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 220, 255, ${p.alpha})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${className ?? ""}`} />;
}

/* ── Typewriter text with glitch ── */
function GlitchTypewriter({ text, speed = 35 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const iv = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(iv);
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  useEffect(() => {
    const iv = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 80);
    }, 2400 + Math.random() * 1200);
    return () => clearInterval(iv);
  }, []);

  return (
    <span className={glitch ? "neural-glitch-text" : ""}>
      {displayed}
      <span className="neural-cursor">▌</span>
    </span>
  );
}

/* ── HUD stat badge ── */
function HudBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="neural-hud-badge"
      style={{ borderColor: color, color }}
    >
      <span className="text-[8px] uppercase tracking-widest opacity-60">{label}</span>
      <span className="text-[10px] font-mono font-bold">{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN: MemeLoadingAnimation (avatar area)
   ═══════════════════════════════════════════════ */
export function MemeLoadingAnimation() {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setPulse((p) => !p);
    }, 1600);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl neural-forge-bg">
      {/* Particle network */}
      <ParticleField />

      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-16 h-16 rounded-full transition-all duration-700 ${pulse ? "neural-core-glow-active" : "neural-core-glow"}`}
        />
      </div>

      {/* Center neural core */}
      <div className="relative z-10 flex items-center justify-center">
        <div className="neural-core-ring">
          <div className="neural-core-inner">
            {/* Rotating circuit arcs */}
            <svg viewBox="0 0 48 48" className="w-12 h-12 neural-spin-slow">
              <circle cx="24" cy="24" r="20" fill="none" stroke="url(#cyanGrad)" strokeWidth="1" strokeDasharray="8 12" opacity="0.6" />
              <circle cx="24" cy="24" r="16" fill="none" stroke="url(#magentaGrad)" strokeWidth="0.5" strokeDasharray="4 8" opacity="0.4" />
              <defs>
                <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00dcff" />
                  <stop offset="100%" stopColor="#0ff0b0" />
                </linearGradient>
                <linearGradient id="magentaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e040fb" />
                  <stop offset="100%" stopColor="#7c4dff" />
                </linearGradient>
              </defs>
            </svg>
            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#00dcff] neural-core-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none neural-scanlines" />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN: MemeLoadingText (info area)
   ═══════════════════════════════════════════════ */
export function MemeLoadingText() {
  const [lineIdx, setLineIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setLineIdx((i) => (i + 1) % STATUS_LINES.length);
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8 + 2, 95));
    }, 400);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="space-y-2.5">
      {/* Neural tube progress */}
      <div className="neural-tube">
        <div className="neural-tube-fill" style={{ width: `${progress}%` }}>
          <div className="neural-tube-spark" />
        </div>
        <div className="neural-tube-label">
          <GlitchTypewriter text="NEURAL SYNTHESIS..." speed={50} />
        </div>
      </div>

      {/* Terminal output line */}
      <div className="neural-terminal-line">
        <span className="text-[10px] font-mono leading-tight">
          <GlitchTypewriter key={lineIdx} text={STATUS_LINES[lineIdx]} speed={25} />
        </span>
      </div>

      {/* HUD badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <HudBadge label="Entropy" value="99%" color="#00dcff" />
        <HudBadge label="Viral" value="Rising" color="#e040fb" />
        <HudBadge label="Frontrun" value="0.00%" color="#0ff0b0" />
      </div>
    </div>
  );
}
