import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { db } from "./firebase.js";
import express from "express";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers // required to manage roles
  ]
});

client.commands = new Collection();

// ----- Config -----
const ALLOWED_CHANNEL_ID = "1434934862430867487";
const GUILD_ID = "1429845180437102645";
const TOP_ROLE_ID = "1434989027555016755"; // one shared role for top 3 users

// ----- Load Commands -----
const foldersPath = path.join(process.cwd(), "commands");
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// ----- Ready Event -----
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await updateTopRoles();
  client.user.setPresence({
    activities: [{ name: "LETS GO GAMBLING", type: 0 }],
    status: "online"
  });
});

// ----- Top Role Updater -----
async function updateTopRoles() {
  console.log("Running updateTopRoles...");
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    const snapshot = await db.collection("users")
      .orderBy("balance", "desc")
      .limit(3)
      .get();

    const topUsers = snapshot.docs.map(doc => doc.id);
    console.log("Top users:", topUsers);

    // remove the top role from everyone
    for (const member of guild.members.cache.values()) {
      if (member.roles.cache.has(TOP_ROLE_ID)) {
        await member.roles.remove(TOP_ROLE_ID).catch(() => {});
      }
    }

    // assign to top 3
    for (const id of topUsers) {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) {
        await member.roles.add(TOP_ROLE_ID).catch(err =>
          console.error(`Failed to add role to ${id}:`, err.message)
        );
      }
    }

    console.log("Completed updateTopRoles.");
  } catch (err) {
    console.error("Error updating top roles:", err);
  }
}

// ----- Interaction Handler -----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: `You can only use commands in <#${ALLOWED_CHANNEL_ID}>.`,
      ephemeral: true
    });
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
    await updateTopRoles(); // refresh leaderboard roles
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred)
      await interaction.followUp({ content: "Error executing command.", ephemeral: true });
    else
      await interaction.reply({ content: "Error executing command.", ephemeral: true });
  }
});

// ----- Web Server (for Render) -----
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// ----- Login -----
client.login(process.env.TOKEN);
