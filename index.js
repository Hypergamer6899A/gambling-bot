import { Client, GatewayIntentBits, Partials } from "discord.js";
import express from "express";
import "./commands/services/firebase.js";
import { messageRouter } from "./commands/utils/router.js";
import { updateTopThreeRole } from "./commands/services/roles.js";
import { addThinkingReaction, removeThinkingReaction } from "./commands/services/reactionService.js";
import { startMemoryMonitor } from "./memoryMonitor.js";

const THINKING_EMOJI     = process.env.THINKING_EMOJI || "🤔";
const CLIENT_TOKEN       = process.env.TOKEN;
const PORT               = process.env.PORT || 3000;
const GAMBLING_CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // GuildMessageReactions removed — react() works without it,
    // and caching all reactions was a significant memory cost
  ],
  partials: [Partials.Channel, Partials.Message],
  makeCache: Options => {
    // Only keep what the bot actually needs cached
    return Options.cacheWithLimits({
      ...Options.defaultMakeCacheSettings,
      MessageManager:         50,   // last 50 messages per channel (default: 200)
      ReactionManager:        0,    // not needed — we removed the reactions intent
      GuildEmojiManager:      0,    // bot doesn't use server emojis from cache
      PresenceManager:        0,    // bot doesn't track member presences
      VoiceStateManager:      0,    // no voice features
      GuildInviteManager:     0,    // no invite tracking
      ThreadManager:          0,    // no thread features
      GuildStickerManager:    0,    // no sticker features
    });
  },
});

// =========================
// Bot Startup
// =========================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "!g help | LETS GO GAMBLING" }],
    status: "online",
  });

  if (!GAMBLING_CHANNEL_ID) {
    console.error("ERROR: CHANNEL_ID is not set in environment variables!");
  } else {
    console.log(`Gambling commands restricted to channel: ${GAMBLING_CHANNEL_ID}`);
  }

  startMemoryMonitor();

  await updateTopThreeRole(client);
  setInterval(() => updateTopThreeRole(client), 5 * 60 * 1000);
});

// =========================
// Message Handler
// =========================
client.on("messageCreate", async (msg) => {
  try {
    if (msg.author.bot) return;
    if (!msg.content.startsWith("!g")) return;

    if (!GAMBLING_CHANNEL_ID) {
      console.error("CHANNEL_ID missing, cannot enforce gambling channel.");
      return;
    }

    if (msg.channel.id !== GAMBLING_CHANNEL_ID) {
      const warning = await msg.reply(
        `Wrong channel! Please use gambling commands in <#${GAMBLING_CHANNEL_ID}>.`
      );
      setTimeout(() => {
        msg.delete().catch(() => {});
        warning.delete().catch(() => {});
      }, 5000);
      return;
    }

    await addThinkingReaction(msg, THINKING_EMOJI);
    await messageRouter(client, msg);
    await removeThinkingReaction(msg, THINKING_EMOJI, client.user.id);
  } catch (err) {
    console.error("messageCreate handler error:", err);
  }
});

// =========================
// Keepalive Server
// =========================
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log(`Keepalive server running on port ${PORT}`));

// =========================
// Start Bot
// =========================
client.login(CLIENT_TOKEN);
