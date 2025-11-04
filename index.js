import { Client, GatewayIntentBits, Collection } from "discord.js";
import fs from "fs";
import path from "path";
import express from "express";
import { updateTopRoles } from "./topRoles.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.commands = new Collection();

// Load commands from commands/ folder
const commandFiles = fs.readdirSync(path.join("./commands")).filter(f => f.endsWith(".js"));
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  if (command.data && command.execute) client.commands.set(command.data.name, command);
}

// Ready
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await updateTopRoles(client);
});

// Interaction handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try { await command.execute(interaction); }
  catch (err) { console.error(err); await interaction.reply({ content: "Error.", ephemeral: true }); }
});

// Keepalive server
const app = express();
app.get("/", (_, res) => res.send("Bot running."));
app.listen(process.env.PORT || 3000);

// Login
client.login(process.env.TOKEN);
