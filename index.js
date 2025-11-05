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
    .setDescription("Show available commands and rules")
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

// /help
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "help") {
    await interaction.reply({
      content:
        "**Available Commands:**\n" +
        "`/help` - show this help menu\n" +
        "`!g balance` - check your balance\n" +
        "`!g roulette <red|black|odd|even> <amount>` - bet on roulette",
      ephemeral: true,
    });
  }
});

// Utility: get or create user
async function getUser(userId) {
  const ref = db.collection("users").doc(userId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ balance: 1000 });
    return 1000;
  }
  return snap.data().balance;
}

// Handle gambling messages
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== CHANNEL_ID) return;
  if (!msg.content.startsWith("!g")) return;

  const args = msg.content.trim().split(/\s+/);
  const sub = args[1];

  const userRef = db.collection("users").doc(msg.author.id);
  let balance = await getUser(msg.author.id);

  // !g balance
  if (sub === "balance") {
    return msg.reply(`${msg.author.username}, your balance is ${balance} coins.`);
  }

  // !g roulette <red|black|odd|even> <amount>
  if (sub === "roulette") {
    const choice = args[2]?.toLowerCase();
    const amount = parseInt(args[3]);

    if (!["red", "black", "odd", "even"].includes(choice))
      return msg.reply("Choose one of: red, black, odd, even.");
    if (isNaN(amount) || amount <= 0) return msg.reply("Enter a valid bet amount.");
    if (amount > balance) return msg.reply("You don't have enough coins.");

    const spin = Math.floor(Math.random() * 37); // 0–36
    const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(spin);
    const color = spin === 0 ? "green" : isRed ? "red" : "black";
    const parity = spin === 0 ? "none" : spin % 2 === 0 ? "even" : "odd";

    let win = false;
    if (choice === color || choice === parity) win = true;

    if (win) {
      balance += amount;
      msg.reply(`The wheel landed on **${color} ${spin}** — you **won**! Balance: ${balance}`);
    } else {
      balance -= amount;
      msg.reply(`The wheel landed on **${color} ${spin}** — you **lost**. Balance: ${balance}`);
    }

    await userRef.set({ balance }, { merge: true });
    return;
  }

  // Fallback
  msg.reply("Invalid command. Type `/help` for usage.");
});

client.login(TOKEN);
