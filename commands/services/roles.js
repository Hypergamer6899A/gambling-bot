import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
const ROLE_ID = process.env.ROLE_ID;

export async function updateTopThreeRole(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const usersSnapshot = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(3)
    .get();

  const topThreeIds = usersSnapshot.docs.map(doc => doc.id);

  const role = guild.roles.cache.get(ROLE_ID);
  if (!role) return;

  const members = await guild.members.fetch(); // forces full member list

members.forEach(member => {
  if (topThreeIds.includes(member.id)) {
    if (!member.roles.cache.has(role.id)) member.roles.add(role).catch(() => {});
  } else {
    if (member.roles.cache.has(role.id)) member.roles.remove(role).catch(() => {});
  }
});
}
