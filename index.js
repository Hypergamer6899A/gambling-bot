import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };
import { Client, GatewayIntentBits } from "discord.js";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://<your-project-id>.firebaseio.com"
  });
}

const db = admin.firestore();
export { db };

// --- Discord bot setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith("!balance")) {
    const ref = db.collection("balances").doc(message.author.id);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({ balance: 100 });
      return message.reply("You have been given 100 coins to start.");
    } else {
      const { balance } = doc.data();
      return message.reply(`Your balance is ${balance} coins.`);
    }
  }
});

client.login(process.env.TOKEN);
