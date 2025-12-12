import { createUnoChannel } from "../utils/channel.js";
import { unoEmbed } from "../utils/unoEmbed.js";
import { createGame, getGame } from "../games/uno/state.js";
import { startUnoCollector } from "../collectors/unoCollector.js";

export async function unoCommand(client, message, args) {
  const bet = Number(args[0]);
  if (!bet || bet <= 0) return message.reply("Invalid bet.");

  // Create the game channel
  const channel = await createUnoChannel(message.guild, message.author, process.env.UNO_CATEGORY);

  // Build initial state
  const state = {
    userId: message.author.id,
    channelId: channel.id,
    bet,
    turn: "player",
    deck: buildDeck(),
    discard: [],
    playerHand: [],
    botHand: [],
    winner: null
  };

  // Setup the starting situation
  setupInitialHands(state);

  createGame(message.author.id, state);

  await channel.send({ embeds: [unoEmbed(state)] });

  // Start the collector AFTER sending embed
  startUnoCollector(client, channel, message.author.id);
}
