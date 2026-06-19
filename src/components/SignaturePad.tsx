import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number; w: number };
type Stroke = { color: string; points: Point[] };

export type SignaturePadHandle = {
  clear: () => void;
  undo: () => void;
  isEmpty: () => boolean;
  toPNG: (background?: string | null) => string | null;
};

type Props = {
  color: string;
  size: number;
  onChange?: (isEmpty: boolean) => void;
  className?: string;
};

/**
 * Vector-based signature pad.
 * - Pointer Events: mouse, touch and pen unified (pressure-aware width).
 * - Retina-crisp via devicePixelRatio scaling.
 * - Real undo/redraw because strokes are stored as vectors, not pixels.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  ({ color, size, onChange, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const activeRef = useRef<Stroke | null>(null);
    const colorRef = useRef(color);
    const sizeRef = useRef(size);
    const dprRef = useRef(1);
    const [empty, setEmpty] = useState(true);

    colorRef.current = color;
    sizeRef.current = size;

    const emit = useCallback(
      (isEmpty: boolean) => {
        setEmpty(isEmpty);
        onChange?.(isEmpty);
      },
      [onChange],
    );

    // (Re)configure the backing store for the current CSS size + DPR.
    const setupCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
    }, []);

    const redraw = useCallback(() => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;
      ctx.clearRect(
        0,
        0,
        canvas.width / dprRef.current,
        canvas.height / dprRef.current,
      );
      for (const stroke of strokesRef.current) {
        const pts = stroke.points;
        if (pts.length === 0) continue;
        ctx.strokeStyle = stroke.color;
        if (pts.length === 1) {
          // single tap → dot
          ctx.beginPath();
          ctx.fillStyle = stroke.color;
          ctx.arc(pts[0].x, pts[0].y, pts[0].w / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        // Continuous stroke with per-segment width (pressure) and round joins.
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];
          ctx.beginPath();
          ctx.lineWidth = curr.w;
          ctx.moveTo(prev.x, prev.y);
          // quadratic through the segment midpoint keeps curves smooth without gaps
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();
        }
      }
    }, []);

    useEffect(() => {
      setupCanvas();
      redraw();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ro = new ResizeObserver(() => {
        setupCanvas();
        redraw();
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    }, [setupCanvas, redraw]);

    const pointFrom = (e: React.PointerEvent): Point => {
      const rect = canvasRef.current!.getBoundingClientRect();
      // pen/touch report 0..1 pressure; mouse reports 0 → use neutral 0.5
      const pressure = e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0.5;
      const w = sizeRef.current * (0.6 + pressure * 0.9);
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, w };
    };

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      const stroke: Stroke = { color: colorRef.current, points: [pointFrom(e)] };
      activeRef.current = stroke;
      strokesRef.current.push(stroke);
      redraw();
      if (empty) emit(false);
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const stroke = activeRef.current;
      if (!stroke) return;
      e.preventDefault();
      // coalesced events → smoother high-frequency capture
      const events =
        typeof e.nativeEvent.getCoalescedEvents === "function"
          ? e.nativeEvent.getCoalescedEvents()
          : [e.nativeEvent];
      const rect = canvasRef.current!.getBoundingClientRect();
      for (const ev of events.length ? events : [e.nativeEvent]) {
        const pressure =
          ev.pressure > 0 && ev.pressure !== 0.5 ? ev.pressure : 0.5;
        stroke.points.push({
          x: ev.clientX - rect.left,
          y: ev.clientY - rect.top,
          w: sizeRef.current * (0.6 + pressure * 0.9),
        });
      }
      redraw();
    };

    const endStroke = () => {
      activeRef.current = null;
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        strokesRef.current = [];
        activeRef.current = null;
        redraw();
        emit(true);
      },
      undo: () => {
        strokesRef.current.pop();
        redraw();
        emit(strokesRef.current.length === 0);
      },
      isEmpty: () => strokesRef.current.length === 0,
      toPNG: (background = null) => {
        const src = canvasRef.current;
        if (!src || strokesRef.current.length === 0) return null;
        // Re-render at full backing resolution onto an export canvas.
        const out = document.createElement("canvas");
        out.width = src.width;
        out.height = src.height;
        const octx = out.getContext("2d");
        if (!octx) return null;
        if (background) {
          octx.fillStyle = background;
          octx.fillRect(0, 0, out.width, out.height);
        }
        octx.drawImage(src, 0, 0);
        return out.toDataURL("image/png");
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Área de assinatura. Use o mouse, o dedo ou a caneta para assinar."
        className={cn("paper-surface block h-full w-full rounded-md", className)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      />
    );
  },
);

SignaturePad.displayName = "SignaturePad";
