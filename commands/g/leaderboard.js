import { getFirestore } from "firebase-admin/firestore";
import { EmbedBuilder } from "discord.js";

export async function leaderboardCommand(client, message) {
  const db = getFirestore();

  // Fetch top 5 users
  const usersSnapshot = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(5)
    .get();

  const users = usersSnapshot.docs.map(doc => ({ id: doc.id, balance: doc.data().balance }));

  // Fetch house balance
  const houseDoc = await db.collection("users").doc("house").get();
  const houseBalance = houseDoc.exists ? houseDoc.data().balance : 0;

  // Add house as a pseudo-user
  users.push({ id: "house", balance: houseBalance });

  // Sort again by balance
  users.sort((a, b) => b.balance - a.balance);

  // Take top 5 after including house
  const topUsers = users.slice(0, 5);

  let text = "";
  let rank = 1;
  for (const u of topUsers) {
    const display = u.id === "house" ? "The House 🏠" : `<@${u.id}>`;
    text += `**${rank}.** ${display} — $${u.balance}\n`;
    rank++;
  }

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("Green")
        .setTitle("Leaderboard — Top Balances")
        .setDescription(text || "No users found.")
    ]
  });
}
