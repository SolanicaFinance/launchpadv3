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
    if (!canvas || data.length < 2) return;

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

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const isUp = data[data.length - 1] >= data[0];

    const lineColor = isUp ? "34, 197, 94" : "239, 68, 68";

    const stepX = width / (data.length - 1);
    const padY = 6;
    const chartH = height - padY * 2;

    const getY = (v: number) => padY + chartH - ((v - min) / range) * chartH;

    // Draw line
    ctx.beginPath();
    ctx.moveTo(0, getY(data[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(i * stepX, getY(data[i]));
    }
    ctx.strokeStyle = `rgba(${lineColor}, 0.3)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw gradient fill
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${lineColor}, 0.15)`);
    gradient.addColorStop(1, `rgba(${lineColor}, 0.01)`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [data]);

  if (data.length < 2) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
});
