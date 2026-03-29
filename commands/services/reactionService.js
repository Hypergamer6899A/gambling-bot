// commands/services/reactionService.js

function toApiEmoji(emoji) {
  const custom = emoji.match(/^<(a?:\w+:\d+)>$/);
  return custom ? custom[1] : emoji;
}

export async function addThinkingReaction(msg, emoji) {
  try {
    await msg.react(emoji);
  } catch (err) {
    console.warn("[reaction] Could not add thinking reaction:", err.message || err);
  }
}

export async function removeThinkingReaction(msg, emoji, botUserId) {
  try {
    const apiEmoji = encodeURIComponent(toApiEmoji(emoji));
    await msg.client.rest.delete(
      `/channels/${msg.channel.id}/messages/${msg.id}/reactions/${apiEmoji}/@me`
    );
  } catch {
    // Message deleted or reaction already gone — safe to ignore.
  }
}
