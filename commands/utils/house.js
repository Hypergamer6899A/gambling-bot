// src/commands/utils/house.js
const BOT_ID = process.env.BOT_ID;

// In-memory balance (adjust starting house money as needed)
let balance = 100000;

/**
 * Get the bot's current balance
 * @returns {number}
 */
export function getBalance() {
  return balance;
}

/**
 * Adjust the bot's balance
 * @param {number} amount - positive to add, negative to subtract
 */
export function updateBalance(amount) {
  balance += amount;
  return balance;
}

/**
 * Process a player's win/loss
 * @param {number} playerAmount - positive if player wins, negative if loses
 * Updates house balance inversely
 */
export function processGame(playerAmount) {
  // Player wins = negative for house
  updateBalance(-playerAmount);
  return getBalance();
}
