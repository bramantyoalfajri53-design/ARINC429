import { useEffect, useRef } from "react";
import type { ChartSeries } from "../types";

export function StripChart({ series, height = 96 }: { series: ChartSeries[]; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#05080c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (const s of series) {
      if (s.values.length < 2) continue;
      const max = Math.max(...s.values, 0.01);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const x = (i / Math.max(s.values.length - 1, 1)) * (w - 2) + 1;
        const y = h - 4 - (v / max) * (h - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [series, height]);
  return <canvas ref={canvasRef} className="stripchart" width={520} height={height} />;
}

