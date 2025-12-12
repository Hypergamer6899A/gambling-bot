import { drawCard, handValue } from "./utils.js";
import { processGame } from "../utils/house.js";

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
    await processGame(-state.bet); // player busts, house gains
    return { result: "bust" };
  }

  return { result: "continue" };
}

export async function dealerDraw(state) {
  const target = state.playerTotal;
  let dealerTotal = handValue(state.dealerHand);

  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = state.member?.roles?.cache?.has(SPECIAL_ROLE) || false;
  const BOOST = 0.10;
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
    let card = state.streak === 0 ? drawCard() : weightedPick(target, dealerTotal);
    if (hasBoost && Math.random() < BOOST) {
      const alt = drawCard();
      const altTotal = handValue([...state.dealerHand, alt]);
      const cardTotal = handValue([...state.dealerHand, card]);
      if (altTotal < cardTotal || altTotal > 21) card = alt;
    }
    state.dealerHand.push(card);
    dealerTotal = handValue(state.dealerHand);

    if (dealerTotal > 21) {
      state.dealerTotal = dealerTotal;
      await processGame(state.bet); // dealer busts, player wins
      return "dealer_bust";
    }
  }

  state.dealerTotal = dealerTotal;

  if (dealerTotal > target) {
    await processGame(-state.bet); // dealer wins, house gains
    return "dealer_win";
  }
  if (dealerTotal < target) {
    await processGame(state.bet); // player wins, house loses
    return "player_win";
  }

  return "tie"; // no balance change
}
