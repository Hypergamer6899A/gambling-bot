import { temp } from "../../utils/tempMessage.js";
import { playerPlayCard, playerDraw } from "../../g/uno.js";

export function startUnoCollector(client, state) {
  const filter = m => m.author.id === state.player.id;

  const collector = state.channel.createMessageCollector({ filter });

  collector.on("collect", async message => {
    if (state.ended) return collector.stop();

    // Auto-delete player's message after 3 sec
    setTimeout(() => message.delete().catch(()=>{}), 3000);

    const content = message.content.trim().toLowerCase();

    // Parse commands
    if (content.startsWith("!play")) {
      const parts = content.split(/\s+/);
      if (parts.length < 3) {
        return temp(state.channel, "Usage: `!play <color> <value>`");
      }

      const color = parts[1];
      const value = parts.slice(2).join(" "); // supports "wild +4"

      const card = state.playerHand.find(
        c => c.color === color && c.value.toLowerCase() === value
      );

      if (!card) {
        return temp(state.channel, "You don't have that card.");
      }

      await playerPlayCard(state, card, message);
      return;
    }

    if (content === "!draw") {
      await playerDraw(state);
      return;
    }

    if (content.startsWith("!color")) {
      // Optional: use this only if player must set color after +4 or wild
      const parts = content.split(/\s+/);
      const color = parts[1];

      if (!["red", "yellow", "green", "blue"].includes(color)) {
        return temp(state.channel, "Pick one of: red, yellow, green, blue.");
      }

      state.currentColor = color;
      await state.channel.send(`Color set to **${color}**.`);
      return;
    }

    temp(state.channel, "Unknown UNO command.");
  });

  collector.on("end", () => {
    // Clean end – game engine will delete the channel itself.
  });
}
