export async function temp(channel, text, ttl = 3500) {
  const msg = await channel.send(text).catch(()=>null);
  if (!msg) return;
  setTimeout(() => msg.delete().catch(()=>{}), ttl);
}

