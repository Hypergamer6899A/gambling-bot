// commands/utils/house.js
import { getUser, saveUser } from "../services/userCache.js";

const BOT_ID          = process.env.BOT_ID;
const STARTING_BALANCE = 100_000;

if (!BOT_ID) {
  throw new Error("BOT_ID is missing from environment variables.");
}

// ─── House account ────────────────────────────────────────────────────────────

export async function getHouse() {
  const house = await getUser(BOT_ID);

  // Inject defaults if this is a fresh house account
  house.name        ??= "Gambler";
  house.balance     ??= STARTING_BALANCE;
  house.jackpotPot  ??= 0;
  house.isHouse     ??= true;

  return house;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updateHouse(amount) {
  const house = await getHouse();
  house.balance += amount;
  await saveUser(BOT_ID, house);
  return house.balance;
}

/**
 * Mirrors a player payout/loss against the house balance.
 * Positive playerAmount = player won (house loses).
 * Negative playerAmount = player lost (house gains).
 */
export async function processGame(playerAmount) {
  await updateHouse(-playerAmount);
}
