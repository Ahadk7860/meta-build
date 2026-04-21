"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

const TARGET = new Date("2026-09-01T00:00:00").getTime();

const PHASES = [
  { name: "Build", pct: 62, detail: "Systems, infra, surfaces." },
  { name: "Refine", pct: 28, detail: "Polish, pace, precision." },
  { name: "Ship", pct: 10, detail: "One deadline. No slippage." },
];

const ENERGY_LINES = [
  "No excuses. Just output.",
  "Move with intent.",
  "Ship is a verb.",
  "The clock doesn't negotiate.",
  "Discipline compounds.",
];

function useCountdown(target: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = now === null ? null : Math.max(0, target - now);
  if (diff === null) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: false, ready: false };
  }
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds, done: diff === 0, ready: true };
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[84px] xs:w-24 sm:w-32 md:w-40 lg:w-44 h-24 sm:h-32 md:h-40 lg:h-44 rounded-2xl md:rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden shadow-[0_0_60px_-20px_rgba(120,140,255,0.35)]">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.08] via-transparent to-black/20" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/5" />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={display}
            initial={{ y: "-55%", opacity: 0, filter: "blur(6px)" }}
            animate={{ y: "-50%", opacity: 1, filter: "blur(0px)" }}
            exit={{ y: "-45%", opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-1/2 text-center font-semibold tabular-nums tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {display}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-3 text-[10px] sm:text-xs uppercase tracking-[0.28em] text-white/40">
        {label}
      </div>
    </div>
  );
}

function CursorGlow() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 120, damping: 20, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 120, damping: 20, mass: 0.5 });
  const bg = useTransform(
    [sx, sy] as any,
    ([lx, ly]: number[]) =>
      `radial-gradient(600px circle at ${lx}px ${ly}px, rgba(130,150,255,0.10), transparent 55%)`
  );

  useEffect(() => {
    const handle = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", handle);
    return () => window.removeEventListener("pointermove", handle);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ backgroundImage: bg as any }}
    />
  );
}

function RotatingLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % ENERGY_LINES.length), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative h-14 sm:h-20 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ y: 24, opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -24, opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-2xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white/90"
        >
          {ENERGY_LINES[i]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Orb({
  className,
  delay = 0,
}: {
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2, delay }}
      className={`absolute rounded-full blur-3xl animate-drift ${className}`}
    />
  );
}

function ProgressBar({ pct, delay }: { pct: number; delay: number }) {
  return (
    <div className="relative h-[2px] w-full bg-white/10 overflow-hidden rounded-full">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1.4, delay, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-white/60 via-white to-white/60"
      />
    </div>
  );
}

export default function Page() {
  const { days, hours, minutes, seconds, done, ready } = useCountdown(TARGET);
  const startedAt = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 1000);
    return () => clearInterval(id);
  }, []);
  const sessionTime = useMemo(() => {
    const s = Math.floor(elapsed / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, [elapsed]);

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <div aria-hidden className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050507]" />
        <Orb className="w-[44rem] h-[44rem] -left-40 -top-40 bg-indigo-600/25" />
        <Orb
          className="w-[38rem] h-[38rem] -right-40 top-20 bg-fuchsia-500/20"
          delay={0.4}
        />
        <Orb
          className="w-[30rem] h-[30rem] left-1/3 bottom-[-10rem] bg-sky-500/20"
          delay={0.8}
        />
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 noise opacity-[0.35] mix-blend-overlay" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <CursorGlow />

      {/* NAV */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex items-center gap-3"
        >
          <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)] animate-pulse-slow" />
          <span className="text-xs uppercase tracking-[0.3em] text-white/70">
            Meta Build / Live
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="hidden sm:flex items-center gap-6 text-xs uppercase tracking-[0.28em] text-white/50"
        >
          <span>Session {sessionTime}</span>
          <span className="text-white/30">•</span>
          <span>Deadline 09.01.26</span>
        </motion.div>
      </header>

      {/* HERO */}
      <section className="relative z-10 px-6 sm:px-10 pt-10 sm:pt-16 pb-24 sm:pb-32 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-white/60"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          The clock is running
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-[44px] leading-[1.02] sm:text-7xl md:text-8xl lg:text-[120px] font-semibold tracking-[-0.035em]"
        >
          <span className="shimmer-text animate-shimmer">
            {done ? "We Ship Today." : "The Meta Build"}
          </span>
          <br />
          <span className="text-white/50 font-normal">
            {done ? "Zero hour." : "begins now."}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-6 max-w-xl text-base sm:text-lg text-white/55 leading-relaxed"
        >
          Execution defines everything. Deadline:{" "}
          <span className="text-white">September 1, 2026.</span> Every hour on
          this clock is a decision.
        </motion.p>

        {/* COUNTDOWN */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 24 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mt-14 sm:mt-20"
        >
          {done ? (
            <div className="text-3xl sm:text-5xl font-medium tracking-tight text-white">
              We Ship Today.
            </div>
          ) : (
            <div className="flex items-center gap-3 sm:gap-5 md:gap-7">
              <TimeBlock value={days} label="Days" />
              <div className="text-white/20 text-4xl sm:text-6xl font-light pb-6">
                :
              </div>
              <TimeBlock value={hours} label="Hours" />
              <div className="text-white/20 text-4xl sm:text-6xl font-light pb-6">
                :
              </div>
              <TimeBlock value={minutes} label="Minutes" />
              <div className="text-white/20 text-4xl sm:text-6xl font-light pb-6">
                :
              </div>
              <TimeBlock value={seconds} label="Seconds" />
            </div>
          )}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6 }}
          className="mt-14 sm:mt-20 flex flex-wrap items-center gap-4"
        >
          <a
            href="#sprint"
            className="group relative inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-medium tracking-tight transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,255,255,0.35)]"
          >
            Enter Build Mode
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>
          <a
            href="#sprint"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.02] backdrop-blur px-6 py-3 text-sm font-medium text-white/80 hover:text-white hover:border-white/30 transition-all"
          >
            View Progress
            <span className="opacity-50 group-hover:opacity-100 transition-opacity">↗</span>
          </a>
        </motion.div>
      </section>

      {/* SPRINT */}
      <section id="sprint" className="relative z-10 px-6 sm:px-10 py-24 sm:py-32 max-w-7xl mx-auto">
        <div className="flex items-baseline justify-between gap-6 mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl sm:text-6xl font-semibold tracking-[-0.03em]"
          >
            The Sprint
          </motion.h2>
          <span className="text-xs uppercase tracking-[0.28em] text-white/40 hidden sm:block">
            03 Phases / 01 Deadline
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PHASES.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="group relative rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8 overflow-hidden hover:border-white/20 transition-colors"
            >
              <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-indigo-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="flex items-center justify-between mb-10">
                <span className="text-xs uppercase tracking-[0.28em] text-white/40">
                  Phase 0{i + 1}
                </span>
                <span className="text-xs tabular-nums text-white/50">{p.pct}%</span>
              </div>
              <div className="text-4xl sm:text-5xl font-semibold tracking-tight mb-2">
                {p.name}
              </div>
              <div className="text-white/50 text-sm mb-10">{p.detail}</div>
              <ProgressBar pct={p.pct} delay={i * 0.12} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ENERGY */}
      <section className="relative z-10 px-6 sm:px-10 py-24 sm:py-40 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1 }}
          className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-xl p-10 sm:p-16"
        >
          <div className="text-xs uppercase tracking-[0.3em] text-white/40 mb-6">
            Standing order
          </div>
          <h3 className="text-5xl sm:text-7xl font-semibold tracking-[-0.03em] mb-10">
            No excuses.
            <br />
            <span className="text-white/50">Just output.</span>
          </h3>
          <RotatingLine />
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 px-6 sm:px-10 py-10 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.28em] text-white/35">
        <span>Meta Build — 2026</span>
        <span>We are on a clock.</span>
      </footer>
    </main>
  );
}
