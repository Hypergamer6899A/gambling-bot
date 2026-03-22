// commands/services/userCache.js
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

// In-memory cache with TTL eviction
const cache      = new Map(); // id → { data, lastAccess }
const saveTimers = new Map(); // id → timeoutId

const SAVE_DELAY_MS  = 2000;
const EVICT_AFTER_MS = 10 * 60 * 1000; // evict entries unused for 10 minutes
const EVICT_INTERVAL = 5  * 60 * 1000; // run eviction sweep every 5 minutes

// ─── Eviction ─────────────────────────────────────────────────────────────────

setInterval(() => {
  const now     = Date.now();
  let   evicted = 0;

  for (const [id, entry] of cache) {
    // Don't evict if a save is still pending
    if (saveTimers.has(id)) continue;
    if (now - entry.lastAccess > EVICT_AFTER_MS) {
      cache.delete(id);
      evicted++;
    }
  }

  if (evicted > 0) console.log(`[userCache] Evicted ${evicted} stale entries. Cache size: ${cache.size}`);
}, EVICT_INTERVAL);

// ─── Core ─────────────────────────────────────────────────────────────────────

export async function getUser(id) {
  if (cache.has(id)) {
    const entry = cache.get(id);
    entry.lastAccess = Date.now();
    return entry.data;
  }

  const snap = await db.collection("users").doc(id).get();
  const data = snap.exists ? snap.data() : {};

  data.balance         ??= 1000;
  data.blackjackStreak ??= 0;

  cache.set(id, { data, lastAccess: Date.now() });
  return data;
}

export async function saveUser(id, data) {
  // Update cache immediately
  if (cache.has(id)) {
    cache.get(id).data        = data;
    cache.get(id).lastAccess  = Date.now();
  } else {
    cache.set(id, { data, lastAccess: Date.now() });
  }

  // Reset debounce timer — last write in the window wins
  if (saveTimers.has(id)) clearTimeout(saveTimers.get(id));

  const timer = setTimeout(async () => {
    saveTimers.delete(id);
    const entry = cache.get(id);
    if (!entry) return;
    await db.collection("users").doc(id).set(entry.data, { merge: true })
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
