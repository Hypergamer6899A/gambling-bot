// commands/services/reactionService.js
export async function addThinkingReaction(msg, emoji) {
  try {
    await msg.react(emoji);
  } catch (err) {
    console.warn("Could not add thinking reaction:", err.message || err);
  }
}

export async function removeThinkingReaction(msg, emoji, botUserId) {
  try {
    const reaction =
      msg.reactions.cache.get(emoji) ||
      msg.reactions.cache.find(r => r.emoji?.toString() === emoji);

    if (reaction) {
      await reaction.users.remove(botUserId).catch(() => {});
    } else {
      // Fallback – safest minimal option
      await msg.reactions.removeAll().catch(() => {});
    }
  } catch (rmErr) {
    console.warn("Failed to remove thinking reaction:", rmErr.message || rmErr);
  }
}
