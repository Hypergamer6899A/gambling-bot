// commands/services/reactionService.js

export async function addThinkingReaction(msg, emoji) {
  try {
    await msg.react(emoji);
  } catch (err) {
    console.warn("[reaction] Could not add thinking reaction:", err.message || err);
  }
}

export async function removeThinkingReaction(msg, emoji, botUserId) {
  try {
    // msg.reactions.cache is empty because ReactionManager is set to 0.
    // Call the REST endpoint directly to delete the bot's own reaction.
    await msg.client.rest.delete(
      `/channels/${msg.channel.id}/messages/${msg.id}/reactions/${encodeURIComponent(emoji)}/@me`
    );
  } catch {
    // Message deleted or reaction already gone — safe to ignore.
  }
}
