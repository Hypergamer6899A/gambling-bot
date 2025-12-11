// commands/games/uno/state.js
// In-memory game storage
const games = new Map();

/**
 * Save a game state
 * @param {string} userId - Discord user ID
 * @param {object} state - Game state object
 */
export async function saveGame(userId, state) {
  games.set(userId, state);
}

/**
 * Load a game state
 * @param {string} userId - Discord user ID
 * @returns {object|null} - The game state or null if not found
 */
export async function loadGame(userId) {
  return games.get(userId) || null;
}

/**
 * Delete a game state
 * @param {string} userId - Discord user ID
 */
export async function deleteGame(userId) {
  games.delete(userId);
}

/**
 * Get all ongoing games (for leaderboard or cleanup)
 * @returns {Map<string, object>}
 */
export function getAllGames() {
  return games;
}
