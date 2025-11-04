import { Client, GatewayIntentBits, Collection } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

// Load all commands
for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = (await import(`file://${filePath}`)).default;
    if (command?.data?.name && typeof command.execute === "function") {
      client.commands.set(command.data.name, command);
    }
  }
}

client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  // background updates only, never touch interactions here
  try {
    await updateTopRoles(client);
  } catch (err) {
    console.error("Error running updateTopRoles:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Error in ${interaction.commandName}:`, err);

    // handle only if the interaction is still open
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "There was an error executing this command.",
        ephemeral: true,
      }).catch(() => {});
    } else {
      await interaction.followUp({
        content: "Something went wrong after execution.",
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
