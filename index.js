// index.js
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

// -----------------
// Firebase Setup
// -----------------
console.log('[DEBUG] Initializing Firebase...');
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();
console.log('[DEBUG] Firestore initialized');

// -----------------
// Discord Setup
// -----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

client.once('clientReady', () => {
  console.log(`[DEBUG] Logged in as ${client.user.tag}`);
});

// -----------------
// Helper Functions
// -----------------
async function respondWithThinking(message, func) {
  try {
    // React with custom emoji while "thinking"
    const emoji = message.guild?.emojis.cache.find(e => e.name === 'yourAnimatedEmojiName');
    let reaction;
    if (emoji) {
      reaction = await message.react(emoji);
    }
    console.log('[DEBUG] Reacted with thinking emoji');

    // Run your command function
    await func();

    // Remove reaction after response
    if (reaction) await reaction.remove();
    console.log('[DEBUG] Removed thinking emoji');
  } catch (err) {
    console.error('[ERROR] respondWithThinking:', err);
  }
}

// Example command handlers
const commands = {
  '!g leaderboard': async (message) => {
    console.log('[DEBUG] Running leaderboard command');
    const snapshot = await db.collection('users').orderBy('balance', 'desc').limit(5).get();
    let response = 'Top 5 Players:\n';
    snapshot.forEach(doc => {
      const data = doc.data();
      response += `${data.username}: ${data.balance}\n`;
    });
    await message.channel.send(response);
  },
  '!g roulette': async (message) => {
    console.log('[DEBUG] Running roulette command');
    // Example placeholder logic
    await message.channel.send('Spinning the roulette... (placeholder)');
  },
};

// -----------------
// Message Listener
// -----------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  for (const cmd in commands) {
    if (message.content.startsWith(cmd)) {
      console.log(`[DEBUG] Detected command: ${cmd}`);
      await respondWithThinking(message, () => commands[cmd](message));
      break; // prevents double execution
    }
  }
});

// -----------------
// Login
// -----------------
client.login(process.env.BOT_TOKEN).catch(console.error);
