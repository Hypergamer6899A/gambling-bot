import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { db } from "./firebase.js";

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// ----- Config -----
const ALLOWED_CHANNEL_ID = "1434934862430867487"; // replace with your channel
const GUILD_ID = "1429845180437102645";             // replace with your server
const ROLE_IDS = {
  first: "1434989027555016755",
  second: "1434989027555016755",
  third: "1434989027555016755"
};

// ----- Load Commands -----
const foldersPath = path.join(process.cwd(), "commands");
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// ----- Ready -----
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateTopRoles(); // optional: run on start
});

// ----- Update Top Roles -----
async function updateTopRoles() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const members = await guild.members.fetch();

    // Get top 3 users by balance
    const snapshot = await db.collection("users").orderBy("balance", "desc").limit(3).get();
    const topUsers = snapshot.docs.map(doc => doc.id);

    // Remove roles from everyone first
    for (const member of members.values()) {
      await member.roles.remove([ROLE_IDS.first, ROLE_IDS.second, ROLE_IDS.third]).catch(() => {});
    }

    // Assign roles
    if (topUsers[0]) (await guild.members.fetch(topUsers[0])).roles.add(ROLE_IDS.first).catch(() => {});
    if (topUsers[1]) (await guild.members.fetch(topUsers[1])).roles.add(ROLE_IDS.second).catch(() => {});
    if (topUsers[2]) (await guild.members.fetch(topUsers[2])).roles.add(ROLE_IDS.third).catch(() => {});

  } catch (err) {
    console.error("Error updating top roles:", err);
  }
}

// ----- Interaction Handler -----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  // Restrict to allowed channel
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

    // After every command, update top roles
    updateTopRoles();

  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred)
      await interaction.followUp({ content: "Error executing command.", ephemeral: true });
    else
      await interaction.reply({ content: "Error executing command.", ephemeral: true });
  }
});

// ----- Login -----
client.login(process.env.TOKEN);
