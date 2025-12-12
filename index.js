import { Client, GatewayIntentBits, Partials } from "discord.js";
import express from "express";
import "./commands/services/firebase.js";
import { loadCommands } from "./commands/utils/commandLoader.js";
import { messageRouter } from "./commands/utils/router.js";
import { updateTopThreeRole } from "./commands/services/roles.js";
import { addThinkingReaction, removeThinkingReaction } from "./commands/services/reactionService.js";

const THINKING_EMOJI = process.env.THINKING_EMOJI || "🤔";
const CLIENT_TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// Presence & startup tasks
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "!g help | LETS GO GAMBLING" }],
    status: "online"
  });

  await updateTopThreeRole(client);
  setInterval(() => updateTopThreeRole(client), 5 * 60 * 1000);
});

// Message handler
client.on("messageCreate", async (msg) => {
  try {
    if (msg.author.bot) return;

    // Add thinking reaction
    await addThinkingReaction(msg, THINKING_EMOJI);

    // Run router
    try {
      const maybePromise = messageRouter(client, msg);
      // optional: await maybePromise;
    } catch (routerErr) {
      console.error("messageRouter error:", routerErr);
    }

    // Wait for bot reply to remove the reaction
    const filter = m => m.author?.id === client.user.id && m.channel.id === msg.channel.id;
    await msg.channel.awaitMessages({
      filter,
      max: 1,
      time: 30_000
    }).catch(() => null);

    // Remove the reaction
    await removeThinkingReaction(msg, THINKING_EMOJI, client.user.id);

  } catch (err) {
    console.error("messageCreate handler error:", err);
  }
});

// Keepalive
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT);

// Start bot
client.login(CLIENT_TOKEN);
