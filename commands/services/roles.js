// commands/services/roles.js
import { getFirestore } from "firebase-admin/firestore";

const db      = getFirestore();
const ROLE_ID  = process.env.ROLE_ID;
const GUILD_ID = process.env.GUILD_ID;

export async function updateTopThreeRole(client) {
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) return;

  const role = guild.roles.cache.get(ROLE_ID);
  if (!role) return;

  const snap = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(3)
    .get();

  const topThreeIds = new Set(
    snap.docs.map(doc => doc.id).filter(id => id !== process.env.BOT_ID)
  );

  // Fetch only the top 3 members individually instead of the entire guild
  const topMembers = new Map();
  for (const id of topThreeIds) {
    const member = await guild.members.fetch(id).catch(() => null);
    if (member) {
      topMembers.set(id, member);
      if (!member.roles.cache.has(ROLE_ID)) {
        await member.roles.add(role).catch(() => {});
      }
    }
  }

  // For stripping the role, only fetch members who currently have it
  // rather than pulling the entire guild member list
  const roleMembers = await role.members.fetch
    ? role.members  // role.members is already a cached collection
    : new Map();

  role.members.forEach(member => {
    if (!topThreeIds.has(member.id)) {
      member.roles.remove(role).catch(() => {});
    }
  });
}
