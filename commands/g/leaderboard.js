import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
const ROLE_ID = process.env.ROLE_ID;
const GUILD_ID = process.env.GUILD_ID;

export async function updateTopThreeRole(client) {
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) return;

  // Ensure full member list is loaded
  await guild.members.fetch();

  const usersSnapshot = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(3)
    .get();

  const topThreeIds = usersSnapshot.docs.map(doc => doc.id);

  const role = guild.roles.cache.get(ROLE_ID);
  if (!role) return;

  guild.members.cache.forEach(member => {
    const isTopThree = topThreeIds.includes(member.id);

    if (isTopThree && !member.roles.cache.has(role.id)) {
      member.roles.add(role).catch(() => {});
    } else if (!isTopThree && member.roles.cache.has(role.id)) {
      member.roles.remove(role).catch(() => {});
    }
  });
}
