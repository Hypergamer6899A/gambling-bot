
import fs from "fs";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { readdirSync } from "fs";
import "dotenv/config";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// load commands
for (const file of readdirSync("./commands")) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

client.once("ready", () => console.log(`${client.user.tag} is online.`));

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: "Error executing command.", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
