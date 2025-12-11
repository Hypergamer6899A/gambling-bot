import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
const users = new Map();
const pendingSaves = new Map();

export async function getUser(id) {
  if (users.has(id)) return users.get(id);

  const ref = db.collection("users").doc(id);
  const snap = await ref.get();

  let data = snap.exists ? snap.data() : {
    balance: 1000,
    blackjackStreak: 0,
  };

  // Inject defaults
  if (data.balance == null) data.balance = 1000;
  if (data.blackjackStreak == null) data.blackjackStreak = 0;

  users.set(id, data);
  return data;
}

export async function saveUser(id, data) {
  users.set(id, data);

  // if already scheduled, don't spam Firestore
  if (pendingSaves.has(id)) return;

  pendingSaves.set(id, true);

  setTimeout(async () => {
    const ref = db.collection("users").doc(id);
    await ref.set(users.get(id), { merge: true });

    pendingSaves.delete(id);
  }, 250);
}

export async function addBalance(id, amount) {
  const data = await getUser(id);
  data.balance += amount;
  await saveUser(id, data);
  return data.balance;
}

export async function setBalance(id, amount) {
  const data = await getUser(id);
  data.balance = amount;
  await saveUser(id, data);
  return amount;
}

export async function getBalance(id) {
  const data = await getUser(id);
  return data.balance;
}

