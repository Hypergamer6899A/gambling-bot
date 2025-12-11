const suits = ["♠", "♥", "♦", "♣"];
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function drawCard() {
  const v = values[Math.floor(Math.random() * values.length)];
  const s = suits[Math.floor(Math.random() * suits.length)];
  return `${v}${s}`;
}

export function handValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    let v = card.slice(0, -1);  // remove suit
    if (v === "A") {
      aces++;
      total += 11;
    } else if (["J","Q","K"].includes(v)) {
      total += 10;
    } else {
      total += parseInt(v, 10);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}
