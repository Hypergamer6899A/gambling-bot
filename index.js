import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import express from "express";
import { updateTopRoles } from "./topRoles.js";

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();

// ----- Load Commands -----
const commandFiles = fs.readdirSync(path.join(process.cwd(), "commands")).filter(f => f.endsWith(".js"));
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// ----- Ready Event -----
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await updateTopRoles(client);
  client.user.setPresence({
    activities: [{ name: "LETS GO GAMBLING", type: 0 }],
    status: "online"
  });
});

// ----- Interaction Handler -----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    const msg = { content: "Error executing command.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

// ----- Web Server (Render) -----
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 3000, () =>
  console.log(`Listening on port ${process.env.PORT || 3000}`)
);

// ----- Login -----
client.login(process.env.TOKEN);
