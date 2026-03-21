// commands/utils/router.js
import { blackjackCommand }  from "../g/blackjack.js";
import { rouletteCommand }   from "../g/roulette.js";
import { pokerCommand }      from "../g/poker.js";
import { slotsCommand }      from "../g/slots.js";
import { leaderboardCommand } from "../g/leaderboard.js";
import { balanceCommand }    from "../g/balance.js";
import { giftCommand }       from "../g/gift.js";
import { claimCommand }      from "../g/claim.js";
import { helpCommand }       from "../g/help.js";

const PREFIX = "!g";

export async function messageRouter(client, message) {
  if (message.author.bot) return;

  const content = message.content.trim();
  if (!content.toLowerCase().startsWith(PREFIX)) return;

  const args = content.split(/\s+/);
  const cmd  = args[1]?.toLowerCase();

  if (!cmd) return message.reply("Type `!g help` to see all commands.");

  try {
    switch (cmd) {
      case "blackjack":
      case "bj":
        return await blackjackCommand(client, message, args);

      case "slots":
      case "slot":
      case "spin":
        return await slotsCommand(client, message, args);

      case "roulette":
      case "wheel":
        return await rouletteCommand(client, message, args);

      case "poker":
      case "5card":
        return await pokerCommand(client, message, args);

      case "balance":
      case "bal":
      case "wallet":
        return await balanceCommand(client, message);

      case "gift":
        return await giftCommand(client, message, args);

      case "claim":
      case "bankrupt":
      case "broke":
        return await claimCommand(client, message);

      case "leaderboard":
      case "lb":
      case "lead":
      case "scores":
      case "top":
        return await leaderboardCommand(client, message);

      case "help":
        return await helpCommand(client, message);

      default:
        return message.reply("Unknown command. Use `!g help` to see the full list.");
    }
  } catch (err) {
    console.error(`[router] Command error (${cmd}):`, err);
    return message.reply("That command crashed. Check the console for the error.");
  }
}
