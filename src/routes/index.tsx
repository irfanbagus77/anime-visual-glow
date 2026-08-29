import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "gold" | "moss";
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[10px] px-4 py-[14px] font-mono text-sm font-bold tracking-wide transition-colors ${
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

/* ---------- game ---------- */
type Screen = "intro" | "map" | "brief" | "battle" | "win" | "lose" | "ending";

function Game() {
  const [screen, setScreen] = useState<Screen>("intro");
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
    setCooldown(4);
  }, [item, qi, queue, stage?.id]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const enterBattle = useCallback((s: Stage) => {
    setStage(s);
    setEnemyHp(s.maxHp);
    setQueue(shuffle(s.pool));
    setQi(0);
    setStreak(0);
    setChoice(null);
    setLog("");
    setScreen("brief");
  }, []);

  const answer = (i: number) => {
    if (choice !== null || !stage || !item || cooldown > 0) return;
    setChoice(i);
    const correct = i === correctShuffledIndex;
    if (correct) {
      const next = streak + 1;
      const dmg = rand(stage.atkMin + 8, stage.atkMax + 10) + clamp(next - 1, 0, 5) * 3;
      const hp = clamp(enemyHp - dmg, 0, stage.maxHp);
      setStreak(next);
      setEnemyHp(hp);
      setHit("enemy");
      setLog(`Tebasanmu melukai ${stage.name} sebesar ${dmg} · streak ${next}`);
      if (hp <= 0) {
        setTimeout(() => {
          setProgress((p) => (p.includes(stage.id) ? p : [...p, stage.id]));
          setPlayerHp((h) => clamp(h + 18, 0, PLAYER_MAX_HP));
          setScreen("win");
        }, 1200);
      }
    } else {
      const dmg = rand(stage.atkMin, stage.atkMax);
      const hp = clamp(playerHp - dmg, 0, PLAYER_MAX_HP);
      setStreak(0);
      setPlayerHp(hp);
      setHit("player");
      setLog(`${stage.name} membalas menyerangmu sebesar ${dmg}`);
      if (hp <= 0) setTimeout(() => setScreen("lose"), 1200);
    }
    setTimeout(() => setHit(null), 400);
  };

  const nextQuestion = () => {
    setChoice(null);
    setQi((n) => {
      const next = n + 1;
      if (next >= queue.length) {
        setQueue(shuffle(stage!.pool));
        return 0;
      }
      return next;
    });
  };

  const allDone = progress.length === STAGES.length;
  const auraStyle = useMemo(
    () => ({ ["--enemy-aura" as string]: stage?.aura ?? "var(--gold)" }) as React.CSSProperties,
    [stage],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[680px] flex-col px-4 pb-16 pt-8">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
        Matematika · Kelas 10 · RPG Giliran
      </p>
      <h1 className="text-center font-display text-[clamp(28px,6vw,40px)] font-bold tracking-tight">
        Labirin Akar
      </h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Kalahkan penjaga akar dengan menyelesaikan bentuk akar dengan tepat.
      </p>

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
            <b className="text-foreground">salah</b> membuka celah bagi musuh.
          </p>
          <PrimaryButton
            onClick={() => {
              setPlayerHp(PLAYER_MAX_HP);
              setProgress([]);
              setScreen("map");
            }}
          >
            Masuki Labirin
          </PrimaryButton>
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
          <p className="mb-5 text-center text-[14.5px] leading-relaxed text-muted-foreground">
            {stage.intro}
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
          <div className="scene mb-4 overflow-hidden px-4 pb-4 pt-5">
            <div className="flex flex-col items-center gap-2">
              <img
                src={stage.art}
                alt={`Karakter anime ${stage.name}`}
                loading="lazy"
                width={768}
                height={768}
                className={`h-32 w-32 object-contain drop-shadow-[0_14px_26px_oklch(0_0_0/0.55)] ${
                  hit === "enemy" ? "anim-hit" : "anim-idle"
                }`}
              />
              <div className="flex w-full max-w-[300px] items-center gap-2">
                <span className="shrink-0 font-display text-sm font-semibold">{stage.name}</span>
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
              <img
                src={heroArt}
                alt="Ilustrasi anime penjelajah pembawa pedang emas"
                width={768}
                height={768}
                className={`h-24 w-24 object-contain ${hit === "player" ? "anim-hit" : ""}`}
              />
              <div className="flex w-full max-w-[300px] items-center gap-2">
                <span className="shrink-0 font-display text-sm font-semibold">Kamu</span>
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

            <div className={`grid grid-cols-1 gap-[10px] sm:grid-cols-2 ${cooldown > 0 ? "opacity-50" : ""}`}>
              {shuffled.map((opt, i) => {
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
                    disabled={choice !== null || cooldown > 0}
                    onClick={() => answer(i)}
                    className={`rounded-[10px] border px-3 py-3 text-center font-mono text-[15px] font-semibold transition-all ${
                      state === "correct"
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

            {choice !== null && (
              <div
                className={`mt-4 rounded-[10px] border-l-[3px] bg-background/50 px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground ${
                  choice === correctShuffledIndex ? "border-l-secondary" : "border-l-destructive"
                }`}
              >
                <b className="text-foreground">
                  {choice === correctShuffledIndex ? "Tebasan tepat sasaran." : "Serangan meleset."}
                </b>{" "}
                {item.ex}
              </div>
            )}

            {choice !== null && enemyHp > 0 && playerHp > 0 && (
              <div className="mt-4">
                <PrimaryButton onClick={nextQuestion}>Serang Lagi →</PrimaryButton>
              </div>
            )}
          </Panel>
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
            <p className="mb-5 mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
              {stage.boss
                ? "Kamu telah menaklukkan seluruh Labirin Akar."
                : `Nyawamu pulih sedikit sebelum melanjutkan perjalanan. (${playerHp}/${PLAYER_MAX_HP})`}
            </p>
            <PrimaryButton onClick={() => setScreen(stage.boss ? "ending" : "map")}>
              {stage.boss ? "Lihat Akhir Cerita" : "Kembali ke Peta"}
            </PrimaryButton>
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
            <p className="mb-5 mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
              Kamu menguasai penyederhanaan, penjumlahan, perkalian, rasionalisasi, hingga
              pemangkatan bentuk akar. Pohon purba kini tenang.
            </p>
            <PrimaryButton onClick={() => setScreen("intro")}>Main dari Awal</PrimaryButton>
          </div>
        </Panel>
      )}
    </main>
  );
}
