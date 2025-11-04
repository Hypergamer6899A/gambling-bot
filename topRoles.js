import { db } from "./firebase.js";

const GUILD_ID = "1429845180437102645";
const TOP_ROLE_ID = "1434989027555016755";

export async function updateTopRoles(client) {
  if (!client) throw new Error("Client not provided to updateTopRoles");

  try {
    const guild = await client.guilds.fetch(GUILD_ID);

    // Get top 3 users by balance
    const snapshot = await db.collection("users").orderBy("balance", "desc").limit(3).get();
    const topUserIds = snapshot.docs.map(doc => doc.id);

    // Remove top role from cached members only (avoids fetching entire guild)
    for (const member of guild.members.cache.values()) {
      if (member.roles.cache.has(TOP_ROLE_ID) && !topUserIds.includes(member.id)) {
        await member.roles.remove(TOP_ROLE_ID).catch(() => {});
      }
    }

    // Assign top role to top 3, fetch members individually if not cached
    for (const id of topUserIds) {
      let member = guild.members.cache.get(id);
      if (!member) {
        try {
          member = await guild.members.fetch(id);
        } catch {
          continue; // skip if member cannot be fetched
        }
      }
      if (member && !member.roles.cache.has(TOP_ROLE_ID)) {
        await member.roles.add(TOP_ROLE_ID).catch(() => {});
      }
    }

  } catch (err) {
    console.error("Error updating top roles:", err);
  }
}
