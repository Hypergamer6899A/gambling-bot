// commands/services/userCache.js
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

// In-memory cache
const cache = new Map();
// Per-user debounce timers
const saveTimers = new Map();

const SAVE_DELAY_MS = 2000;

// ─── Core ─────────────────────────────────────────────────────────────────────

export async function getUser(id) {
  if (cache.has(id)) return cache.get(id);

  const snap = await db.collection("users").doc(id).get();
  const data = snap.exists ? snap.data() : {};

  // Inject defaults for any missing fields
  data.balance        ??= 1000;
  data.blackjackStreak ??= 0;

  cache.set(id, data);
  return data;
}

export async function saveUser(id, data) {
  // Always update the in-memory cache immediately
  cache.set(id, data);

  // Clear any existing timer and reset — last write in the window wins
  if (saveTimers.has(id)) clearTimeout(saveTimers.get(id));

  const timer = setTimeout(async () => {
    saveTimers.delete(id);
    await db.collection("users").doc(id).set(cache.get(id), { merge: true })
      .catch(err => console.error(`[userCache] Failed to save ${id}:`, err));
  }, SAVE_DELAY_MS);

  saveTimers.set(id, timer);
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

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
