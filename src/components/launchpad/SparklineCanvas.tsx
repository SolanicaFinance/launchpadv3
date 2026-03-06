import { memo, useRef, useEffect } from "react";

interface SparklineCanvasProps {
  data: number[];
}

export const SparklineCanvas = memo(function SparklineCanvas({
  data,
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

    const isFallback = data.every((v) => v === data[0]);

    if (isFallback) {
      // Draw a subtle half-width green line on the right side, centered vertically
      const startX = width * 0.5;
      const midY = height * 0.55;
      ctx.beginPath();
      ctx.moveTo(startX, midY);
      ctx.lineTo(width, midY);
      ctx.strokeStyle = "rgba(34, 197, 94, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Soft glow fill below line
      const grad = ctx.createLinearGradient(startX, midY, startX, height);
      grad.addColorStop(0, "rgba(34, 197, 94, 0.08)");
      grad.addColorStop(1, "rgba(34, 197, 94, 0.01)");
      ctx.fillStyle = grad;
      ctx.fillRect(startX, midY, width - startX, height - midY);
      return;
    }

    // Real data — draw on the right 60% of the card
    const offsetX = width * 0.4;
    const chartWidth = width - offsetX;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.length === 1 ? [data[0], data[0]] : data;
    const isUp = points[points.length - 1] >= points[0];

    const lineColor = isUp ? "34, 197, 94" : "239, 68, 68";

    const stepX = chartWidth / (points.length - 1);
    const padY = 6;
    const chartH = height - padY * 2;

    const getY = (v: number) => padY + chartH - ((v - min) / range) * chartH;

    // Draw line
    ctx.beginPath();
    ctx.moveTo(offsetX, getY(points[0]));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(offsetX + i * stepX, getY(points[i]));
    }
    ctx.strokeStyle = `rgba(${lineColor}, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw gradient fill
    ctx.lineTo(offsetX + chartWidth, height);
    ctx.lineTo(offsetX, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${lineColor}, 0.2)`);
    gradient.addColorStop(1, `rgba(${lineColor}, 0.01)`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [data]);

  if (data.length < 1) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
});
