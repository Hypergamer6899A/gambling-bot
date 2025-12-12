// utils/tempMessage.js

/**
 * Sends a temporary message and deletes it after a short time.
 * Safe against race conditions and deleted channels.
 */
export async function temp(channel, content, ttl = 3000) {
  try {
    const msg = await channel.send(content);
    if (!msg) return;

    setTimeout(async () => {
      try {
        await msg.delete().catch(() => {});
      } catch {}
    }, ttl);

  } catch {
    // If channel is gone or locked, silently skip
  }
}
