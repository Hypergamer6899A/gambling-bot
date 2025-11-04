import { Client, GatewayIntentBits, Collection } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { updateTopRoles } from "./topRoles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// --- Load all .js commands directly ---
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = (await import(`file://${filePath}`)).default;
  if (command?.data?.name && typeof command.execute === "function") {
    client.commands.set(command.data.name, command);
  }
}

// --- Express keepalive to satisfy Render port scan ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log(`Keepalive server on port ${PORT}`));

// --- Discord events ---
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await updateTopRoles(client);
  } catch (err) {
    console.error("Error running updateTopRoles:", err);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Error in ${interaction.commandName}:`, err);
    const msg = { content: "There was an error executing this command.", ephemeral: true };
    if (!interaction.replied && !interaction.deferred) await interaction.reply(msg).catch(() => {});
    else await interaction.followUp(msg).catch(() => {});
  }
});

client.login(process.env.TOKEN);
