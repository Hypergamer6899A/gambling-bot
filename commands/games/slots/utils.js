// src/commands/games/slots/utils.js

const SYMBOLS = [
  { emoji: "<:testblock:1429946118229196810>", weight: 32, triple: 1, pair: 1.25 },
  { emoji: "<:Warden:1429946036809371769>", weight: 28, triple: 0.5, pair: 1.1 },
  { emoji: "<:scaryhorrormonster:1429946136784932864>", weight: 24, triple: 3, pair: 1.5 },
  { emoji: "<:sus:1429945939006853170>", weight: 13, triple: 5, pair: 2 },

  // Jackpot symbol
  { emoji: "<:waxedlightlyweatheredcutcopperst:1429946087921287168>", weight: 3, triple: 0, pair: 3, jackpot: true }
];

function pickSymbol() {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const sym of SYMBOLS) {
    roll -= sym.weight;
    if (roll <= 0) return sym.emoji;
  }

  return SYMBOLS[0].emoji;
}

function getSymbolData(emoji) {
  return SYMBOLS.find(s => s.emoji === emoji);
}

export function spinSlots() {
  const slots = [pickSymbol(), pickSymbol(), pickSymbol()];

  const counts = {};
  for (const s of slots) counts[s] = (counts[s] || 0) + 1;

  const entries = Object.entries(counts);
  const maxMatch = Math.max(...entries.map(e => e[1]));

  let multiplier = 0;
  let outcome = "LOSS";
  let jackpot = false;

  // ===== TRIPLE MATCH =====
  if (maxMatch === 3) {
    const [emoji] = entries[0];
    const sym = getSymbolData(emoji);

    if (sym.jackpot) {
      jackpot = true;
      multiplier = 0;
      outcome = "JACKPOT!!!";
    }
    else {
      multiplier = sym.triple;

      if (multiplier < 1) outcome = "HALF LOSS";
      else if (multiplier === 1) outcome = "BREAK EVEN";
      else outcome = `WIN x${multiplier}`;
    }
  }

  // ===== PAIR MATCH =====
  else if (maxMatch === 2) {
    const pairSymbol = entries.find(([_, count]) => count === 2)?.[0];
    const sym = getSymbolData(pairSymbol);

    multiplier = sym.pair;

    if (multiplier >= 3) outcome = `INSANE PAIR x${multiplier}`;
    else if (multiplier >= 2) outcome = `GREAT PAIR x${multiplier}`;
    else if (multiplier > 1.25) outcome = `NICE PAIR x${multiplier}`;
    else outcome = `SMALL WIN x${multiplier}`;
  }

  return {
    slots,
    multiplier,
    outcome,
    jackpot
  };
}
