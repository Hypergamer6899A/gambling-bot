// src/commands/games/slots/utils.js

// Slot emoji pool with weighted chances
const SYMBOLS = [
  { emoji: "<:testblock:1429946118229196810>", weight: 40, multiplier: 1 },
  { emoji: "<:Warden:1429946036809371769>", weight: 30, multiplier: 0.5 },
  { emoji: "<:scaryhorrormonster:1429946136784932864>", weight: 20, multiplier: 3 },
  { emoji: "<:sus:1429945939006853170>", weight: 8, multiplier: 5 },
  { emoji: "<:waxedlightlyweatheredcutcopperst:1429946087921287168>", weight: 2, multiplier: 10 }
];

// Weighted random picker
function pickSymbol() {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const sym of SYMBOLS) {
    roll -= sym.weight;
    if (roll <= 0) return sym;
  }

  return SYMBOLS[0];
}

export function spinSlots() {
  const a = pickSymbol();
  const b = pickSymbol();
  const c = pickSymbol();

  let multiplier = 0;
  let outcome = "LOSS";

  // Triple match required
  if (a.emoji === b.emoji && b.emoji === c.emoji) {
    multiplier = a.multiplier;

    if (multiplier === 0.5) outcome = "HALF LOSS";
    else if (multiplier === 1) outcome = "BREAK EVEN";
    else outcome = `WIN x${multiplier}`;
  } else {
    multiplier = 0;
    outcome = "LOSS";
  }

  return {
    slots: [a.emoji, b.emoji, c.emoji],
    multiplier,
    outcome
  };
}
