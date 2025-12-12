import { canPlayOn, cardToString } from "./format.js";
import { drawInto } from "./engine.js";

export function botTurn(state) {
  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = state.member?.roles?.cache?.has(SPECIAL_ROLE) || false;

  // Percent chance that the bot intentionally skips its best move
  const BOOST = 0.12;

  let extra = true;
  let loopLimit = 8;
  const actions = [];

  while (extra && loopLimit-- > 0) {
    extra = false;

    // gather all playable cards instead of stopping at the first
    let playable = [];
    for (let i = 0; i < state.botHand.length; i++) {
      if (canPlayOn(state.botHand[i], state.currentColor, state.currentValue)) {
        playable.push(i);
      }
    }

    // no playable card
    if (playable.length === 0) {
      drawInto(state, state.botHand, 1);
      actions.push("Bot drew a card.");
      state.turn = "player";
      return { actions, winner: state.winner };
    }

    let idx;

    // If boosted, bot may intentionally skip the best playable card
    if (hasBoost && playable.length > 1 && Math.random() < BOOST) {
      // Pick a random *worse* playable index (any except the first good one)
      const worseOptions = playable.slice(1);
      idx = worseOptions[Math.floor(Math.random() * worseOptions.length)];
    } else {
      // Normal behavior: pick the first playable card
      idx = playable[0];
    }

    const played = state.botHand[idx];
    state.botHand.splice(idx, 1);
    state.pile.push(played);

    // choose color if wild
    if (played.color === "Wild") {
      const counts = { Red:0, Yellow:0, Green:0, Blue:0 };
      for (const c of state.botHand)
        if (counts[c.color] !== undefined) counts[c.color]++;
      state.currentColor = Object.keys(counts).reduce((a,b)=>counts[a]>=counts[b]?a:b);
    } else {
      state.currentColor = played.color;
    }

    state.currentValue = played.value;

    let text = `🤖 Bot played **${cardToString(played)}**.`;

    if (played.value === "Draw 2") {
      drawInto(state, state.playerHand, 2);
      text += " You draw 2 cards. Bot plays again.";
      extra = true;
      state.turn = "bot";
    } else if (played.value === "Draw 4") {
      drawInto(state, state.playerHand, 4);
      text += " You draw 4 cards. Bot plays again.";
      extra = true;
      state.turn = "bot";
    } else if (played.value === "Skip" || played.value === "Reverse") {
      text += " Your turn is skipped. Bot plays again.";
      extra = true;
      state.turn = "bot";
    } else {
      state.turn = "player";
    }

    actions.push(text);

    if (state.botHand.length === 0) {
      state.winner = "bot";
      return { actions, winner: "bot" };
    }
  }

  return { actions, winner: state.winner };
}
