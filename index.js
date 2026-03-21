import { Client, GatewayIntentBits, Partials } from "discord.js";
import express from "express";

import "./commands/services/firebase.js";
import { messageRouter } from "./commands/utils/router.js";
import { startMemoryMonitor } from "./memoryMonitor.js";
import { updateTopThreeRole } from "./commands/services/roles.js";
import {
  addThinkingReaction,
  removeThinkingReaction
} from "./commands/services/reactionService.js";

const THINKING_EMOJI = process.env.THINKING_EMOJI || "🤔";
const CLIENT_TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

// Gambling channel (set in Render environment variables)
const GAMBLING_CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});


// =========================
// Bot Startup
// =========================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "!g help | LETS GO GAMBLING" }],
    status: "online"
  });

  startMemoryMonitor();

  // Check env variable exists
  if (!GAMBLING_CHANNEL_ID) {
    console.error("ERROR: CHANNEL_ID is not set in Render environment variables!");
  } else {
    console.log(`Gambling commands restricted to channel ID: ${GAMBLING_CHANNEL_ID}`);
  }

  // Role updater
  await updateTopThreeRole(client);
  setInterval(() => updateTopThreeRole(client), 5 * 60 * 1000);
});


// =========================
// Message Handler
// =========================
client.on("messageCreate", async (msg) => {
  try {
    // Ignore bots
    if (msg.author.bot) return;

    // Only respond to gambling prefix
    if (!msg.content.startsWith("!g")) return;

    // Ensure channel ID is set
    if (!GAMBLING_CHANNEL_ID) {
      console.error("CHANNEL_ID missing, cannot enforce gambling channel.");
      return;
    }

    // Wrong channel enforcement
    if (msg.channel.id !== GAMBLING_CHANNEL_ID) {
      const warning = await msg.reply(
        `Wrong channel! Please use gambling commands in <#${GAMBLING_CHANNEL_ID}>.`
      );

      // Delete both messages after 5 seconds
      setTimeout(() => {
        msg.delete().catch(() => {});
        warning.delete().catch(() => {});
      }, 5000);

      return; // STOP here, do not run router
    }

    // Add thinking reaction
    await addThinkingReaction(msg, THINKING_EMOJI);

    // Run router properly
    await messageRouter(client, msg);

    // Remove thinking reaction after command completes
    await removeThinkingReaction(msg, THINKING_EMOJI, client.user.id);

  } catch (err) {
    console.error("messageCreate handler error:", err);
  }
});


// =========================
// Keepalive Server (Render)
// =========================
const app = express();

app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT, () => {
  console.log(`Keepalive server running on port ${PORT}`);
});


// =========================
// Start Bot
// =========================
client.login(CLIENT_TOKEN);
