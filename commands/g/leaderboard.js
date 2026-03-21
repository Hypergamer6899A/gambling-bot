// commands/g/leaderboard.js
import { getFirestore } from "firebase-admin/firestore";
import { getHouse } from "../utils/house.js";
import { leaderboardEmbed } from "../utils/embeds.js";

const db     = getFirestore();
const BOT_ID = process.env.BOT_ID;

export async function leaderboardCommand(client, message) {
  const [snap, house] = await Promise.all([
    db.collection("users").orderBy("balance", "desc").get(),
    getHouse(),
  ]);

  // Filter out the house account from player rankings
  const allUsers = snap.docs
    .filter(doc => doc.id !== BOT_ID)
    .map(doc => ({ id: doc.id, balance: doc.data().balance }));

  const top5       = allUsers.slice(0, 5);
  const callerRank = allUsers.findIndex(u => u.id === message.author.id);

  const callerEntry = callerRank >= 5
    ? { ...allUsers[callerRank], rank: callerRank + 1 }
    : null;

  return message.reply({ embeds: [leaderboardEmbed(top5, callerEntry, house)] });
}
