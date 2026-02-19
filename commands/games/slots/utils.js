// src/commands/games/slots/utils.js

// Slot emoji pool with weighted chances
const SYMBOLS = [
  { emoji: "<:testblock:1429946118229196810>", weight: 40, multiplier: 1 },
  { emoji: "<:Warden:1429946036809371769>", weight: 30, multiplier: 0.5 },
  { emoji: "<:scaryhorrormonster:1429946136784932864>", weight: 20, multiplier: 3 },
  { emoji: "<:sus:1429945939006853170>", weight: 8, multiplier: 5 },
  { emoji: "<:waxedlightlyweatheredcutcopperst:1429946087921287168>", weight: 2, multiplier: 10 }
];
// src/commands/games/slots/utils.js

function pickSymbol() {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const sym of SYMBOLS) {
    roll -= sym.weight;
    if (roll <= 0) return sym.emoji;
  }

  return SYMBOLS[0].emoji;
}

export function spinSlots() {
  const a = pickSymbol();
  const b = pickSymbol();
  const c = pickSymbol();

  const slots = [a, b, c];

  let multiplier = 0;
  let outcome = "LOSS";
  let jackpot = false;

  // Count matches
  const counts = {};
  for (const s of slots) counts[s] = (counts[s] || 0) + 1;

  const symbols = Object.keys(counts);
  const maxMatch = Math.max(...Object.values(counts));

  // ===== TRIPLE MATCH =====
  if (maxMatch === 3) {
    const sym = symbols[0];

    // Jackpot triple 👑
    if (sym === "<:waxedlightlyweatheredcutcopperst:1429946087921287168>") {
      jackpot = true;
      multiplier = 0;
      outcome = "JACKPOT!!!";
    }

    // Half-loss triple 🍋
    else if (sym === "<:Warden:1429946036809371769>") {
      multiplier = 0.5;
      outcome = "HALF LOSS";
    }

    // Normal triples
    else if (sym === "<:testblock:1429946118229196810>") {
      multiplier = 1;
      outcome = "BREAK EVEN";
    }
    else if (sym === "<:scaryhorrormonster:1429946136784932864>") {
      multiplier = 3;
      outcome = "WIN x3";
    }
    else if (sym === "<:sus:1429945939006853170>") {
      multiplier = 5;
      outcome = "WIN x5";
    }
  }

  // ===== TWO MATCH =====
  else if (maxMatch === 2) {
    multiplier = 1.25;
    outcome = "SMALL WIN x1.25";

    // Better payout if 💎 pair
    if (symbols.includes("<:waxedlightlyweatheredcutcopperst:1429946087921287168>")) {
      multiplier = 1.5;
      outcome = "NICE PAIR x1.5";
    }
  }

  return {
    slots,
    multiplier,
    outcome,
    jackpot
  };
}
