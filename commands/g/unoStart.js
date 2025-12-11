import { startUnoCollector } from "../uno/collector.js";          // stays the same
import { newGameState } from "../games/uno/engine.js";           // fixed
import { saveGame } from "../games/uno/state.js";                // fixed
import { createUnoChannel } from "../utils/channel.js";          // stays the same
import { unoEmbed } from "../utils/unoEmbed.js";                 // stays the same
import { temp } from "../utils/tempMessage.js";                  // stays the same
import { getUser, saveUser } from "../services/userCache.js";    // stays the same

export async function unoStart(client, message, args) {
  const bet = parseInt(args[2]);
  if (isNaN(bet) || bet <= 0)
    return message.reply("Please enter a valid bet amount. Usage: `!g uno <bet>`");

  const user = await getUser(message.author.id);
  if (user.balance < bet)
    return message.reply("You don’t have enough money for that bet.");

  // deduct bet
  user.balance -= bet;
  await saveUser(message.author.id, user);

  const guild = message.guild;
  const channel = await createUnoChannel(guild, message.author, process.env.UNO_CATEGORY_ID);

  // create game state
  const state = newGameState(bet);
  state.channelId = channel.id;
  state.userId = message.author.id;

  const embed = unoEmbed(state);
  const statusMsg = await channel.send({ content: `${message.author}`, embeds: [embed] });

  state.embedMessageId = statusMsg.id;
  await saveGame(state.userId, state);

  // start message collector
  startUnoCollector(client, channel, state.userId);

  return;
}

