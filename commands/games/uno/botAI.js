import { canPlayOn, cardToString } from "./format.js";
import { drawInto } from "./engine.js";

export function botTurn(state) {
  let extra = true;
  let loopLimit = 8;
  const actions = [];

  while (extra && loopLimit-- > 0) {
    extra = false;

    const idx = state.botHand.findIndex(c =>
      canPlayOn(c, state.currentColor, state.currentValue)
    );

    if (idx === -1) {
      drawInto(state, state.botHand, 1);
      actions.push("Bot drew a card.");
      state.turn = "player";
      return { actions, winner: state.winner };
    }

    const played = state.botHand[idx];
    state.botHand.splice(idx, 1);
    state.pile.push(played);

    // choose color if wild
    if (played.color === "Wild") {
      const counts = { Red:0, Yellow:0, Green:0, Blue:0 };
      for (const c of state.botHand) if (counts[c.color] !== undefined) counts[c.color]++;
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

