import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
dotenv.config();

// Env vars
const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  CHANNEL_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_PROJECT_ID,
} = process.env;

// Firebase init
initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Slash command: /help
const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available commands")
    .toJSON(),
];

// Deploy slash commands
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Slash commands registered");
  } catch (e) {
    console.error("Command registration failed:", e);
  }
})();

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "help") {
    await interaction.reply({
      content: "Commands:\n- `/help`: show this menu\n- `!g`: gamble in the designated channel",
      ephemeral: true,
    });
  }
});

// Handle gambling text commands
client.on("messageCreate", async (msg) => {
  if (msg.channel.id !== CHANNEL_ID) return;
  if (!msg.content.startsWith("!g")) return;

  const args = msg.content.split(" ");
  const cmd = args[1];

  const userRef = db.collection("users").doc(msg.author.id);
  const userSnap = await userRef.get();
  let balance = userSnap.exists ? userSnap.data().balance : 1000;

  // Basic gamble logic
  if (cmd === "bet") {
    const amount = parseInt(args[2]);
    if (isNaN(amount) || amount <= 0) return msg.reply("Enter a valid amount.");
    if (amount > balance) return msg.reply("You don't have enough coins.");

    const win = Math.random() < 0.5;
    balance += win ? amount : -amount;
    await userRef.set({ balance }, { merge: true });
    msg.reply(`${win ? "You won" : "You lost"}! New balance: ${balance}`);
  } else {
    msg.reply("Usage: `!g bet <amount>`");
  }
});

client.login(TOKEN);
