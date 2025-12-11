import { Client, GatewayIntentBits, Partials } from "discord.js";
import express from "express";
import "./services/firebase.js";
import { loadCommands } from "./utils/commandLoader.js";
import { messageRouter } from "./utils/router.js";
import { updateTopThreeRole } from "./services/roles.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Presence
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "!g help | LETS GO GAMBLING" }],
    status: "online"
  });
});

// Route messages
client.on("messageCreate", msg => messageRouter(client, msg));

// Top 3 role update every 5 minutes
setInterval(() => updateTopThreeRole(client), 300000);

// Keepalive
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 3000);

// Start bot
client.login(process.env.TOKEN);
