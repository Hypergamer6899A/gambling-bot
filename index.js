import { Client, GatewayIntentBits, Collection, REST, Routes, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import admin from "firebase-admin";

dotenv.config();

// ----- Firebase -----
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = admin.firestore();

// ----- Discord -----
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// ----- Commands -----
const COMMANDS = [
  new SlashCommandBuilder().setName("balance").setDescription("Check your balance"),
  new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("Spin the roulette wheel")
    .addStringOption(opt =>
      opt.setName("bet")
        .setDescription("red, black, or green")
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("amount")
        .setDescription("Bet amount")
        .setRequired(true)
    )
];

// ----- Deploy commands -----
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  try {
    console.log("Registering commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: COMMANDS.map(cmd => cmd.toJSON()) }
    );
    console.log("Commands registered.");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
})();

// ----- Command Handlers -----
async function handleBalance(interaction) {
  const userId = interaction.user.id;
  const ref = db.collection("users").doc(userId);

  const doc = await ref.get();
  let balance = doc.exists ? doc.data().balance : 1000;

  if (!doc.exists) await ref.set({ balance, username: interaction.user.username });

  await interaction.editReply(`<@${userId}>, your balance is $${balance.toLocaleString()}.`);
}

async function handleRoulette(interaction) {
  const userId = interaction.user.id;
  const ref = db.collection("users").doc(userId);

  const bet = interaction.options.getString("bet").toLowerCase();
  const amount = interaction.options.getInteger("amount");

  if (!["red", "black", "green"].includes(bet)) {
    return interaction.editReply("Invalid bet. Choose red, black, or green.");
  }
  if (amount <= 0) {
    return interaction.editReply("Bet must be greater than 0.");
  }

  const doc = await ref.get();
  let balance = doc.exists ? doc.data().balance : 1000;

  if (balance < amount) return interaction.editReply("Not enough money.");

  // Deduct bet
  balance -= amount;

  const number = Math.floor(Math.random() * 37); // 0-36
  const color = number === 0 ? "green" : (number % 2 === 0 ? "black" : "red");

  let winnings = 0;
  if (bet === color) winnings = color === "green" ? amount * 10 : amount * 2;

  balance += winnings;

  await ref.set({ balance, username: interaction.user.username });

  const outcome = winnings > 0 ? `You won $${winnings}!` : `You lost $${amount}.`;
  await interaction.editReply(`Roulette result: ${color} ${number}\n${outcome} Balance: $${balance}`);
}

// ----- Interaction Handler -----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    switch (interaction.commandName) {
      case "balance":
        await handleBalance(interaction);
        break;
      case "roulette":
        await handleRoulette(interaction);
        break;
      default:
        await interaction.editReply("Unknown command.");
    }
  } catch (err) {
    console.error("Command error:", err);
    try { await interaction.editReply("Error processing command."); } catch {}
  }
});

// ----- Keepalive -----
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 3000, () => console.log("Listening on port", process.env.PORT));

// ----- Login -----
client.login(process.env.TOKEN);
