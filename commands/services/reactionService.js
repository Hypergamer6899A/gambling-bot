// commands/services/reactionService.js

// Add the 🤔 reaction to the command message
export async function addThinkingReaction(msg, emoji) {
  try {
    await msg.react(emoji);
  } catch (err) {
    console.warn("Could not add thinking reaction:", err.message || err);
  }
}

// Remove ONLY the bot’s own thinking reaction
export async function removeThinkingReaction(msg, emoji, botUserId) {
  try {
    const reaction =
      msg.reactions.cache.get(emoji) ||
      msg.reactions.cache.find(r => r.emoji?.toString() === emoji);

    if (reaction) {
      // remove only the bot's reaction, keep everyone else’s
      await reaction.users.remove(botUserId).catch(() => {});
      return;
    }

    // If no matching reaction exists, do nothing.
    // This avoids accidentally deleting all reactions on a message.
  } catch (rmErr) {
    console.warn("Failed to remove thinking reaction:", rmErr.message || rmErr);
  }
}
