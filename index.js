import { Client, GatewayIntentBits, Partials } from "discord.js";
import express from "express";
import "./commands/services/firebase.js";
import { loadCommands } from "./commands/utils/commandLoader.js";
import { messageRouter } from "./commands/utils/router.js";
import { updateTopThreeRole } from "./commands/services/roles.js";

const THINKING_EMOJI = process.env.THINKING_EMOJI || "🤔";
const CLIENT_TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions // <-- allow reaction management
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

  // Run role update immediately on startup
  await updateTopThreeRole(client);

  // Then repeat every 5 minutes
  setInterval(() => updateTopThreeRole(client), 5 * 60 * 1000);
});

// Route messages and manage thinking reaction
client.on("messageCreate", async (msg) => {
  try {
    // ignore bots (including self)
    if (msg.author.bot) return;

    // add thinking reaction to the player's message (best-effort)
    try {
      await msg.react(THINKING_EMOJI);
    } catch (reactErr) {
      // If a custom emoji is invalid/unavailable or permissions are missing,
      // log but keep going.
      console.warn("Could not add thinking reaction:", reactErr.message || reactErr);
    }

    // Call your router (do not await its internal replies here)
    // If messageRouter returns a promise we still call but we won't rely on it to know when the bot replied
    // so the collector approach below captures the actual reply message.
    try {
      // If your router returns a Promise, we don't need to await it here.
      // But calling it synchronously (no await) ensures the reaction is already placed.
      // If messageRouter needs to be awaited for side-effects, it still runs.
      const maybePromise = messageRouter(client, msg);
      // optional: await maybePromise if you want messageRouter to finish first:
      // await maybePromise;
    } catch (routerErr) {
      console.error("messageRouter error:", routerErr);
    }

    // Wait for the bot's reply in the same channel (max 30s)
    // We listen for the first message from the bot in this channel.
    const filter = m => m.author?.id === client.user.id && m.channel.id === msg.channel.id;
    const collected = await msg.channel.awaitMessages({
      filter,
      max: 1,
      time: 30_000,
      errors: []
    }).catch(() => null);

    // Remove our own reaction from the original user message
    try {
      const reaction = msg.reactions.cache.get(THINKING_EMOJI) || msg.reactions.cache.find(r => r.emoji?.toString() === THINKING_EMOJI);
      if (reaction) {
        // remove the bot's user from the reaction (leaves other users' reactions intact)
        await reaction.users.remove(client.user.id).catch(() => {});
      } else {
        // fallback: try to remove any reaction that matches by raw emoji string
        await msg.reactions.removeAll().catch(() => {});
      }
    } catch (rmErr) {
      console.warn("Failed to remove thinking reaction:", rmErr.message || rmErr);
    }

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
