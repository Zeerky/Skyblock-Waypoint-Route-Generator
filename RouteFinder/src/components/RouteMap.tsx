import { useEffect, useRef, useState } from "react";
import {
  buildRouteMapLayout,
  findHoveredPoint,
  pointAtDistance,
  type RouteMapLayout,
} from "../mapGeometry";
import type { RouteResult } from "../types";

const LOOP_MS = 14_000;
const PULSE_LENGTH_RATIO = 0.04;
const TRAIL_LENGTH_RATIO = 0.07;

interface Props {
  result: RouteResult | null;
  highlightIndex?: number | null;
}

function drawRouteMap(
  ctx: CanvasRenderingContext2D,
  layout: RouteMapLayout,
  phase: number,
  hoveredIndex: number | null,
  highlightIndex: number | null,
) {
  const { width: w, height: h, points, segments, totalLength } = layout;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0f1419";
  ctx.fillRect(0, 0, w, h);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(99, 179, 237, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  });
  ctx.stroke();

  if (totalLength > 0) {
    const pulseLen = Math.max(14, totalLength * PULSE_LENGTH_RATIO);
    const trailLen = Math.max(22, totalLength * TRAIL_LENGTH_RATIO);
    const headDist = phase * totalLength;

    const samples = Math.ceil(trailLen / 5) + 1;
    for (let s = 0; s <= samples; s++) {
      const back = (s / samples) * trailLen;
      const pos = headDist - back;
      const pt = pointAtDistance(layout, pos);
      if (!pt) continue;

      const t = 1 - s / samples;
      const alpha = t * t * 0.45;
      const radius = 1 + t * 2.5;
      const glowR = radius * 1.5;

      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowR);
      g.addColorStop(0, `rgba(120, 210, 255, ${alpha * 0.85})`);
      g.addColorStop(0.5, `rgba(59, 158, 255, ${alpha * 0.25})`);
      g.addColorStop(1, "rgba(59, 158, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    const head = pointAtDistance(layout, headDist);
    if (head) {
      const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 6);
      g.addColorStop(0, "rgba(200, 235, 255, 0.75)");
      g.addColorStop(0.4, "rgba(99, 179, 237, 0.3)");
      g.addColorStop(1, "rgba(99, 179, 237, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const pulseStart = headDist - pulseLen;
    const pulseEnd = headDist + pulseLen * 0.1;
    for (const seg of segments) {
      const segEnd = seg.cumStart + seg.length;
      if (segEnd < pulseStart || seg.cumStart > pulseEnd) continue;
      const overlap =
        Math.min(segEnd, pulseEnd) - Math.max(seg.cumStart, pulseStart);
      const intensity = Math.min(1, overlap / Math.max(seg.length, 1)) * 0.45;
      ctx.strokeStyle = `rgba(140, 210, 255, ${0.12 + intensity * 0.35})`;
      ctx.lineWidth = 1.25 + intensity * 0.75;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }
  }

  const maxBlocks = Math.max(...points.map((p) => p.wp.block_count));

  points.forEach((p) => {
    const isStart = p.index === 0;
    const isEnd = p.index === points.length - 1;
    const isHovered = hoveredIndex === p.index;
    const isHighlighted = highlightIndex === p.index;
    const active = isHovered || isHighlighted;

    const t = p.wp.block_count / maxBlocks;
    const red = Math.round(45 + t * 180);
    const green = Math.round(90 + t * 60);

    if (active) {
      ctx.fillStyle = "rgba(59, 158, 255, 0.25)";
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.radius + 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isStart
      ? "#4ade80"
      : isEnd
        ? "#f87171"
        : `rgb(${red},${green},80)`;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, active ? p.radius + 1.5 : p.radius, 0, Math.PI * 2);
    ctx.fill();

    if (active) {
      ctx.strokeStyle = "rgba(200, 230, 255, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
  ctx.font = "11px 'DM Sans', sans-serif";
  ctx.fillText("Top-down (X → right, Z → down) · glow travels start → end", 28, h - 8);
  ctx.fillStyle = "#4ade80";
  ctx.fillText("● Start", w - 120, 18);
  ctx.fillStyle = "#f87171";
  ctx.fillText("● End", w - 120, 32);
}

export function RouteMap({ result, highlightIndex = null }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<RouteMapLayout | null>(null);
  const animStartRef = useRef(performance.now());
  const rafRef = useRef(0);
  const hoveredRef = useRef<number | null>(null);
  const highlightRef = useRef<number | null>(highlightIndex);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  highlightRef.current = highlightIndex;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !result || result.waypoints.length === 0) {
      layoutRef.current = null;
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    animStartRef.current = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutRef.current = buildRouteMapLayout(
        result.waypoints,
        rect.width,
        rect.height,
      );
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const tick = (now: number) => {
      const layout = layoutRef.current;
      if (!layout) return;
      const phase = ((now - animStartRef.current) % LOOP_MS) / LOOP_MS;
      drawRouteMap(
        ctx,
        layout,
        phase,
        hoveredRef.current,
        highlightRef.current,
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [result]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const layout = layoutRef.current;
    const canvas = canvasRef.current;
    if (!layout || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const idx = findHoveredPoint(layout, mx, my);

    if (idx === hoveredRef.current) return;

    hoveredRef.current = idx;
    setHoveredIndex(idx);

    if (idx === null) {
      setTooltipPos(null);
      return;
    }

    const pt = layout.points[idx];
    setTooltipPos({ x: pt.sx, y: pt.sy });
  };

  const handleMouseLeave = () => {
    hoveredRef.current = null;
    setHoveredIndex(null);
    setTooltipPos(null);
  };

  if (!result || result.waypoints.length === 0) {
    return (
      <section className="panel map-panel empty">
        <p>Route map appears here after a successful search.</p>
      </section>
    );
  }

  const hovered =
    hoveredIndex !== null ? result.waypoints[hoveredIndex] : null;

  return (
    <section className="panel map-panel">
      <h2>Route map</h2>
      <div className="map-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="route-canvas"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {hovered && tooltipPos && (
          <div
            className="map-tooltip"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: "translate(-50%, calc(-100% - 14px))",
            }}
          >
            <span className="map-tooltip-title">
              {hoveredIndex === 0
                ? "Start"
                : hoveredIndex === result.waypoints.length - 1
                  ? "End"
                  : `Stop ${(hoveredIndex ?? 0) + 1}`}
            </span>
            <span>
              {hovered.center[0]}, {hovered.center[1]}, {hovered.center[2]}
            </span>
            <span>{hovered.block_count} coal blocks</span>
          </div>
        )}
      </div>
    </section>
  );
}
