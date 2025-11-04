import { Client, GatewayIntentBits, Collection } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { updateTopRoles } from "./topRoles.js";

// --- File path setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Discord client setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// --- Load all command files (.js) ---
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const commandModule = await import(`file://${filePath}`);
  if (commandModule.data && typeof commandModule.execute === "function") {
    client.commands.set(commandModule.data.name, commandModule);
  } else {
    console.warn(`⚠️ Skipped loading ${file} — missing data or execute()`);
  }
}

// --- Keepalive Express server (for Render) ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log(`🌐 Keepalive running on port ${PORT}`));

// --- Ready event ---
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await updateTopRoles(client);
  } catch (err) {
    console.error("Error running updateTopRoles:", err);
  }
  client.user.setPresence({
    activities: [{ name: "LETS GO GAMBLING", type: 0 }],
    status: "online",
  });
});

// --- Interaction handler ---
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Error in /${interaction.commandName}:`, err);
    const msg = { content: "Error executing command.", ephemeral: true };
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(msg).catch(() => {});
    } else {
      await interaction.followUp(msg).catch(() => {});
    }
  }
});
// Keepalive server to bypass Render port scan
const app = express();
app.get('/', (_, res) => res.send('OK'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🌐 Keepalive running on port ${PORT}`));

// --- Login ---
client.login(process.env.TOKEN);
