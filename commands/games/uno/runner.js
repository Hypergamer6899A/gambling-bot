// /uno/runner.js
import { unoEmbed } from "./unoEmbed.js";
import { playCard } from "../games/uno/logic.js";
import { botChooseCard, botChooseColor } from "../games/uno/bot.js";
import { temp } from "../lib/temp.js";

export async function runUnoGame(channel, state) {
  while (!state.winner) {
    await channel.send({ embeds:[unoEmbed(state)] });

    if (state.turn === "bot") {
      await new Promise(r=>setTimeout(r,800));

      const idx = botChooseCard(state);
      if (idx === -1) {
        // draw
        state.botHand.push(state.deck.pop());
        state.turn = "player";
        continue;
      }

      const res = playCard(state, false, idx);

      if (state.currentColor === "Wild") {
        state.currentColor = botChooseColor(state);
      }
    } else {
      // player's move waits for collector
      break;
    }
  }

  if (state.winner) {
    await channel.send(
      state.winner === "player" ? "You win!" : "Bot wins!"
    );
  }
}
