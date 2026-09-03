import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAGES, PLAYER_MAX_HP, type Stage, type Question } from "@/data/stages";
import heroArt from "@/assets/hero.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Labirin Akar — RPG Bentuk Akar Matematika Kelas 10" },
      {
        name: "description",
        content:
          "Game RPG giliran untuk berlatih bentuk akar: menyederhanakan, menjumlah, mengali, merasionalkan, dan memangkatkan akar.",
      },
      { property: "og:title", content: "Labirin Akar — RPG Bentuk Akar" },
      {
        property: "og:description",
        content: "Kalahkan penjaga akar dengan menyelesaikan soal bentuk akar dengan tepat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

/* ---------- helpers ---------- */
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
};
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/* ---------- domain types ---------- */
type AnalyticsKey =
  | "penyederhanaan"
  | "penjumlahan"
  | "perkalian"
  | "rasionalisasi"
  | "pemangkatan";
type Analytics = Record<AnalyticsKey, { benar: number; salah: number }>;
type ItemKey = "potion" | "shield" | "revive" | "skip";
type Inventory = Record<ItemKey, number>;
type LeaderEntry = { name: string; score: number; hp: number; coins: number; title: string };
type ParryQuestion = { q: string; opts: number[]; a: number };
type ParryPhase = {
  question: ParryQuestion;
  moveType: number;
  moveName: string;
  choice: number | null;
  result: "pending" | "success" | "fail";
};

const EMPTY_ANALYTICS: Analytics = {
  penyederhanaan: { benar: 0, salah: 0 },
  penjumlahan: { benar: 0, salah: 0 },
  perkalian: { benar: 0, salah: 0 },
  rasionalisasi: { benar: 0, salah: 0 },
  pemangkatan: { benar: 0, salah: 0 },
};

const STAGE_TOPIC: AnalyticsKey[] = [
  "penyederhanaan",
  "penjumlahan",
  "perkalian",
  "rasionalisasi",
  "pemangkatan",
  "penyederhanaan",
];

const ATTACK_NAMES: Record<number, string> = {
  0: "Replikasi Akar",
  1: "Serapan Energi",
  2: "Serangan Ganda",
  3: "Ilusi Akar",
  4: "Lonjakan Eksponen",
  5: "Akar Pengikat",
};

// Higher stages have objectively harder questions (rationalization, combined
// forms at the boss), so the window grows with the stage instead of shrinking —
// difficulty comes from the math itself, not from an ever-tighter clock.
const ANSWER_WINDOW_MS = (stageId: number) => 8000 + stageId * 700; // 8s (stage 1) → 11.5s (boss)
const PARRY_WINDOW_MS = (stageId: number) => 3500 + stageId * 300; // 3.5s (stage 1) → 5s (boss)

const genParryQuestion = (level: number): ParryQuestion => {
  let a: number;
  let b: number;
  let answer: number;
  let qStr: string;
  if (level <= 0) {
    a = rand(1, 9);
    b = rand(1, 9);
    answer = a + b;
    qStr = `${a} + ${b}`;
  } else if (level === 1) {
    a = rand(10, 19);
    b = rand(1, 9);
    const sub = Math.random() < 0.5;
    answer = sub ? a - b : a + b;
    qStr = `${a} ${sub ? "−" : "+"} ${b}`;
  } else if (level === 2) {
    a = rand(2, 9);
    b = rand(2, 9);
    answer = a * b;
    qStr = `${a} × ${b}`;
  } else if (level === 3) {
    a = rand(20, 60);
    b = rand(5, 20);
    const sub = Math.random() < 0.5;
    answer = sub ? a - b : a + b;
    qStr = `${a} ${sub ? "−" : "+"} ${b}`;
  } else if (level === 4) {
    a = rand(3, 9);
    b = rand(3, 9);
    const c = rand(2, 10);
    answer = a * b + c;
    qStr = `${a} × ${b} + ${c}`;
  } else {
    a = rand(3, 9);
    b = rand(3, 9);
    const c = rand(2, 12);
    const sub = Math.random() < 0.5;
    answer = sub ? a * b - c : a * b + c;
    qStr = `${a} × ${b} ${sub ? "−" : "+"} ${c}`;
  }
  const wrongs = new Set<number>();
  let attempts = 0;
  while (wrongs.size < 3 && attempts < 50) {
    attempts++;
    const delta = (rand(-6, 6) || 1) * (1 + Math.floor(attempts / 10));
    const w = answer + delta;
    if (w !== answer && w >= 0 && !wrongs.has(w)) wrongs.add(w);
  }
  let filler = answer + 101;
  while (wrongs.size < 3) wrongs.add(filler++);
  const opts = shuffle([answer, ...Array.from(wrongs)]);
  return { q: `${qStr} = …`, opts, a: opts.indexOf(answer) };
};

const SHOP_ITEMS: {
  key: ItemKey;
  name: string;
  price: number;
  desc: string;
  icon: string;
}[] = [
  { key: "potion", name: "Ramuan Akar", price: 20, desc: "Memulihkan 30 HP.", icon: "❖" },
  { key: "shield", name: "Perisai Sekawan", price: 30, desc: "Kebal 1x jawaban salah.", icon: "◈" },
  {
    key: "revive",
    name: "Akar Kehidupan",
    price: 50,
    desc: "Bangkit otomatis dengan 20 HP.",
    icon: "✦",
  },
  { key: "skip", name: "Tebasan Mutlak", price: 40, desc: "Lewati soal, langsung benar.", icon: "⚔" },
];

const LS_KEY = "labirin-akar-leaderboard";

/* ---------- shared UI ---------- */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-3 inline-block rounded-full bg-primary/80 px-3 py-[3px] font-mono text-[10px] uppercase tracking-[0.1em] text-primary-foreground">
      {children}
    </span>
  );
}

function PrimaryButton({
  children,
  onClick,
  tone = "gold",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "gold" | "moss";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-[10px] px-4 py-[14px] font-mono text-sm font-bold tracking-wide transition-colors disabled:opacity-40 ${
        tone === "gold"
          ? "bg-primary text-primary-foreground hover:bg-primary/85"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/85"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="panel p-6">{children}</div>;
}

function HpBar({ value, max, tone }: { value: number; max: number; tone: "enemy" | "player" }) {
  return (
    <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-background/70 ring-1 ring-border/60">
      <div
        className="h-full transition-[width] duration-500"
        style={{
          width: `${(value / max) * 100}%`,
          background: tone === "enemy" ? "var(--enemy-aura)" : "var(--gradient-hp)",
        }}
      />
    </div>
  );
}

function CoinBadge({ coins }: { coins: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-surface-raised px-3 py-1 font-mono text-xs text-primary">
      <span className="text-sm">◉</span> {coins} Koin
    </span>
  );
}

/* ---------- game ---------- */
type Screen =
  | "menu"
  | "materi"
  | "shop"
  | "leaderboard"
  | "stats"
  | "intro"
  | "map"
  | "brief"
  | "battle"
  | "win"
  | "lose"
  | "ending";

type FloatText = { id: number; text: string; tone: "enemy" | "player"; crit?: boolean };

function Game() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [progress, setProgress] = useState<number[]>([]);
  const [stage, setStage] = useState<Stage | null>(null);
  const [enemyHp, setEnemyHp] = useState(0);
  const [queue, setQueue] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [streak, setStreak] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [log, setLog] = useState("");
  const [hit, setHit] = useState<"enemy" | "player" | null>(null);
  const [crit, setCrit] = useState(false);
  const [slash, setSlash] = useState(0);
  const [floats, setFloats] = useState<FloatText[]>([]);

  /* meta progression */
  const [playerCoins, setPlayerCoins] = useState(0);
  const [inventory, setInventory] = useState<Inventory>({
    potion: 0,
    shield: 0,
    revive: 0,
    skip: 0,
  });
  const [analytics, setAnalytics] = useState<Analytics>(EMPTY_ANALYTICS);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [reward, setReward] = useState(0);
  const [teamName, setTeamName] = useState("");
  const [finalEntry, setFinalEntry] = useState<LeaderEntry | null>(null);

  /* battle modifiers */
  const [shieldOn, setShieldOn] = useState(false);
  const [enemyAtk, setEnemyAtk] = useState({ min: 0, max: 0, mult: 1 });
  const [illusionIdx, setIllusionIdx] = useState<number | null>(null);
  const [bindTurns, setBindTurns] = useState(0);
  const [enraged, setEnraged] = useState(false);
  const [timeLeftPct, setTimeLeftPct] = useState(1);
  const [parry, setParry] = useState<ParryPhase | null>(null);
  const [parryTimeLeftPct, setParryTimeLeftPct] = useState(1);

  const floatId = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setLeaderboard(JSON.parse(raw) as LeaderEntry[]);
    } catch {
      /* ignore */
    }
  }, []);

  const saveLeaderboard = (list: LeaderEntry[]) => {
    setLeaderboard(list);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  const pushFloat = (text: string, tone: "enemy" | "player", isCrit = false) => {
    const id = ++floatId.current;
    setFloats((f) => [...f, { id, text, tone, crit: isCrit }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
  };

  const item = queue[qi % Math.max(queue.length, 1)];

  const shuffled = useMemo<{ label: string; originalIndex: number }[]>(() => {
    if (!item) return [];
    return shuffle(item.opts.map((label, idx) => ({ label, originalIndex: idx })));
  }, [item, qi, queue, stage?.id]);

  const correctShuffledIndex = useMemo(
    () => shuffled.findIndex((o) => o.originalIndex === item?.a),
    [shuffled, item],
  );

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!item) return;
    setCooldown(2);
    setTimeLeftPct(1);
  }, [item, qi, queue, stage?.id]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Speed timer: once the pre-answer cooldown ends, a shrinking window starts.
  // Answering while more time remains grants a bigger damage multiplier;
  // running out of time counts as a miss and opens an enemy attack (parry) phase.
  useEffect(() => {
    if (!item || !stage) return;
    if (cooldown > 0 || choice !== null || parry) return;
    const total = ANSWER_WINDOW_MS(stage.id);
    const start = Date.now();
    setTimeLeftPct(1);
    const id = setInterval(() => {
      const pct = clamp(1 - (Date.now() - start) / total, 0, 1);
      setTimeLeftPct(pct);
      if (pct <= 0) {
        clearInterval(id);
        handleTimeout();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, qi, queue, stage?.id, cooldown, choice, parry]);

  // Parry timer: while an enemy attack is telegraphed, the player has a short
  // window to solve a quick math check to deflect it; timing out counts as a fail.
  useEffect(() => {
    if (!parry || parry.result !== "pending" || !stage) return;
    const total = PARRY_WINDOW_MS(stage.id);
    const start = Date.now();
    setParryTimeLeftPct(1);
    const id = setInterval(() => {
      const pct = clamp(1 - (Date.now() - start) / total, 0, 1);
      setParryTimeLeftPct(pct);
      if (pct <= 0) {
        clearInterval(id);
        resolveParry(false, null);
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parry?.result, stage?.id]);

  const enterBattle = useCallback((s: Stage) => {
    setStage(s);
    setEnemyHp(s.maxHp);
    setQueue(shuffle(s.pool));
    setQi(0);
    setStreak(0);
    setChoice(null);
    setLog("");
    setShieldOn(false);
    setIllusionIdx(null);
    setBindTurns(0);
    setEnraged(false);
    setEnemyAtk({ min: s.atkMin, max: s.atkMax, mult: 1 });
    setParry(null);
    setTimeLeftPct(1);
    setScreen("brief");
  }, []);

  const trackAnswer = (correct: boolean) => {
    if (!stage) return;
    const key = STAGE_TOPIC[stage.id] ?? "penyederhanaan";
    setAnalytics((a) => ({
      ...a,
      [key]: {
        benar: a[key].benar + (correct ? 1 : 0),
        salah: a[key].salah + (correct ? 0 : 1),
      },
    }));
  };

  const applyPlayerDamage = (raw: number, s: Stage) => {
    if (shieldOn) {
      setShieldOn(false);
      pushFloat("DIBLOKIR!", "player");
      setLog("Perisai Sekawan menahan serangan!");
      return;
    }
    const dmg = Math.max(1, Math.round(raw));
    const hp = playerHp - dmg;
    setHit("player");
    pushFloat(`-${dmg}`, "player");
    if (hp <= 0 && inventory.revive > 0) {
      setInventory((inv) => ({ ...inv, revive: inv.revive - 1 }));
      setPlayerHp(20);
      setLog("Akar Kehidupan aktif! Kamu bangkit dengan 20 HP.");
      pushFloat("Akar Kehidupan aktif!", "player");
      return;
    }
    setPlayerHp(clamp(hp, 0, PLAYER_MAX_HP));
    setLog(`${s.name} membalas menyerangmu sebesar ${dmg}`);
    if (hp <= 0) setTimeout(() => setScreen("lose"), 1200);
  };

  const dealDamageToEnemy = (base: number, s: Stage) => {
    let dmg = base;
    let isCrit = false;
    if (streak + 1 >= 3 && Math.random() < 0.3) {
      isCrit = true;
      dmg = Math.round(dmg * 1.5);
    }
    const hp = clamp(enemyHp - dmg, 0, s.maxHp);
    setEnemyHp(hp);
    setHit("enemy");
    setCrit(isCrit);
    setSlash((n) => n + 1);
    pushFloat(isCrit ? `CRITICAL! -${dmg}` : `-${dmg}`, "enemy", isCrit);
    if (s.boss && !enraged && hp <= s.maxHp / 2 && hp > 0) {
      setEnraged(true);
      setEnemyAtk((a) => ({ ...a, mult: a.mult * 1.5 }));
      setLog("Raja Akar Purba memasuki fase ENRAGE!");
    }
    if (hp <= 0) {
      const coins = rand(20, 30);
      setReward(coins);
      setPlayerCoins((c) => c + coins);
      setTimeout(() => {
        setProgress((p) => (p.includes(s.id) ? p : [...p, s.id]));
        setPlayerHp((h) => clamp(h + 18, 0, PLAYER_MAX_HP));
        setScreen("win");
      }, 1200);
    }
    return { dmg, isCrit, hp };
  };

  // Executes an enemy attack move. If `blocked` is true (the player parried
  // successfully), the attack is fully deflected and no damage/effects land.
  const applyEnemyMove = (moveType: number, s: Stage, blocked: boolean) => {
    if (blocked) {
      pushFloat("DITANGKIS!", "player");
      setLog(`Tangkisan sempurna! Kamu mementahkan ${ATTACK_NAMES[moveType] ?? "serangan"} milik ${s.name}.`);
      return;
    }
    const base = () => rand(enemyAtk.min, enemyAtk.max) * enemyAtk.mult;
    switch (moveType) {
      case 0: {
        const heal = Math.round(s.maxHp * 0.05);
        setEnemyHp((hp) => clamp(hp + heal, 0, s.maxHp));
        pushFloat(`+${heal} Replikasi`, "enemy");
        applyPlayerDamage(base(), s);
        break;
      }
      case 1: {
        setEnemyAtk((a) => ({ ...a, min: a.min + 2, max: a.max + 2 }));
        pushFloat("Serap! ATK naik", "enemy");
        applyPlayerDamage(base(), s);
        break;
      }
      case 2: {
        applyPlayerDamage(base(), s);
        if (Math.random() < 0.3) {
          pushFloat("Serangan Ganda!", "enemy");
          setTimeout(() => applyPlayerDamage(base(), s), 600);
        }
        break;
      }
      case 3: {
        applyPlayerDamage(base(), s);
        setIllusionIdx(Math.floor(Math.random() * 4));
        break;
      }
      case 4: {
        applyPlayerDamage(base(), s);
        setEnemyAtk((a) => ({ ...a, mult: a.mult * 1.2 }));
        pushFloat("Eksponen!", "enemy");
        break;
      }
      case 5: {
        applyPlayerDamage(base(), s);
        setBindTurns(2);
        pushFloat("Akar Pengikat!", "enemy");
        break;
      }
      default:
        applyPlayerDamage(base(), s);
    }
  };

  // Opens the parry phase: telegraphs the enemy's upcoming move (bosses draw
  // randomly from every guardian's move set) and hands the player a quick
  // math check whose difficulty scales with the stage.
  const startParry = (s: Stage) => {
    const moveType = s.boss ? rand(0, 5) : s.id;
    setParry({
      question: genParryQuestion(s.id),
      moveType,
      moveName: ATTACK_NAMES[moveType] ?? "Serangan",
      choice: null,
      result: "pending",
    });
  };

  const resolveParry = (success: boolean, chosenIdx: number | null) => {
    if (!parry || parry.result !== "pending" || !stage) return;
    const moveType = parry.moveType;
    const s = stage;
    setParry((p) => (p ? { ...p, choice: chosenIdx, result: success ? "success" : "fail" } : p));
    setTimeout(() => {
      applyEnemyMove(moveType, s, success);
      setParry(null);
    }, success ? 650 : 850);
  };

  const handleTimeout = () => {
    if (!stage || !item || choice !== null || parry) return;
    setChoice(-2);
    setStreak(0);
    trackAnswer(false);
    setLog("Waktu habis! Serangan mendekat...");
    startParry(stage);
  };

  const answer = (i: number) => {
    if (choice !== null || !stage || !item || cooldown > 0 || parry) return;
    setChoice(i);
    const correct = i === correctShuffledIndex;
    trackAnswer(correct);
    if (correct) {
      const speedMult = 1 + timeLeftPct; // 1x (last moment) .. 2x (instant)
      const next = streak + 1;
      const base = Math.round(
        (rand(stage.atkMin + 8, stage.atkMax + 10) + clamp(next - 1, 0, 5) * 3) * speedMult,
      );
      setStreak(next);
      const res = dealDamageToEnemy(base, stage);
      const speedTag = speedMult >= 1.7 ? " · ⚡ Kilat!" : speedMult >= 1.35 ? " · Cepat!" : "";
      setLog(
        `${res.isCrit ? "CRITICAL! " : ""}Tebasanmu melukai ${stage.name} sebesar ${res.dmg} · streak ${next}${speedTag}`,
      );
      if (speedMult >= 1.35) pushFloat(`x${speedMult.toFixed(1)}`, "enemy");
    } else {
      setStreak(0);
      setLog("Serangan meleset...");
      startParry(stage);
    }
    setTimeout(() => {
      setHit(null);
      setCrit(false);
    }, 500);
  };

  const nextQuestion = () => {
    setChoice(null);
    if (bindTurns > 0) setBindTurns((t) => t - 1);
    setQi((n) => {
      const next = n + 1;
      if (next >= queue.length) {
        setQueue(shuffle(stage!.pool));
        return 0;
      }
      return next;
    });
  };

  const useItem = (key: ItemKey) => {
    if (!stage || inventory[key] <= 0) return;
    if (bindTurns > 0 || parry) return;
    if (key === "potion") {
      setInventory((inv) => ({ ...inv, potion: inv.potion - 1 }));
      setPlayerHp((h) => clamp(h + 30, 0, PLAYER_MAX_HP));
      pushFloat("+30", "player");
      setLog("Ramuan Akar memulihkan 30 HP.");
    } else if (key === "shield") {
      setInventory((inv) => ({ ...inv, shield: inv.shield - 1 }));
      setShieldOn(true);
      setLog("Perisai Sekawan aktif — satu serangan akan diblokir.");
    } else if (key === "skip") {
      if (choice !== null) return;
      setInventory((inv) => ({ ...inv, skip: inv.skip - 1 }));
      const next = streak + 1;
      setStreak(next);
      const base = rand(stage.atkMin + 8, stage.atkMax + 10);
      const res = dealDamageToEnemy(base, stage);
      setChoice(correctShuffledIndex);
      setLog(`Tebasan Mutlak! ${stage.name} terkena ${res.dmg}`);
      setTimeout(() => setHit(null), 500);
    }
  };

  const buy = (key: ItemKey, price: number) => {
    if (playerCoins < price) return;
    setPlayerCoins((c) => c - price);
    setInventory((inv) => ({ ...inv, [key]: inv[key] + 1 }));
  };

  const submitScore = () => {
    const name = teamName.trim() || "Kelompok Tanpa Nama";
    const score = playerHp * 10 + playerCoins;
    const title =
      playerHp >= PLAYER_MAX_HP
        ? "Penakluk Sempurna"
        : playerHp >= 60
          ? "Penjelajah Tangguh"
          : "Penyintas Labirin";
    const entry: LeaderEntry = { name, score, hp: playerHp, coins: playerCoins, title };
    saveLeaderboard([...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 20));
    setFinalEntry(entry);
    setScreen("ending");
  };

  const allDone = progress.length === STAGES.length;
  const auraStyle = useMemo(
    () =>
      ({
        ["--enemy-aura" as string]: enraged ? "#8f2c2c" : (stage?.aura ?? "var(--gold)"),
      }) as React.CSSProperties,
    [stage, enraged],
  );

  const totals = useMemo(() => {
    const keys = Object.keys(analytics) as AnalyticsKey[];
    const benar = keys.reduce((s, k) => s + analytics[k].benar, 0);
    const salah = keys.reduce((s, k) => s + analytics[k].salah, 0);
    return { benar, salah, total: benar + salah };
  }, [analytics]);

  const startAdventure = () => {
    setPlayerHp(PLAYER_MAX_HP);
    setProgress([]);
    setScreen("intro");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[680px] flex-col px-4 pb-16 pt-8">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
        Matematika · Kelas 10 · RPG Giliran
      </p>
      <h1 className="text-center font-display text-[clamp(28px,6vw,40px)] font-bold tracking-tight">
        Labirin Akar
      </h1>
      <p className="mb-4 text-center text-sm text-muted-foreground">
        Kalahkan penjaga akar dengan menyelesaikan bentuk akar dengan tepat.
      </p>
      {screen !== "menu" && (
        <div className="mb-4 flex items-center justify-center gap-3">
          <CoinBadge coins={playerCoins} />
        </div>
      )}

      {screen === "menu" && (
        <Panel>
          <div className="text-center">
            <Tag>Menu Utama</Tag>
            <div className="mb-4 flex justify-center">
              <img
                src={heroArt}
                alt="Ilustrasi anime penjelajah pembawa pedang emas"
                width={768}
                height={768}
                className="anim-idle h-40 w-40 object-contain drop-shadow-[0_12px_24px_oklch(0_0_0/0.5)]"
              />
            </div>
            <div className="mb-5 flex justify-center">
              <CoinBadge coins={playerCoins} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <PrimaryButton onClick={startAdventure}>⚔ Petualangan</PrimaryButton>
            <PrimaryButton tone="moss" onClick={() => setScreen("materi")}>
              📜 Gulungan Materi
            </PrimaryButton>
            <PrimaryButton tone="moss" onClick={() => setScreen("shop")}>
              ◉ Kedai Penjelajah
            </PrimaryButton>
            <PrimaryButton tone="moss" onClick={() => setScreen("leaderboard")}>
              ♛ Papan Peringkat
            </PrimaryButton>
            <PrimaryButton tone="moss" onClick={() => setScreen("stats")}>
              ▤ Statistik
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {screen === "materi" && (
        <Panel>
          <Tag>Gulungan Materi</Tag>
          <div className="flex flex-col gap-3">
            {[
              {
                t: "Menyederhanakan",
                r: "√(a²·b) = a√b",
                c: "√72 = √(36·2) = 6√2",
              },
              {
                t: "Penjumlahan & Pengurangan",
                r: "a√c ± b√c = (a ± b)√c",
                c: "√50 + √8 = 5√2 + 2√2 = 7√2",
              },
              {
                t: "Perkalian",
                r: "√a × √b = √(ab)",
                c: "3√2 × 4√3 = 12√6",
              },
              {
                t: "Merasionalkan",
                r: "a/√b = a√b / b · a/(√b±√c) kali sekawan",
                c: "4/√2 = 4√2/2 = 2√2",
              },
              {
                t: "Pemangkatan",
                r: "(a√b)² = a²b · (√a ± √b)² = a + b ± 2√(ab)",
                c: "(2√3)² = 4·3 = 12",
              },
            ].map((m) => (
              <div key={m.t} className="rounded-xl border border-border bg-surface-raised p-4">
                <p className="font-display text-base font-semibold">{m.t}</p>
                <p className="mt-1 font-mono text-sm text-primary">{m.r}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">Contoh: {m.c}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <PrimaryButton tone="moss" onClick={() => setScreen("menu")}>
              Kembali ke Menu
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {screen === "shop" && (
        <Panel>
          <Tag>Kedai Penjelajah</Tag>
          <div className="flex flex-col gap-3">
            {SHOP_ITEMS.map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-3"
              >
                <span className="text-2xl text-primary">{s.icon}</span>
                <span className="flex-1">
                  <span className="block font-display text-base font-semibold">
                    {s.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      (punya {inventory[s.key]})
                    </span>
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">{s.desc}</span>
                </span>
                <button
                  onClick={() => buy(s.key, s.price)}
                  disabled={playerCoins < s.price}
                  className="shrink-0 rounded-[10px] bg-primary px-3 py-2 font-mono text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-40"
                >
                  {s.price} ◉
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <PrimaryButton tone="moss" onClick={() => setScreen("menu")}>
              Kembali ke Menu
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {screen === "stats" && (
        <Panel>
          <Tag>Statistik</Tag>
          <p className="mb-4 font-mono text-xs text-muted-foreground">
            Total dijawab: {totals.total} · Benar {totals.benar} · Salah {totals.salah} · Akurasi{" "}
            {totals.total ? Math.round((totals.benar / totals.total) * 100) : 0}%
          </p>
          <div className="flex flex-col gap-3">
            {(Object.keys(analytics) as AnalyticsKey[]).map((k) => {
              const d = analytics[k];
              const t = d.benar + d.salah;
              const pct = t ? Math.round((d.benar / t) * 100) : 0;
              return (
                <div key={k} className="rounded-xl border border-border bg-surface-raised p-3">
                  <div className="mb-2 flex items-center justify-between font-mono text-xs">
                    <span className="capitalize">{k}</span>
                    <span className="text-muted-foreground">
                      {d.benar}✓ / {d.salah}✗ · {pct}%
                    </span>
                  </div>
                  <div className="h-[9px] overflow-hidden rounded-full bg-background/70 ring-1 ring-border/60">
                    <div
                      className="h-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, background: "var(--gradient-hp)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <PrimaryButton tone="moss" onClick={() => setScreen("menu")}>
              Kembali ke Menu
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {screen === "leaderboard" && (
        <Panel>
          <Tag>Papan Peringkat</Tag>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada kelompok yang menaklukkan labirin. Jadilah yang pertama!
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {leaderboard.map((e, i) => (
                <div
                  key={`${e.name}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-3"
                >
                  <span className="w-6 font-display text-lg font-bold text-primary">{i + 1}</span>
                  <span className="flex-1">
                    <span className="block font-display text-base font-semibold">{e.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {e.title} · HP {e.hp} · {e.coins} koin
                    </span>
                  </span>
                  <span className="font-mono text-sm text-primary">{e.score}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <PrimaryButton tone="moss" onClick={() => setScreen("menu")}>
              Kembali ke Menu
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {screen === "intro" && (
        <Panel>
          <Tag>Prolog</Tag>
          <div className="mb-5 flex justify-center">
            <img
              src={heroArt}
              alt="Ilustrasi anime penjelajah pembawa pedang emas"
              width={768}
              height={768}
              className="anim-idle h-44 w-44 object-contain drop-shadow-[0_12px_24px_oklch(0_0_0/0.5)]"
            />
          </div>
          <p className="mb-5 text-[14.5px] leading-[1.75] text-muted-foreground">
            Di bawah pohon tertua di dunia, akar-akarnya tumbuh liar tak beraturan. Enam penjaga akar
            menjaga tiap lorong labirin ini, masing-masing menguasai satu bentuk kekuatan.{" "}
            <b className="text-foreground">Kamu</b> adalah penjelajah yang dipercaya menembusnya.
            Jawaban <b className="text-foreground">benar</b> adalah tebasan; jawaban{" "}
            <b className="text-foreground">salah</b> membuka celah bagi musuh. Semakin{" "}
            <b className="text-foreground">cepat</b> kamu menjawab, semakin besar kerusakannya — dan
            saat musuh balas menyerang, kamu bisa <b className="text-foreground">menangkis</b> dengan
            soal kilat sebelum serangannya mendarat.
          </p>
          <PrimaryButton onClick={() => setScreen("map")}>Masuki Labirin</PrimaryButton>
          <div className="mt-3">
            <PrimaryButton tone="moss" onClick={() => setScreen("menu")}>
              Kembali ke Menu
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {screen === "map" && (
        <>
          <div className="mb-4 flex items-center gap-3 font-mono text-xs">
            <span>NYAWA</span>
            <HpBar value={playerHp} max={PLAYER_MAX_HP} tone="player" />
            <span>
              {playerHp}/{PLAYER_MAX_HP}
            </span>
          </div>
          <Panel>
            <Tag>Peta Labirin</Tag>
            <div className="flex flex-col gap-[10px]">
              {STAGES.map((s, i) => {
                const done = progress.includes(s.id);
                const locked = i > 0 && !progress.includes(STAGES[i - 1]!.id);
                return (
                  <button
                    key={s.id}
                    disabled={locked}
                    onClick={() => enterBattle(s)}
                    className={`flex items-center gap-4 rounded-xl border bg-surface-raised p-3 text-left transition-transform hover:translate-x-1 ${
                      done ? "border-secondary" : "border-border"
                    } ${locked ? "pointer-events-none opacity-40" : ""}`}
                  >
                    <img
                      src={s.art}
                      alt={`Karakter anime ${s.name}`}
                      loading="lazy"
                      width={768}
                      height={768}
                      className="h-14 w-14 shrink-0 rounded-full bg-background/60 object-contain ring-1 ring-border"
                    />
                    <span className="flex-1">
                      <span className="block font-display text-base font-semibold">
                        {s.name}
                        {s.boss ? " · Boss" : ""}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">{s.cat}</span>
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {done ? "Ditaklukkan" : locked ? "Terkunci" : "Siap dilawan"}
                    </span>
                  </button>
                );
              })}
            </div>
            {allDone && (
              <div className="mt-4">
                <PrimaryButton tone="moss" onClick={() => setScreen("ending")}>
                  Hadapi Akhir Labirin
                </PrimaryButton>
              </div>
            )}
            <div className="mt-3">
              <PrimaryButton tone="moss" onClick={() => setScreen("menu")}>
                Menu Utama
              </PrimaryButton>
            </div>
          </Panel>
        </>
      )}

      {screen === "brief" && stage && (
        <Panel>
          <Tag>
            {stage.boss ? "Pertarungan Terakhir" : "Pertarungan"} · {stage.cat}
          </Tag>
          <div className="mb-4 flex justify-center">
            <img
              src={stage.art}
              alt={`Karakter anime ${stage.name}`}
              loading="lazy"
              width={768}
              height={768}
              className="anim-idle h-48 w-48 object-contain drop-shadow-[0_16px_30px_oklch(0_0_0/0.55)]"
            />
          </div>
          <h2 className="mb-2 text-center font-display text-xl font-semibold">
            {stage.name} muncul!
          </h2>
          <p className="mb-3 text-center text-[14.5px] leading-relaxed text-muted-foreground">
            {stage.intro}
          </p>
          <p className="mb-5 text-center font-mono text-xs text-primary">
            ⚔ {stage.boss ? "Jurus Gabungan: menggabungkan seluruh jurus penjaga akar" : `Jurus Andalan: ${ATTACK_NAMES[stage.id]}`}
          </p>
          <PrimaryButton onClick={() => setScreen("battle")}>Bertarung</PrimaryButton>
          <div className="mt-3">
            <PrimaryButton tone="moss" onClick={() => setScreen("map")}>
              Kembali ke Peta
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {screen === "battle" && stage && item && (
        <div style={auraStyle}>
          <div className="scene relative mb-4 overflow-hidden px-4 pb-4 pt-5">
            <div className="relative flex flex-col items-center gap-2">
              <div className="relative">
                <img
                  src={stage.art}
                  alt={`Karakter anime ${stage.name}`}
                  loading="lazy"
                  width={768}
                  height={768}
                  className={`h-32 w-32 object-contain drop-shadow-[0_14px_26px_oklch(0_0_0/0.55)] ${
                    hit === "enemy" ? (crit ? "anim-hit-crit" : "anim-hit") : "anim-idle"
                  }`}
                />
                {hit === "enemy" && <span key={slash} className="slash-effect" />}
                {floats
                  .filter((f) => f.tone === "enemy")
                  .map((f) => (
                    <span
                      key={f.id}
                      className={`floating-damage ${
                        f.crit ? "text-[22px] text-primary" : "text-[18px] text-foreground"
                      }`}
                    >
                      {f.text}
                    </span>
                  ))}
              </div>
              <div className="flex w-full max-w-[300px] items-center gap-2">
                <span className="shrink-0 font-display text-sm font-semibold">
                  {stage.name}
                  {enraged ? " · ENRAGE" : ""}
                </span>
                <HpBar value={enemyHp} max={stage.maxHp} tone="enemy" />
                <span className="w-14 shrink-0 text-right font-mono text-[10.5px] text-muted-foreground">
                  {enemyHp}/{stage.maxHp}
                </span>
              </div>
            </div>

            <p className="my-3 text-center font-mono text-[10px] tracking-[0.2em] text-muted-foreground opacity-70">
              VS
            </p>

            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <img
                  src={heroArt}
                  alt="Ilustrasi anime penjelajah pembawa pedang emas"
                  width={768}
                  height={768}
                  className={`h-24 w-24 object-contain ${hit === "player" ? "anim-hit" : ""}`}
                />
                {floats
                  .filter((f) => f.tone === "player")
                  .map((f) => (
                    <span
                      key={f.id}
                      className="floating-damage text-[18px] text-destructive"
                      style={{ color: "var(--ember)" }}
                    >
                      {f.text}
                    </span>
                  ))}
              </div>
              <div className="flex w-full max-w-[300px] items-center gap-2">
                <span className="shrink-0 font-display text-sm font-semibold">
                  Kamu{shieldOn ? " ◈" : ""}
                </span>
                <HpBar value={playerHp} max={PLAYER_MAX_HP} tone="player" />
                <span className="w-14 shrink-0 text-right font-mono text-[10.5px] text-muted-foreground">
                  {playerHp}/{PLAYER_MAX_HP}
                </span>
              </div>
            </div>

            <p className="mt-3 min-h-4 text-center font-mono text-xs text-primary">
              {log || `Streak ${streak}`}
            </p>
          </div>

          {parry && stage && (
            <Panel>
              <Tag>{parry.result === "pending" ? "⚠ Serangan Masuk!" : parry.result === "success" ? "Tangkisan!" : "Terkena!"}</Tag>
              <p className="mb-1 text-center font-display text-[clamp(16px,4vw,20px)] font-semibold leading-snug text-primary">
                {stage.name} melancarkan {stage.boss ? "jurus gabungan " : ""}
                {parry.moveName}!
              </p>
              <p className="mb-4 text-center text-[13px] text-muted-foreground">
                {parry.result === "pending"
                  ? "Jawab cepat untuk menangkis serangan ini."
                  : parry.result === "success"
                    ? "Tangkisan sempurna — serangan dimentahkan!"
                    : "Tangkisan gagal — serangan menembus pertahananmu."}
              </p>

              {parry.result === "pending" && (
                <div className="mb-4">
                  <div className="h-[6px] overflow-hidden rounded-full bg-background/70 ring-1 ring-border/60">
                    <div
                      className="h-full transition-[width] duration-100"
                      style={{
                        width: `${parryTimeLeftPct * 100}%`,
                        background:
                          parryTimeLeftPct > 0.4 ? "var(--gradient-hp, var(--gold))" : "var(--ember)",
                      }}
                    />
                  </div>
                </div>
              )}

              <p className="mb-4 text-center font-display text-2xl font-bold">{parry.question.q}</p>
              <div className="grid grid-cols-2 gap-[10px]">
                {parry.question.opts.map((opt, i) => {
                  const st =
                    parry.result === "pending"
                      ? "idle"
                      : i === parry.question.a
                        ? "correct"
                        : i === parry.choice
                          ? "wrong"
                          : "dim";
                  return (
                    <button
                      key={i}
                      disabled={parry.result !== "pending"}
                      onClick={() => resolveParry(i === parry.question.a, i)}
                      className={`opt rounded-[10px] border px-3 py-3 text-center font-mono text-[15px] font-semibold transition-all ${
                        st === "correct"
                          ? "border-secondary bg-secondary/30 text-foreground"
                          : st === "wrong"
                            ? "border-destructive bg-destructive/30 text-foreground"
                            : st === "dim"
                              ? "border-border bg-surface-raised opacity-40"
                              : "border-border bg-surface-raised hover:-translate-y-0.5 hover:border-primary"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}

          {!parry && (
          <Panel>
            <Tag>{stage.cat}</Tag>
            <p className="mb-5 font-display text-[clamp(18px,4.2vw,22px)] font-semibold leading-snug">
              {item.q}
            </p>

            {cooldown > 0 && (
              <p className="mb-3 text-center font-mono text-xs text-primary animate-pulse">
                Memproses energi... {Math.ceil(cooldown)}
              </p>
            )}

            {cooldown <= 0 && choice === null && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>⚡ Kecepatan Serangan</span>
                  <span>{timeLeftPct < 1 ? `x${(1 + timeLeftPct).toFixed(1)}` : ""}</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-full bg-background/70 ring-1 ring-border/60">
                  <div
                    className="h-full transition-[width] duration-100"
                    style={{
                      width: `${timeLeftPct * 100}%`,
                      background:
                        timeLeftPct > 0.5
                          ? "var(--gradient-hp, var(--gold))"
                          : timeLeftPct > 0.2
                            ? "var(--gold)"
                            : "var(--ember)",
                    }}
                  />
                </div>
              </div>
            )}

            <div
              className={`grid grid-cols-1 gap-[10px] sm:grid-cols-2 ${cooldown > 0 ? "opacity-50" : ""}`}
            >
              {shuffled.map((opt, i) => {
                const illusion = illusionIdx === i && choice === null && i !== correctShuffledIndex;
                const state =
                  choice === null
                    ? "idle"
                    : i === correctShuffledIndex
                      ? "correct"
                      : i === choice
                        ? "wrong"
                        : "dim";
                return (
                  <button
                    key={i}
                    disabled={choice !== null || cooldown > 0 || illusion}
                    onClick={() => answer(i)}
                    className={`opt rounded-[10px] border px-3 py-3 text-center font-mono text-[15px] font-semibold transition-all ${
                      illusion
                        ? "border-border bg-surface-raised opacity-30 blur-[2px]"
                        : state === "correct"
                          ? "border-secondary bg-secondary/30 text-foreground"
                          : state === "wrong"
                            ? "border-destructive bg-destructive/30 text-foreground"
                            : state === "dim"
                              ? "border-border bg-surface-raised opacity-40"
                              : "border-border bg-surface-raised hover:-translate-y-0.5 hover:border-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Inventaris {bindTurns > 0 ? "· terikat Akar Pengikat" : ""}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SHOP_ITEMS.map((s) => (
                  <button
                    key={s.key}
                    disabled={
                      inventory[s.key] <= 0 ||
                      bindTurns > 0 ||
                      s.key === "revive" ||
                      (s.key === "skip" && choice !== null)
                    }
                    onClick={() => useItem(s.key)}
                    className="rounded-[10px] border border-border bg-surface-raised px-2 py-2 font-mono text-[11px] transition-colors hover:border-primary disabled:opacity-35"
                  >
                    <span className="mr-1 text-primary">{s.icon}</span>
                    {s.name.split(" ")[0]} ×{inventory[s.key]}
                  </button>
                ))}
              </div>
            </div>

            {choice !== null && (
              <div
                className={`mt-4 rounded-[10px] border-l-[3px] bg-background/50 px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground ${
                  choice === correctShuffledIndex ? "border-l-secondary" : "border-l-destructive"
                }`}
              >
                <b className="text-foreground">
                  {choice === correctShuffledIndex
                    ? "Tebasan tepat sasaran."
                    : choice === -2
                      ? "Waktu habis."
                      : "Serangan meleset."}
                </b>{" "}
                {item.ex}
              </div>
            )}

            {choice !== null && enemyHp > 0 && playerHp > 0 && !parry && (
              <div className="mt-4">
                <PrimaryButton onClick={nextQuestion}>Serang Lagi →</PrimaryButton>
              </div>
            )}
          </Panel>
          )}
        </div>
      )}

      {screen === "win" && stage && (
        <Panel>
          <div className="text-center">
            <Tag>Kemenangan</Tag>
            <div className="mb-4 flex justify-center">
              <img
                src={heroArt}
                alt="Ilustrasi anime penjelajah pembawa pedang emas"
                width={768}
                height={768}
                className="anim-idle h-40 w-40 object-contain"
              />
            </div>
            <p className="font-display text-3xl font-extrabold text-primary">
              {stage.name} Tumbang!
            </p>
            <p className="mt-2 font-mono text-sm text-secondary">+{reward} Koin diperoleh</p>
            <p className="mb-5 mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
              {stage.boss
                ? "Kamu telah menaklukkan seluruh Labirin Akar."
                : `Nyawamu pulih sedikit sebelum melanjutkan perjalanan. (${playerHp}/${PLAYER_MAX_HP})`}
            </p>

            {stage.boss ? (
              <>
                <p className="mb-2 font-mono text-xs text-muted-foreground">
                  Masukkan Nama Kelompok untuk dicatat di Papan Peringkat
                </p>
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Nama Kelompok"
                  className="mb-3 w-full rounded-[10px] border border-border bg-surface-raised px-3 py-3 text-center font-mono text-sm outline-none focus:border-primary"
                />
                <PrimaryButton onClick={submitScore}>Simpan Skor & Lihat Akhir</PrimaryButton>
              </>
            ) : (
              <PrimaryButton onClick={() => setScreen("map")}>Kembali ke Peta</PrimaryButton>
            )}
            <div className="mt-3">
              <PrimaryButton tone="moss" onClick={() => setScreen("shop")}>
                Kunjungi Kedai
              </PrimaryButton>
            </div>
          </div>
        </Panel>
      )}

      {screen === "lose" && stage && (
        <Panel>
          <div className="text-center">
            <Tag>Kalah</Tag>
            <div className="mb-4 flex justify-center">
              <img
                src={stage.art}
                alt={`Karakter anime ${stage.name}`}
                loading="lazy"
                width={768}
                height={768}
                className="anim-idle h-40 w-40 object-contain"
              />
            </div>
            <p className="font-display text-3xl font-extrabold text-primary">Kamu Tumbang</p>
            <p className="mb-5 mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
              {stage.name} terlalu kuat kali ini. Tinjau kembali penjelasan tiap soal, lalu coba
              lagi.
            </p>
            <PrimaryButton
              onClick={() => {
                setPlayerHp(60);
                enterBattle(stage);
              }}
            >
              Coba Lagi
            </PrimaryButton>
            <div className="mt-3">
              <PrimaryButton
                tone="moss"
                onClick={() => {
                  setPlayerHp(60);
                  setScreen("map");
                }}
              >
                Kembali ke Peta
              </PrimaryButton>
            </div>
          </div>
        </Panel>
      )}

      {screen === "ending" && (
        <Panel>
          <div className="text-center">
            <Tag>Tamat</Tag>
            <div className="mb-4 flex justify-center">
              <img
                src={heroArt}
                alt="Ilustrasi anime penjelajah pembawa pedang emas"
                width={768}
                height={768}
                className="anim-idle h-44 w-44 object-contain"
              />
            </div>
            <p className="font-display text-3xl font-extrabold text-primary">
              Labirin Akar Ditaklukkan
            </p>
            {finalEntry && (
              <div className="mx-auto mt-4 max-w-[360px] rounded-xl border border-primary/50 bg-surface-raised p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Medali Pencapaian
                </p>
                <p className="mt-1 font-display text-xl font-bold text-primary">
                  {finalEntry.title}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {finalEntry.name} · Skor {finalEntry.score} (HP {finalEntry.hp} × 10 +{" "}
                  {finalEntry.coins} koin)
                </p>
              </div>
            )}
            <p className="mb-5 mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              Kamu menguasai penyederhanaan, penjumlahan, perkalian, rasionalisasi, hingga
              pemangkatan bentuk akar. Pohon purba kini tenang.
            </p>
            <PrimaryButton onClick={() => setScreen("menu")}>Kembali ke Menu Utama</PrimaryButton>
            <div className="mt-3">
              <PrimaryButton tone="moss" onClick={() => setScreen("leaderboard")}>
                Lihat Papan Peringkat
              </PrimaryButton>
            </div>
          </div>
        </Panel>
      )}
    </main>
  );
}
