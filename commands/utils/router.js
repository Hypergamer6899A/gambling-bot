import { blackjackCommand } from "../g/blackjack.js";
import { rouletteCommand } from "../g/roulette.js";
import { leaderboardCommand } from "../g/leaderboard.js";
import { balanceCommand } from "../g/balance.js";
import { giftCommand } from "../g/gift.js";
import { helpCommand } from "../g/help.js";
import { claimCommand } from "../g/claim.js";

const PREFIX = "!g";

export function messageRouter(client, message) {
  if (message.author.bot) return;

  const content = message.content.trim();
  if (!content.toLowerCase().startsWith(PREFIX)) return;

  const args = content.split(/\s+/);
  const cmd = args[1]?.toLowerCase();

  switch (cmd) {
    case "blackjack":
      return blackjackCommand(client, message, args);

    case "roulette":
      return rouletteCommand(client, message, args);

    case "leaderboard":
      return leaderboardCommand(client, message, args);

    case "balance":
      return balanceCommand(client, message);

    case "gift":
      return giftCommand(client, message, args);

    case "claim":
      return claimCommand(client, message);

    case "help":
      return helpCommand(client, message);

    default:
      return message.reply("Unknown command. Use `!g help`.");
  }
}
