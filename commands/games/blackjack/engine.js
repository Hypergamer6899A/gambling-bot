import { drawCard, handValue } from "./utils.js";

export function newBlackjackGame(bet, streak = 0) {
  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [drawCard(), drawCard()];

  return {
    bet,
    streak,
    playerHand,
    dealerHand,
    playerTotal: handValue(playerHand),
    dealerTotal: handValue(dealerHand),
    gameOver: false
  };
}

export function playerHit(state) {
  state.playerHand.push(drawCard());
  state.playerTotal = handValue(state.playerHand);

  if (state.playerTotal > 21) {
    state.gameOver = true;
    return { result: "bust" };
  }

  return { result: "continue" };
}

export function dealerDraw(state) {
  const target = state.playerTotal;
  let dealerTotal = handValue(state.dealerHand);

  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = state.member?.roles?.cache?.has(SPECIAL_ROLE) || false;
  const BOOST = 0.10; // 10% softer dealer behavior for boosted players

  const difficulty = Math.min(1 + state.streak * 0.15, 3.5);
  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const suits = ["♠","♥","♦","♣"];

  const weightedPick = (target, current) => {
    const pool = [];
    for (const v of values) {
      let cardVal = v === "A" ? 11 : (["J","Q","K"].includes(v) ? 10 : parseInt(v));
      const diff = target - current;
      let weight = 1;

      if (state.streak > 0) {
        if (cardVal <= diff) weight = Math.round(3 * difficulty);
        else if (cardVal - diff <= 3) weight = Math.round(2 * difficulty);
      }

      for (let i = 0; i < weight; i++) pool.push(v);
    }

    const v = pool[Math.floor(Math.random() * pool.length)];
    const s = suits[Math.floor(Math.random() * suits.length)];
    return `${v}${s}`;
  };

  while (dealerTotal <= target && dealerTotal <= 21) {

    // draw card as usual
    let card = state.streak === 0
      ? drawCard()
      : weightedPick(target, dealerTotal);

    // role-boost softens the dealer’s draw 10% of the time
    if (hasBoost && Math.random() < BOOST) {
      const alt = drawCard();
      const altTotal = handValue([...state.dealerHand, alt]);
      const cardTotal = handValue([...state.dealerHand, card]);

      // pick whichever card is WORSE for the dealer
      // meaning: pick the one that is less likely to beat the player
      if (altTotal < cardTotal || altTotal > 21) {
        card = alt;
      }
    }

    state.dealerHand.push(card);
    dealerTotal = handValue(state.dealerHand);

    if (dealerTotal > 21) {
      state.dealerTotal = dealerTotal;
      return "dealer_bust";
    }
  }

  state.dealerTotal = dealerTotal;

  if (dealerTotal > target) return "dealer_win";
  if (dealerTotal < target) return "player_win";
  return "tie";
}
