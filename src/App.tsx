import { useEffect, useRef, useState, type MouseEvent } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { Download, Eraser, Undo2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { cn } from "@/lib/utils";

const INKS = [
  { name: "Tinta azul", value: "oklch(0.42 0.12 264)" },
  { name: "Preto", value: "oklch(0.2 0.005 270)" },
  { name: "Sépia", value: "oklch(0.45 0.08 60)" },
];

export default function App() {
  const padRef = useRef<SignaturePadHandle>(null);
  const [color, setColor] = useState(INKS[0].value);
  const [size, setSize] = useState(2.6);
  const [empty, setEmpty] = useState(true);

  const handleDownload = () => {
    const url = padRef.current?.toPNG(null);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `assinatura-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  };

  const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

  const scope = useRef<HTMLElement>(null);

  // Move the amber halo to follow the cursor across the card.
  const onCardMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    e.currentTarget.style.setProperty("--gx", `${x}%`);
    e.currentTarget.style.setProperty("--gy", `${y}%`);
  };

  const springy = { type: "spring", stiffness: 400, damping: 18 } as const;

  // GSAP: reveal the title letter by letter, pop the dot, float the badge.
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".title-char", {
        yPercent: 130,
        opacity: 0,
        rotateX: -85,
        transformOrigin: "50% 100%",
        duration: 0.9,
        ease: "back.out(1.7)",
        stagger: 0.06,
        delay: 0.15,
      });
      gsap.from(".title-dot", {
        scale: 0,
        opacity: 0,
        duration: 0.6,
        ease: "back.out(3)",
        delay: 0.75,
      });
      gsap.to(".seal-badge", {
        y: -4,
        duration: 2.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  return (
    <main
      ref={scope}
      className="app-backdrop relative flex min-h-dvh flex-col items-center justify-center px-4 py-10"
    >
      <div className="relative z-10 w-full max-w-xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="seal-badge inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur"
          >
            <PenLine className="size-3.5 text-primary" />
            Assinatura eletrônica
          </motion.span>
          <h1 className="mt-4 font-serif text-6xl leading-[0.95] tracking-tight text-foreground [perspective:600px] sm:text-7xl">
            {"Assine".split("").map((ch, i) => (
              <span key={i} className="title-char inline-block">
                {ch}
              </span>
            ))}
            <span className="title-dot inline-block text-primary italic">.</span>
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease, delay: 0.6 }}
            className="mx-auto mt-3 max-w-sm text-pretty text-sm text-muted-foreground"
          >
            Desenhe sua assinatura abaixo e baixe como imagem. Tudo acontece no
            seu navegador — nada é enviado.
          </motion.p>
        </header>

        {/* Signing card */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease, delay: 0.1 }}
          className="card-wrap"
          onMouseMove={onCardMove}
        >
          <div className="card-glow" aria-hidden="true" />
          <Card className="relative z-10 overflow-hidden p-3">
            <div className="relative aspect-[2/1] w-full">
              <SignaturePad
                ref={padRef}
                color={color}
                size={size}
                onChange={setEmpty}
              />

              {/* Signature guide line + prompt (overlay, non-interactive) */}
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-5">
                <div className="relative">
                  <div className="h-px w-full bg-[var(--color-paper-line)]" />
                  <span className="absolute -left-0.5 -top-2.5 select-none text-base text-[var(--color-paper-line)]">
                    ✕
                  </span>
                </div>
              </div>

              <motion.span
                animate={{ opacity: empty ? 1 : 0 }}
                transition={{ duration: 0.35 }}
                className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-serif text-2xl italic text-[oklch(0.6_0.02_70/0.5)]"
              >
                assine aqui
              </motion.span>
            </div>
          </Card>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.25 }}
          className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Ink + thickness */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Cor da tinta">
              {INKS.map((ink) => (
                <motion.button
                  key={ink.value}
                  type="button"
                  role="radio"
                  aria-checked={color === ink.value}
                  aria-label={ink.name}
                  onClick={() => setColor(ink.value)}
                  whileHover={{ scale: 1.18 }}
                  whileTap={{ scale: 0.86 }}
                  transition={springy}
                  className={cn(
                    "size-7 rounded-full",
                    color === ink.value &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: ink.value }}
                />
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="sr-only sm:not-sr-only">Espessura</span>
              <input
                type="range"
                min={1}
                max={6}
                step={0.2}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                aria-label="Espessura do traço"
                className="ink-range h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-border accent-primary"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ y: -2 }} whileTap={{ y: 0 }} transition={springy}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => padRef.current?.undo()}
                disabled={empty}
                aria-label="Desfazer último traço"
                title="Desfazer"
              >
                <Undo2 />
              </Button>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ y: 0 }} transition={springy}>
              <Button
                variant="outline"
                onClick={() => padRef.current?.clear()}
                disabled={empty}
              >
                <Eraser />
                Limpar
              </Button>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ y: 0 }} transition={springy}>
              <Button className="btn-sheen" onClick={handleDownload} disabled={empty}>
                <Download />
                Baixar PNG
              </Button>
            </motion.div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-8 text-center text-xs text-muted-foreground/70"
        >
          Funciona com mouse, toque e caneta — pressão sensível.
        </motion.p>
      </div>
    </main>
  );
}
