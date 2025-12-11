import { getFirestore } from "firebase-admin/firestore";
import "dotenv/config";

const db = getFirestore();
const ROLE_ID = process.env.ROLE_ID;
const GUILD_ID = process.env.GUILD_ID; // Make sure you have your server ID in env

/**
 * Update roles for the top 3 richest users.
 * @param {Client} client - The Discord.js client
 */
export async function updateTopRichRoles(client) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) return console.error("Guild not found");

    // Fetch all users sorted by balance descending
    const usersSnap = await db.collection("users").orderBy("balance", "desc").limit(3).get();
    const topUsers = usersSnap.docs.map(doc => doc.id); // doc.id should be Discord user ID

    // Fetch all members
    await guild.members.fetch(); // Ensure cache is populated
    const members = guild.members.cache;

    for (const [id, member] of members) {
      if (topUsers.includes(id)) {
        // Give role if missing
        if (!member.roles.cache.has(ROLE_ID)) {
          await member.roles.add(ROLE_ID).catch(console.error);
        }
      } else {
        // Remove role if they have it
        if (member.roles.cache.has(ROLE_ID)) {
          await member.roles.remove(ROLE_ID).catch(console.error);
        }
      }
    }

    console.log("Top rich roles updated successfully!");
  } catch (err) {
    console.error("Error updating top rich roles:", err);
  }
}

/**
 * Starts the interval loop
 * @param {Client} client
 */
export function startRoleUpdater(client) {
  updateTopRichRoles(client); // Run immediately
  setInterval(() => updateTopRichRoles(client), 5 * 60 * 1000); // Every 5 minutes
}
