import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const BAILOUT_AMOUNT = 100;
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("claim")
  .setDescription("Claim a bailout if broke (24h cooldown)");

export async function execute(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

  try {
    if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
      return await interaction.editReply(`You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`);
    }

    const id = interaction.user.id;
    const ref = db.collection("users").doc(id);

    const result = await db.runTransaction(async t => {
      const doc = await t.get(ref);
      const data = doc.exists ? doc.data() : { balance: 0 };
      const balance = data.balance ?? 0;
      const lastClaim = data.lastClaim ?? 0;
      const now = Date.now();

      if (balance > 0) throw new Error("You are not broke. Claim only works at $0 or less.");
      if (now - lastClaim < CLAIM_COOLDOWN_MS) {
        const msLeft = CLAIM_COOLDOWN_MS - (now - lastClaim);
        const hours = Math.floor(msLeft / (60*60*1000));
        const minutes = Math.floor((msLeft % (60*60*1000)) / (60*1000));
        throw new Error(`You can claim again in ${hours}h ${minutes}m.`);
      }

      t.set(ref, { balance: BAILOUT_AMOUNT, username: interaction.user.username, lastClaim: now }, { merge: true });
      return { newBalance: BAILOUT_AMOUNT };
    });

    await interaction.editReply(`<@${id}> received $${result.newBalance} as a bailout.`);
  } catch (err) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
