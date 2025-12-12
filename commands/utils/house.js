// house.js
const BOT_ID = process.env.BOT_ID;

// In-memory balance for simplicity (replace with DB if needed)
let balance = 100000; // starting house money, can adjust

/**
 * Get the bot's current balance
 * @returns {number}
 */
function getBalance() {
  return balance;
}

/**
 * Adjust the bot's balance
 * @param {number} amount - positive to add, negative to subtract
 */
function updateBalance(amount) {
  balance += amount;
  return balance;
}

/**
 * Process a player's win/loss
 * @param {number} playerAmount - positive if player wins, negative if loses
 * Updates house balance inversely
 */
function processGame(playerAmount) {
  // Player wins = negative for house
  updateBalance(-playerAmount);
  return getBalance();
}

module.exports = {
  BOT_ID,
  getBalance,
  updateBalance,
  processGame,
};
