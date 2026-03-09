import { memo, useRef, useEffect } from "react";

interface SparklineCanvasProps {
  data: number[];
  seed?: string;
}

/** Hash a string into a deterministic integer */
function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Seeded pseudo-random number generator (0-1) */
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 9301 + index * 49297 + 233280) * 49297;
  return x - Math.floor(x);
}

/** Generate unique synthetic curve when data is flat or has ≤1 point */
function normalizeFlatData(data: number[], seed: string): number[] {
  const mean = data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 1;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  // If range < 0.1% of mean, data is effectively flat
  if (data.length <= 2 || mean === 0 || range / Math.abs(mean) < 0.001) {
    const h = hashString(seed);
    const numPoints = 24;
    const amplitude = Math.abs(mean) * 0.015 || 0.005;
    // Use hash to vary frequency and phase per token
    const freq1 = 0.15 + (h % 100) / 500;        // 0.15 - 0.35
    const freq2 = 0.08 + ((h >> 8) % 100) / 800;  // 0.08 - 0.205
    const phase1 = (h % 360) * Math.PI / 180;
    const phase2 = ((h >> 4) % 360) * Math.PI / 180;
    const drift = ((h % 7) - 3) * amplitude * 0.3; // slight overall trend

    const result: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const wave = Math.sin(i * freq1 + phase1) * 0.6
                 + Math.sin(i * freq2 + phase2) * 0.4
                 + (seededRandom(h, i) - 0.5) * 0.3;
      result.push(mean + wave * amplitude + drift * t);
    }
    return result;
  }
  return data;
}

export const SparklineCanvas = memo(function SparklineCanvas({
  data,
  seed = "",
}: SparklineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 1) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Normalize flat data with unique seed
    const normalized = normalizeFlatData(
      data.length === 1 ? [data[0], data[0]] : data,
      seed
    );
    const points = normalized.length < 2 ? [normalized[0], normalized[0]] : normalized;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const isUp = points[points.length - 1] >= points[0];

    const lineColor = isUp ? "34, 197, 94" : "239, 68, 68";

    // Full width
    const chartLeft = 0;
    const chartWidth = width;
    const padY = 8;
    const chartH = height - padY * 2;

    const stepX = chartWidth / (points.length - 1);
    const getX = (i: number) => chartLeft + i * stepX;
    const getY = (v: number) => padY + chartH - ((v - min) / range) * chartH;

    const coords = points.map((v, i) => ({ x: getX(i), y: getY(v) }));

    // Draw smooth curve
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);

    if (coords.length === 2) {
      ctx.lineTo(coords[1].x, coords[1].y);
    } else {
      for (let i = 0; i < coords.length - 1; i++) {
        const xMid = (coords[i].x + coords[i + 1].x) / 2;
        const yMid = (coords[i].y + coords[i + 1].y) / 2;
        ctx.quadraticCurveTo(coords[i].x, coords[i].y, xMid, yMid);
      }
      const last = coords[coords.length - 1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.strokeStyle = `rgba(${lineColor}, 0.7)`;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Gradient fill
    ctx.lineTo(chartLeft + chartWidth, height);
    ctx.lineTo(chartLeft, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${lineColor}, 0.35)`);
    gradient.addColorStop(1, `rgba(${lineColor}, 0.02)`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [data, seed]);

  if (data.length < 1) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
});
