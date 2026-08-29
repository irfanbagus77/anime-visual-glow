import enemy1 from "@/assets/enemy1.png";
import enemy2 from "@/assets/enemy2.png";
import enemy3 from "@/assets/enemy3.png";
import enemy4 from "@/assets/enemy4.png";
import enemy5 from "@/assets/enemy5.png";
import enemy6 from "@/assets/enemy6.png";

export type Question = { q: string; opts: string[]; a: number; ex: string };

export type Stage = {
  id: number;
  name: string;
  cat: string;
  art: string;
  aura: string;
  maxHp: number;
  atkMin: number;
  atkMax: number;
  boss?: boolean;
  intro: string;
  pool: Question[];
};

export const PLAYER_MAX_HP = 100;

export const STAGES: Stage[] = [
  {
    id: 0,
    name: "Si Kembar Sederhana",
    cat: "Menyederhanakan Bentuk Akar",
    art: enemy1,
    aura: "var(--aura-moss)",
    maxHp: 80,
    atkMin: 12,
    atkMax: 18,
    intro:
      "Dua sosok akar identik menghalangi jalan, tubuhnya masih berupa akar besar yang belum disederhanakan.",
    pool: [
      { q: "√72 = …", opts: ["6√2", "3√8", "2√18", "4√3"], a: 0, ex: "72 = 36×2, √36=6 → 6√2." },
      { q: "√180 = …", opts: ["9√2", "6√5", "5√6", "3√20"], a: 1, ex: "180 = 36×5, √36=6 → 6√5." },
      { q: "√98 = …", opts: ["7√2", "2√49", "14√2", "49√2"], a: 0, ex: "98 = 49×2, √49=7 → 7√2." },
      { q: "√200 = …", opts: ["10√2", "2√100", "20√2", "5√8"], a: 0, ex: "200 = 100×2, √100=10 → 10√2." },
      { q: "√128 = …", opts: ["8√2", "4√8", "2√32", "16√2"], a: 0, ex: "128 = 64×2, √64=8 → 8√2." },
      { q: "√48 = …", opts: ["4√3", "2√12", "6√8", "3√16"], a: 0, ex: "48 = 16×3, √16=4 → 4√3." },
    ],
  },
  {
    id: 1,
    name: "Bayangan Penjumlah",
    cat: "Penjumlahan & Pengurangan",
    art: enemy2,
    aura: "var(--aura-azure)",
    maxHp: 90,
    atkMin: 14,
    atkMax: 20,
    intro:
      "Bayangan kembar akar melebur dan berpisah — hanya suku sejenis yang bisa menyatukannya kembali.",
    pool: [
      { q: "3√5 + 7√5 = …", opts: ["10√10", "10√5", "21√5", "10√25"], a: 1, ex: "Suku sejenis: 3+7=10 → 10√5." },
      { q: "√50 + √8 = …", opts: ["7√2", "5√8", "√58", "9√4"], a: 0, ex: "√50=5√2, √8=2√2 → 7√2." },
      { q: "8√3 − 2√3 + √3 = …", opts: ["5√3", "7√3", "9√9", "6√3"], a: 1, ex: "8−2+1=7 → 7√3." },
      { q: "√27 + √12 = …", opts: ["5√3", "3√39", "√39", "5√39"], a: 0, ex: "√27=3√3, √12=2√3 → 5√3." },
      { q: "6√2 − 4√2 + 3√2 = …", opts: ["5√2", "13√2", "5√6", "5"], a: 0, ex: "6−4+3=5 → 5√2." },
      { q: "√45 − √20 = …", opts: ["√25", "√2", "5√2", "√5"], a: 3, ex: "3√5−2√5=√5." },
    ],
  },
  {
    id: 2,
    name: "Iblis Perkalian",
    cat: "Perkalian Bentuk Akar",
    art: enemy3,
    aura: "var(--aura-ember)",
    maxHp: 100,
    atkMin: 15,
    atkMax: 22,
    intro:
      "Ksatria api bertanduk menyerangmu dengan pasangan akar — kalikan dengan tepat untuk menjatuhkannya.",
    pool: [
      { q: "√3 × √12 = …", opts: ["√36 = 6", "6√3", "36", "√15"], a: 0, ex: "√3×√12=√36=6." },
      { q: "2√5 × 3√5 = …", opts: ["6√10", "30", "6√25", "5√30"], a: 1, ex: "2×3=6, √5×√5=5 → 30." },
      { q: "(√6 + √2)(√6 − √2) = …", opts: ["4", "8", "2√6", "6−2"], a: 0, ex: "a²−b²=6−2=4." },
      { q: "√8 × √2 = …", opts: ["4", "√16", "2√4", "16"], a: 0, ex: "√8×√2=√16=4." },
      { q: "3√2 × 4√3 = …", opts: ["12√6", "7√6", "12√5", "24√6"], a: 0, ex: "3×4=12, √2×√3=√6 → 12√6." },
      { q: "(2+√3)(2−√3) = …", opts: ["1", "4", "4−3", "−1"], a: 0, ex: "a²−b²=4−3=1." },
    ],
  },
  {
    id: 3,
    name: "Hantu Rasionalisasi",
    cat: "Merasionalkan Penyebut",
    art: enemy4,
    aura: "var(--aura-teal)",
    maxHp: 110,
    atkMin: 16,
    atkMax: 24,
    intro:
      "Roh ini bersembunyi di balik penyebut berbentuk akar — usir dengan mengalikan sekawan yang tepat.",
    pool: [
      { q: "4/√2 = …", opts: ["2√2", "4√2", "√2", "2"], a: 0, ex: "Kalikan √2/√2 → 4√2/2 = 2√2." },
      { q: "6/(√5 − 1) = …", opts: ["(3√5+3)/2", "6(√5−1)/4", "6√5−6", "(√5+1)/6"], a: 0, ex: "Sekawan (√5+1): penyebut 4 → (3√5+3)/2." },
      { q: "10/(2√3) = …", opts: ["5√3/3", "10√3/3", "5√3", "10√3"], a: 0, ex: "10/(2√3)=5/√3 → 5√3/3." },
      { q: "3/√6 = …", opts: ["√6/3", "√6/2", "√6", "3√6"], a: 1, ex: "3√6/6 = √6/2." },
      { q: "2/(√7+√5) = …", opts: ["√7+√5", "√7−√5", "2(√7−√5)", "(√7−√5)/2"], a: 1, ex: "Penyebut 7−5=2 → √7−√5." },
      { q: "5/√10 = …", opts: ["√10/5", "√10/2", "2√10", "√10"], a: 1, ex: "5√10/10 = √10/2." },
    ],
  },
  {
    id: 4,
    name: "Naga Pemangkatan",
    cat: "Pemangkatan Bentuk Akar",
    art: enemy5,
    aura: "var(--aura-gold)",
    maxHp: 120,
    atkMin: 18,
    atkMax: 26,
    intro: "Naga tua ini menyimpan kekuatan berlipat ganda — kuasai pangkat akarnya untuk menaklukkannya.",
    pool: [
      { q: "(2√3)² = …", opts: ["6", "12", "4√3", "√6"], a: 1, ex: "2²×(√3)²=4×3=12." },
      { q: "(√5+√2)² = …", opts: ["7+2√10", "7", "5+2", "10+√10"], a: 0, ex: "5+2√10+2=7+2√10." },
      { q: "(√7)⁴ = …", opts: ["7", "14", "28", "49"], a: 3, ex: "((√7)²)²=7²=49." },
      { q: "(3√2)² = …", opts: ["18", "6", "9√2", "12"], a: 0, ex: "9×2=18." },
      { q: "(√10−√6)² = …", opts: ["16−2√60", "4", "16", "10−6"], a: 0, ex: "10−2√60+6=16−2√60." },
      { q: "(√2)⁶ = …", opts: ["8", "16", "64", "2"], a: 0, ex: "((√2)²)³=2³=8." },
    ],
  },
  {
    id: 5,
    name: "Raja Akar Purba",
    cat: "Boss · Semua Kategori",
    art: enemy6,
    aura: "var(--aura-gold)",
    boss: true,
    maxHp: 180,
    atkMin: 20,
    atkMax: 32,
    intro:
      "Penguasa terakhir labirin ini menggabungkan seluruh kekuatan bentuk akar. Hanya penguasaan penuh yang bisa mengalahkannya.",
    pool: [
      { q: "√75 = …", opts: ["5√3", "3√5", "15√5", "5√5"], a: 0, ex: "75=25×3 → 5√3." },
      { q: "4√6 + 2√6 = …", opts: ["6√6", "6√12", "8√6", "6"], a: 0, ex: "4+2=6 → 6√6." },
      { q: "√5 × √20 = …", opts: ["√100 = 10", "10√5", "√25", "100"], a: 0, ex: "√100=10." },
      { q: "8/√2 = …", opts: ["4√2", "2√2", "8√2", "4"], a: 0, ex: "8√2/2=4√2." },
      { q: "(√3+1)² = …", opts: ["4+2√3", "4", "3+1", "4−2√3"], a: 0, ex: "3+2√3+1=4+2√3." },
      { q: "√12 × √3 = …", opts: ["6", "√36", "2√6", "36"], a: 0, ex: "√36=6." },
    ],
  },
];
