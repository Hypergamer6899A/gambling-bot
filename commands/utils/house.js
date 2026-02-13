import { getUser, saveUser } from "../services/userCache.js";

const BOT_ID = process.env.BOT_ID;
const BOT_NAME = "Gambler"; // name for the house
const STARTING_BALANCE = 100000;

/**
 * Ensure the house exists in the DB/cache
 * @returns {Promise<object>} the house user object
 */
export async function getHouse() {
  const ref = db.collection("users").doc(BOT_ID);
  const snap = await ref.get();

  let house;

  if (!snap.exists) {
    house = {
      balance: STARTING_BALANCE,
      blackjackStreak: 0,
      name: BOT_NAME,
    };

    await saveUser(BOT_ID, house);
  } else {
    house = await getUser(BOT_ID);

    // Ensure correct starting balance if missing
    if (house.balance == null) {
      house.balance = STARTING_BALANCE;
      await saveUser(BOT_ID, house);
    }
  }

  return house;
}


/**
 * Adjust the house balance
 * @param {number} amount - positive to add, negative to subtract
 */
export async function updateHouse(amount) {
  const house = await getHouse();
  house.balance += amount;
  await saveUser(BOT_ID, house);
  return house.balance;
}

/**
 * Process a player's win/loss
 * @param {number} playerAmount - positive if player wins, negative if loses
 */
export async function processGame(playerAmount) {
  // Player wins = negative for house
  await updateHouse(-playerAmount);
}
