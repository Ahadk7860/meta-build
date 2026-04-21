"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TARGET = new Date("2026-09-01T00:00:00").getTime();
const K_USERS = "meta-build.v2.users";
const K_ACTIVE = "meta-build.v2.active";
const K_ME = "meta-build.v2.me";
const ADMIN_CALLSIGN = "ahad";

const TAGS = ["Product", "Sales", "Coding", "Strategy"] as const;
type Tag = (typeof TAGS)[number];

type HistoryEntry = { ms: number; at: number; desc: string; tag: Tag };
type UserRow = {
  id: string;
  name: string;
  totalMs: number;
  sessions: number;
  lastActiveAt: number | null;
  history: HistoryEntry[];
};
type Active = { userId: string; startedAt: number };

const SEED: UserRow[] = [];

const fmtTimer = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};
const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};
const fmtRelative = (ms: number | null) => {
  if (!ms) return "—";
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  const m = Math.floor(d / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const focusOf = (u: UserRow) =>
  u.sessions === 0 ? 0 : Math.round(u.totalMs / u.sessions / 60_000);
const streakOf = (u: UserRow) => {
  if (u.history.length === 0) return 0;
  const days = new Set<string>();
  for (const h of u.history) {
    const d = new Date(h.at);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};
const todayMsOf = (u: UserRow) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return u.history
    .filter((h) => h.at >= start.getTime())
    .reduce((a, h) => a + h.ms, 0);
};

/* --------------------------- Countdown --------------------------- */
function useCountdown(target: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null)
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: false, ready: false };
  const d = Math.max(0, target - now);
  return {
    days: Math.floor(d / 86_400_000),
    hours: Math.floor((d % 86_400_000) / 3_600_000),
    minutes: Math.floor((d % 3_600_000) / 60_000),
    seconds: Math.floor((d % 60_000) / 1000),
    done: d === 0,
    ready: true,
  };
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[72px] xs:w-20 sm:w-28 md:w-36 lg:w-40 h-20 sm:h-28 md:h-36 lg:h-40 rounded-2xl md:rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden shadow-[0_0_60px_-20px_rgba(120,140,255,0.35)]">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.08] via-transparent to-black/20" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/5" />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={display}
            initial={{ y: "-55%", opacity: 0, filter: "blur(6px)" }}
            animate={{ y: "-50%", opacity: 1, filter: "blur(0px)" }}
            exit={{ y: "-45%", opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-1/2 text-center font-semibold tabular-nums tracking-tight text-3xl sm:text-5xl md:text-6xl lg:text-7xl"
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
      `radial-gradient(600px circle at ${lx}px ${ly}px, rgba(130,150,255,0.10), transparent 55%)`,
  );
  useEffect(() => {
    const h = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", h);
    return () => window.removeEventListener("pointermove", h);
  }, [x, y]);
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ backgroundImage: bg as any }}
    />
  );
}

function Orb({ className, delay = 0 }: { className: string; delay?: number }) {
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

/* --------------------------- Build Mode --------------------------- */
function BuildMode({
  me,
  active,
  users,
  elapsed,
  nameInput,
  setNameInput,
  onStart,
  onEnd,
  onAbort,
}: {
  me: string | null;
  active: Active | null;
  users: UserRow[];
  elapsed: number;
  nameInput: string;
  setNameInput: (v: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onAbort: () => void;
}) {
  const meUser = useMemo(() => users.find((u) => u.id === me) ?? null, [users, me]);
  const todayMs = meUser ? todayMsOf(meUser) : 0;
  const streak = meUser ? streakOf(meUser) : 0;

  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8 sm:p-10 overflow-hidden">
      <div
        aria-hidden
        className={`absolute inset-0 -z-0 transition-opacity duration-1000 ${
          active ? "opacity-100" : "opacity-0"
        } bg-[radial-gradient(circle_at_50%_0%,rgba(96,165,250,0.22),transparent_60%)]`}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${
                active
                  ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)] animate-pulse"
                  : "bg-white/30"
              }`}
            />
            <span className="text-xs uppercase tracking-[0.3em] text-white/60">
              {active ? "Build Mode · Active" : "Build Mode · Idle"}
            </span>
          </div>
          {meUser && (
            <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.28em] text-white/40">
              <span>
                Today{" "}
                <span className="text-white/80 tabular-nums">
                  {fmtDuration(todayMs)}
                </span>
              </span>
              {streak >= 2 && (
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-0.5 text-amber-200 normal-case tracking-wider">
                  {streak}-day streak
                </span>
              )}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!active ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="grid md:grid-cols-[1fr_auto] gap-4 items-end"
            >
              <div>
                <label className="block text-xs uppercase tracking-[0.28em] text-white/40 mb-3">
                  Your name
                </label>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onStart();
                  }}
                  placeholder={meUser?.name ?? "Enter callsign"}
                  className="w-full bg-transparent border-b border-white/15 focus:border-white/60 focus:outline-none text-2xl sm:text-3xl py-3 placeholder:text-white/20 tracking-tight transition-colors"
                />
              </div>
              <button
                onClick={onStart}
                disabled={!nameInput.trim() && !meUser}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-7 py-3.5 text-sm font-medium tracking-tight transition-all enabled:hover:scale-[1.02] enabled:hover:shadow-[0_0_40px_rgba(255,255,255,0.35)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Start Session
                <span className="transition-transform group-enabled:group-hover:translate-x-0.5">
                  →
                </span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-baseline justify-between gap-6 flex-wrap">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-white/40 mb-3">
                    {meUser?.name ?? "—"} · In session
                  </div>
                  <div className="font-semibold tabular-nums tracking-tight text-6xl sm:text-7xl md:text-8xl">
                    {fmtTimer(elapsed)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onAbort}
                    className="rounded-full border border-white/15 bg-white/[0.02] px-5 py-3 text-sm text-white/60 hover:text-white hover:border-white/30 transition-all"
                  >
                    Abort
                  </button>
                  <button
                    onClick={onEnd}
                    className="group inline-flex items-center gap-2 rounded-full bg-white text-black px-7 py-3.5 text-sm font-medium tracking-tight hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,255,255,0.35)] transition-all"
                  >
                    End Session
                    <span className="transition-transform group-hover:translate-x-0.5">
                      ↳
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* --------------------------- Leaderboard --------------------------- */
const rankStyle = (rank: number) => {
  if (rank === 1) return "from-amber-200/30 via-amber-200/5 to-transparent border-amber-200/30";
  if (rank === 2) return "from-slate-200/25 via-slate-200/5 to-transparent border-slate-200/25";
  if (rank === 3) return "from-orange-400/25 via-orange-400/5 to-transparent border-orange-400/25";
  return "from-white/[0.03] to-transparent border-white/10";
};

function Leaderboard({
  users,
  me,
  liveMs,
  isAdmin,
  onDeleteUser,
}: {
  users: UserRow[];
  me: string | null;
  liveMs: number;
  isAdmin: boolean;
  onDeleteUser: (id: string) => void;
}) {
  const sorted = useMemo(() => {
    return [...users]
      .map((u) => ({
        ...u,
        _effectiveTotal: u.totalMs + (u.id === me && liveMs > 0 ? liveMs : 0),
      }))
      .sort((a, b) => b._effectiveTotal - a._effectiveTotal);
  }, [users, me, liveMs]);

  const myIdx = me ? sorted.findIndex((u) => u.id === me) : -1;
  const leader = sorted[0];
  const myDeficit =
    myIdx > 0 && leader ? leader._effectiveTotal - sorted[myIdx]._effectiveTotal : 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
      <div className="flex items-baseline justify-between gap-6 px-6 sm:px-8 pt-7 pb-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" />
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]">
            Live Leaderboard
          </h3>
        </div>
        <span className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          Ranked by output
        </span>
      </div>

      <div
        className={`hidden sm:grid ${
          isAdmin
            ? "grid-cols-[40px_1fr_120px_80px_110px_90px_36px]"
            : "grid-cols-[40px_1fr_120px_80px_110px_90px]"
        } gap-4 px-6 sm:px-8 py-3 text-[10px] uppercase tracking-[0.28em] text-white/35 border-b border-white/5`}
      >
        <div>#</div>
        <div>User</div>
        <div className="text-right">Total Time</div>
        <div className="text-right">Sessions</div>
        <div className="text-right">Last Active</div>
        <div className="text-right">Focus</div>
        {isAdmin && <div />}
      </div>

      <div className="px-3 sm:px-4 py-3">
        <AnimatePresence initial={false}>
          {sorted.map((u, i) => {
            const rank = i + 1;
            const isMe = u.id === me;
            const focus = focusOf(u);
            return (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className={`relative my-1 rounded-2xl border bg-gradient-to-r ${rankStyle(
                  rank,
                )} ${isMe ? "ring-1 ring-white/30" : ""}`}
              >
                {rank <= 3 && (
                  <div
                    aria-hidden
                    className={`absolute inset-0 -z-0 rounded-2xl opacity-40 blur-2xl ${
                      rank === 1
                        ? "bg-amber-300/20"
                        : rank === 2
                        ? "bg-slate-200/15"
                        : "bg-orange-400/15"
                    }`}
                  />
                )}
                <div
                  className={`relative grid gap-4 items-center px-3 sm:px-4 py-4 ${
                    isAdmin
                      ? "sm:grid-cols-[40px_1fr_120px_80px_110px_90px_36px]"
                      : "sm:grid-cols-[40px_1fr_120px_80px_110px_90px]"
                  }`}
                >
                  <div className="flex items-center gap-3 sm:block">
                    <span
                      className={`font-semibold tabular-nums text-lg sm:text-base ${
                        rank === 1
                          ? "text-amber-200"
                          : rank === 2
                          ? "text-slate-200"
                          : rank === 3
                          ? "text-orange-300"
                          : "text-white/50"
                      }`}
                    >
                      {String(rank).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium tracking-tight truncate">
                        {u.name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] uppercase tracking-[0.25em] rounded-full border border-white/20 px-2 py-0.5 text-white/70">
                          You
                        </span>
                      )}
                      {isMe && liveMs > 0 && (
                        <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-300 flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                          live
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5 sm:hidden">
                      {fmtDuration(u._effectiveTotal)} · {u.sessions} sessions
                    </div>
                  </div>
                  <div className="hidden sm:block text-right font-medium tabular-nums">
                    {fmtDuration(u._effectiveTotal)}
                  </div>
                  <div className="hidden sm:block text-right tabular-nums text-white/60">
                    {u.sessions}
                  </div>
                  <div className="hidden sm:block text-right text-white/50 text-sm">
                    {fmtRelative(u.lastActiveAt)}
                  </div>
                  <div className="hidden sm:block text-right tabular-nums text-white/70">
                    {focus}
                    <span className="text-white/30 text-xs ml-0.5">m</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => onDeleteUser(u.id)}
                      aria-label={`Delete ${u.name}`}
                      className="hidden sm:flex items-center justify-center w-7 h-7 rounded-full text-white/30 hover:text-rose-300 hover:bg-rose-300/10 border border-transparent hover:border-rose-300/20 transition-all text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {myIdx > 0 && myDeficit > 0 && (
        <div className="px-6 sm:px-8 py-4 border-t border-white/5 bg-black/20 text-xs uppercase tracking-[0.28em] text-rose-300/80">
          You're {fmtDuration(myDeficit)} behind the leader.
        </div>
      )}
    </div>
  );
}

/* --------------------------- End Session Modal --------------------------- */
function EndSessionModal({
  ms,
  desc,
  setDesc,
  tag,
  setTag,
  onCancel,
  onSubmit,
}: {
  ms: number;
  desc: string;
  setDesc: (v: string) => void;
  tag: Tag;
  setTag: (t: Tag) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0a0a0e]/95 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]"
      >
        <div className="absolute -top-px inset-x-8 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4">
          Session complete · {fmtTimer(ms)}
        </div>
        <h3 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mb-8">
          What did you build?
        </h3>
        <textarea
          autoFocus
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          placeholder="Shipped the onboarding flow. Rewrote the deck. Closed 2."
          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-base focus:outline-none focus:border-white/30 placeholder:text-white/25 resize-none transition-colors"
        />
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">
            Tag
          </div>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`rounded-full px-4 py-1.5 text-sm border transition-all ${
                  tag === t
                    ? "bg-white text-black border-white"
                    : "border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/70 hover:text-white hover:border-white/30 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="group inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-2.5 text-sm font-medium hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,255,255,0.35)] transition-all"
          >
            Log Session
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* --------------------------- Page --------------------------- */
export default function Page() {
  const { days, hours, minutes, seconds, done, ready } = useCountdown(TARGET);

  const [hydrated, setHydrated] = useState(false);
  const [users, setUsers] = useState<UserRow[]>(SEED);
  const [me, setMe] = useState<string | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [nameInput, setNameInput] = useState("");
  const [ending, setEnding] = useState<{ ms: number } | null>(null);
  const [desc, setDesc] = useState("");
  const [tag, setTag] = useState<Tag>("Product");

  useEffect(() => {
    try {
      const u = localStorage.getItem(K_USERS);
      if (u) setUsers(JSON.parse(u));
      const m = localStorage.getItem(K_ME);
      if (m) setMe(m);
      const a = localStorage.getItem(K_ACTIVE);
      if (a) setActive(JSON.parse(a));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(K_USERS, JSON.stringify(users));
  }, [users, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (me) localStorage.setItem(K_ME, me);
    else localStorage.removeItem(K_ME);
  }, [me, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (active) localStorage.setItem(K_ACTIVE, JSON.stringify(active));
    else localStorage.removeItem(K_ACTIVE);
  }, [active, hydrated]);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Date.now() - active.startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  const startSession = useCallback(() => {
    const name = nameInput.trim();
    if (!name && !me) return;
    if (name) {
      const existing = users.find(
        (u) => u.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) {
        setMe(existing.id);
        setActive({ userId: existing.id, startedAt: Date.now() });
      } else {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `u-${Date.now()}`;
        const fresh: UserRow = {
          id,
          name,
          totalMs: 0,
          sessions: 0,
          lastActiveAt: null,
          history: [],
        };
        setUsers((prev) => [...prev, fresh]);
        setMe(id);
        setActive({ userId: id, startedAt: Date.now() });
      }
    } else if (me) {
      setActive({ userId: me, startedAt: Date.now() });
    }
    setNameInput("");
  }, [nameInput, me, users]);

  const endSession = useCallback(() => {
    if (!active) return;
    setEnding({ ms: Date.now() - active.startedAt });
  }, [active]);

  const logSession = useCallback(() => {
    if (!active || !ending) return;
    const ms = ending.ms;
    const now = Date.now();
    const userId = active.userId;
    const text = desc.trim() || "(no description)";
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              totalMs: u.totalMs + ms,
              sessions: u.sessions + 1,
              lastActiveAt: now,
              history: [{ ms, at: now, desc: text, tag }, ...u.history].slice(0, 50),
            }
          : u,
      ),
    );
    setActive(null);
    setEnding(null);
    setDesc("");
    setTag("Product");
  }, [active, ending, desc, tag]);

  const abortSession = useCallback(() => {
    setActive(null);
    setEnding(null);
  }, []);

  const meUser = useMemo(() => users.find((u) => u.id === me) ?? null, [users, me]);
  const isAdmin = !!meUser && meUser.name.trim().toLowerCase() === ADMIN_CALLSIGN;

  const deleteLog = useCallback(
    (userId: string, at: number) => {
      if (!isAdmin) return;
      if (!confirm("Delete this session log?")) return;
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          const entry = u.history.find((h) => h.at === at);
          if (!entry) return u;
          return {
            ...u,
            totalMs: Math.max(0, u.totalMs - entry.ms),
            sessions: Math.max(0, u.sessions - 1),
            history: u.history.filter((h) => h.at !== at),
          };
        }),
      );
    },
    [isAdmin],
  );

  const deleteUser = useCallback(
    (userId: string) => {
      if (!isAdmin) return;
      if (!confirm("Remove this user from the leaderboard? All their logs will be cleared.")) return;
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (me === userId) {
        setMe(null);
        setActive(null);
      }
    },
    [isAdmin, me],
  );

  const recent = useMemo(() => {
    const all = users
      .flatMap((u) => u.history.map((h) => ({ ...h, user: u.name, userId: u.id })))
      .sort((a, b) => b.at - a.at)
      .slice(0, 5);
    return all;
  }, [users]);

  const sessionDisplay = useMemo(() => {
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
          {active && (
            <span className="text-emerald-300 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Session {sessionDisplay}
            </span>
          )}
          <span>Deadline 09.01.26</span>
        </motion.div>
      </header>

      {/* HERO */}
      <section className="relative z-10 px-6 sm:px-10 pt-6 sm:pt-12 pb-16 sm:pb-20 max-w-7xl mx-auto">
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
          className="mt-8 text-[44px] leading-[1.02] sm:text-7xl md:text-8xl lg:text-[112px] font-semibold tracking-[-0.035em]"
        >
          <span className="shimmer-text animate-shimmer">
            {done ? "We Ship Today." : "Days Left to Build"}
          </span>
          <br />
          <span className="text-white/50 font-normal">
            {done ? "Zero hour." : "the Next Meta."}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-5 max-w-xl text-base sm:text-lg text-white/55 leading-relaxed"
        >
          Execution is tracked. Output is ranked. Deadline:{" "}
          <span className="text-white">September 1, 2026.</span>
        </motion.p>

        {/* COUNTDOWN */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 24 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mt-12 sm:mt-16"
        >
          {done ? (
            <div className="text-3xl sm:text-5xl font-medium tracking-tight text-white">
              We Ship Today.
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
              <TimeBlock value={days} label="Days" />
              <div className="text-white/20 text-3xl sm:text-5xl font-light pb-6">:</div>
              <TimeBlock value={hours} label="Hours" />
              <div className="text-white/20 text-3xl sm:text-5xl font-light pb-6">:</div>
              <TimeBlock value={minutes} label="Minutes" />
              <div className="text-white/20 text-3xl sm:text-5xl font-light pb-6">:</div>
              <TimeBlock value={seconds} label="Seconds" />
            </div>
          )}
        </motion.div>
      </section>

      {/* BUILD MODE + LEADERBOARD */}
      <section
        id="war-room"
        className="relative z-10 px-6 sm:px-10 pb-24 sm:pb-32 max-w-7xl mx-auto space-y-8"
      >
        <BuildMode
          me={me}
          active={active}
          users={users}
          elapsed={elapsed}
          nameInput={nameInput}
          setNameInput={setNameInput}
          onStart={startSession}
          onEnd={endSession}
          onAbort={abortSession}
        />

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <Leaderboard
            users={users}
            me={me}
            liveMs={elapsed}
            isAdmin={isAdmin}
            onDeleteUser={deleteUser}
          />

          <aside className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
            <div className="px-6 pt-7 pb-5 border-b border-white/5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.01em]">Recent Activity</h3>
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mt-1">
                  Last 5 sessions logged
                </div>
              </div>
              {isAdmin && (
                <span className="text-[10px] uppercase tracking-[0.28em] rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200 px-2.5 py-1">
                  Admin
                </span>
              )}
            </div>
            <div className="p-3">
              {recent.length === 0 ? (
                <div className="px-3 py-10 text-center text-white/30 text-sm">
                  No sessions yet. Be the first to log output.
                </div>
              ) : (
                <ul className="space-y-1">
                  {recent.map((r, i) => (
                    <li
                      key={`${r.userId}-${r.at}-${i}`}
                      className="group relative rounded-xl px-3 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm font-medium">{r.user}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.22em] text-white/40 tabular-nums">
                            {fmtDuration(r.ms)}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => deleteLog(r.userId, r.at)}
                              aria-label="Delete session log"
                              className="w-6 h-6 rounded-full text-white/25 hover:text-rose-300 hover:bg-rose-300/10 border border-transparent hover:border-rose-300/20 transition-all text-base leading-none opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-[13px] text-white/60 line-clamp-2 leading-snug">
                        {r.desc}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {r.tag}
                        </span>
                        <span>·</span>
                        <span>{fmtRelative(r.at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* ENERGY */}
      <section className="relative z-10 px-6 sm:px-10 py-20 sm:py-32 max-w-7xl mx-auto">
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
          <h3 className="text-5xl sm:text-7xl font-semibold tracking-[-0.03em] mb-2">
            No excuses.
          </h3>
          <h3 className="text-5xl sm:text-7xl font-semibold tracking-[-0.03em] text-white/50">
            Just output.
          </h3>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-6 sm:px-10 py-10 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.28em] text-white/35">
        <span>Meta Build — 2026</span>
        <span>We are on a clock.</span>
      </footer>

      <AnimatePresence>
        {ending && (
          <EndSessionModal
            ms={ending.ms}
            desc={desc}
            setDesc={setDesc}
            tag={tag}
            setTag={setTag}
            onCancel={() => setEnding(null)}
            onSubmit={logSession}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
