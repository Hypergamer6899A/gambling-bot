import { startUnoCollector } from "../uno/collector.js";
import { newGameState } from "../games/uno/engine.js";
import { saveGame } from "../games/uno/state.js";
import { createUnoChannel } from "../utils/channel.js";
import { unoEmbed } from "../utils/unoEmbed.js";
import { temp } from "../utils/tempMessage.js";
import { getUser, saveUser } from "../services/userCache.js";
import { processGame } from "../utils/house.js"; // <-- house integration

export async function unoStart(client, message, args) {
  const bet = parseInt(args[2]);
  if (isNaN(bet) || bet <= 0)
    return message.reply("Please enter a valid bet amount. Usage: `!g uno <bet>`");

  const user = await getUser(message.author.id);
  if (user.balance < bet)
    return message.reply("You don’t have enough money for that bet.");

  // Deduct bet from player
  user.balance -= bet;
  await saveUser(message.author.id, user);

  // Give bet to house immediately
  await processGame(-bet); // house gains bet

  const guild = message.guild;
  const channel = await createUnoChannel(guild, message.author, process.env.UNO_CATEGORY_ID);

  const state = newGameState(bet);
  state.channelId = channel.id;
  state.userId = message.author.id;

  const embed = unoEmbed(state);
  const statusMsg = await channel.send({ content: `${message.author}`, embeds: [embed] });

  state.embedMessageId = statusMsg.id;
  await saveGame(state.userId, state);

  startUnoCollector(client, channel, state.userId);
}
