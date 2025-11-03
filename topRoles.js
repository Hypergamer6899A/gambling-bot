import { db } from "./firebase.js";

const GUILD_ID = "1429845180437102645";
const TOP_ROLE_ID = "1434989027555016755";

export async function updateTopRoles(client) {
  try {
    if (!client) throw new Error("Client not provided to updateTopRoles");

    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    // Get top 3 users by balance
    const snapshot = await db.collection("users").orderBy("balance", "desc").limit(3).get();
    const topUsers = snapshot.docs.map(doc => doc.id);

    // Remove top role from everyone
    for (const member of guild.members.cache.values()) {
      if (member.roles.cache.has(TOP_ROLE_ID)) {
        await member.roles.remove(TOP_ROLE_ID).catch(() => {});
      }
    }

    // Assign top role to top 3
    for (const id of topUsers) {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) await member.roles.add(TOP_ROLE_ID).catch(() => {});
    }

  } catch (err) {
    console.error("Error updating top roles:", err);
  }
}
