import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import express from "express";
import { updateTopRoles } from "./topRoles.js";

dotenv.config();

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
  client.commands.set(command.data.name, command);
}

// ----- Ready Event -----
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await updateTopRoles(client);
  } catch (err) {
    console.error("Error updating top roles on ready:", err);
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
    return interaction.reply({
      content: "Unknown command.",
      ephemeral: true,
    }).catch(() => {});
  }

  try {
    // Ensure we handle both deferred and immediate responses safely
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`Error executing command ${interaction.commandName}:`, err);

    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: "There was an error executing this command.",
        });
      } else if (interaction.replied) {
        await interaction.followUp({
          content: "There was an error executing this command.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error executing this command.",
          ephemeral: true,
        });
      }
    } catch (err2) {
      console.error("Failed to send error reply:", err2);
    }
  }
});

// ----- Catch unhandled promise rejections -----
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// ----- Web Server (Render) -----
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 3000, () =>
  console.log(`Listening on port ${process.env.PORT || 3000}`)
);

// ----- Login -----
client.login(process.env.TOKEN).catch((err) => {
  console.error("Login failed:", err);
});
