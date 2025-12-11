import { PermissionFlagsBits } from "discord.js";

export async function createUnoChannel(guild, user, categoryId) {
  const name = `uno-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${user.id.slice(-4)}`;

  const existing = guild.channels.cache.find(c => c.name === name);
  if (existing) await existing.delete().catch(()=>{});

  return guild.channels.create({
    name,
    type: 0,
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]
  });
}

