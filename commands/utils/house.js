import { getFirestore } from "firebase-admin/firestore";
import { getUser, saveUser } from "../services/userCache.js";

const db = getFirestore();

const BOT_ID = process.env.BOT_ID;
const BOT_NAME = "Gambler";
const STARTING_BALANCE = 100000;

if (!BOT_ID) {
  throw new Error("BOT_ID is missing in your environment variables!");
}

export async function getHouse() {
  const ref = db.collection("users").doc(BOT_ID);
  const snap = await ref.get();

  if (!snap.exists) {
    const house = {
      name: BOT_NAME,
      balance: STARTING_BALANCE,
      blackjackStreak: 0,
      isHouse: true,
    };

    await saveUser(BOT_ID, house);
    return house;
  }

  const house = await getUser(BOT_ID);

  if (house.balance == null) {
    house.balance = STARTING_BALANCE;
    await saveUser(BOT_ID, house);
  }

  return house;
}

export async function updateHouse(amount) {
  const house = await getHouse();
  house.balance += amount;
  await saveUser(BOT_ID, house);
  return house.balance;
}

export async function processGame(playerAmount) {
  // Player wins → house loses money
  await updateHouse(-playerAmount);
}
