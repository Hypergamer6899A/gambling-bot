import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import express from "express";
import { updateTopRoles } from "./topRoles.js";

dotenv.config();

// ----- Client Setup -----
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();

// ----- Load Commands -----
const commandFiles = fs
  .readdirSync(path.join(process.cwd(), "commands"))
  .filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  if (!command.data || !command.execute) {
    console.warn(`Command ${file} is missing data or execute export.`);
    continue;
  }
  client.commands.set(command.data.name, command);
}

// ----- Ready Event -----
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    await updateTopRoles(client);
  } catch (err) {
    console.error("Error updating top roles:", err);
  }

  client.user.setPresence({
    activities: [{ name: "LETS GO GAMBLING", type: 0 }],
    status: "online",
  });
});

// ----- Interaction Handler -----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`No command found for ${interaction.commandName}`);
    return;
  }

  try {
    // Make sure the command executes within Discord's 3-second window
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    const msg = { content: "Error executing command.", ephemeral: true };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch {
      console.warn(
        "Could not send error message; interaction may have expired."
      );
    }
  }
});

// ----- Web Server (Render) -----
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 3000, () =>
  console.log(`Listening on port ${process.env.PORT || 3000}`)
);

// ----- Login -----
client.login(process.env.TOKEN).catch((err) => {
  console.error("Failed to login:", err);
});
