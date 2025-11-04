import { Client, GatewayIntentBits, Collection, ActivityType } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { updateTopRoles } from "./topRoles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();

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

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try { await updateTopRoles(client); } 
  catch (err) { console.error("Error running updateTopRoles:", err); }
  
  client.user.setPresence({
    activities: [{ name: "LETS GO GAMBLING", type: ActivityType.Playing }],
    status: "online"
  });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Error in /${interaction.commandName}:`, err);
    const msg = { content: "Error executing command.", ephemeral: true };
    if (!interaction.deferred && !interaction.replied) await interaction.reply(msg).catch(() => {});
    else await interaction.followUp(msg).catch(() => {});
  }
});

// Keepalive server
const app = express();
app.get('/', (_, res) => res.send('OK'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🌐 Keepalive running on port ${PORT}`));

client.login(process.env.TOKEN);
