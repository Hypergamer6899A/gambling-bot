import { unoStart } from "../../commands/g/unoStart.js";
import { blackjackCommand } from "../../commands/g/blackjack.js";
import { rouletteCommand } from "../../commands/g/roulette.js";
import { leaderboardCommand } from "../../commands/g/leaderboard.js";
import { balanceCommand } from "../../commands/g/balance.js";
import { giftCommand } from "../../commands/g/gift.js";
import { helpCommand } from "../../commands/g/help.js";


// UNO subcommands (if needed in future)
import { startUnoCollector } from "../commands/uno/collector.js";

const PREFIX = "!g";
const UNO_PREFIX = "!uno";

export function messageRouter(client, message) {
  if (message.author.bot) return;

  const content = message.content.trim();

  // UNO sub-commands
  if (content.toLowerCase().startsWith(UNO_PREFIX)) {
    return; // handled inside UNO collector
  }

  // Main command prefix
  if (!content.toLowerCase().startsWith(PREFIX)) return;

  const args = content.split(/\s+/);
  const cmd = args[1]?.toLowerCase();

  switch (cmd) {
    case "uno":
      return unoStart(client, message, args);
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
    case "help": 
      return helpCommand(client, message);
    default:
      return message.reply("Unknown command. Use `!g help`.");
  }
}
