import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const BAILOUT_AMOUNT = 1000;            // money given when claiming
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export const data = new SlashCommandBuilder()
  .setName("claim")
  .setDescription("If you're broke (<= $0), claim a bailout (24h cooldown)");

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({ content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`, ephemeral: true });
  }

  await interaction.deferReply();

  const id = interaction.user.id;
  const ref = db.collection("users").doc(id);

  const result = await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const data = doc.exists ? doc.data() : { balance: 100 }; // default 100 if no doc (but claim should only work when <=0)
    const balance = data.balance ?? 100;
    const lastClaim = data.lastClaim ?? 0;
    const now = Date.now();

    if (balance > 0) {
      throw new Error("You are not broke. Claim is only available when your balance is $0 or less.");
    }

    if (now - lastClaim < CLAIM_COOLDOWN_MS) {
      const msLeft = CLAIM_COOLDOWN_MS - (now - lastClaim);
      const hours = Math.floor(msLeft / (60*60*1000));
      const minutes = Math.floor((msLeft % (60*60*1000)) / (60*1000));
      throw new Error(`You can claim again in ${hours}h ${minutes}m.`);
    }

    const newBalance = (balance || 0) + BAILOUT_AMOUNT;
    t.set(ref, { balance: newBalance, username: interaction.user.username, lastClaim: now }, { merge: true });
    return { newBalance };
  }).catch(err => ({ error: err.message }));

  if (result.error) return interaction.editReply(result.error);

  const mention = `<@${interaction.user.id}>`;
  await interaction.editReply(`${mention} received $${BAILOUT_AMOUNT.toLocaleString()} as a bailout. New balance: $${result.newBalance.toLocaleString()}`);

  // refresh top roles in case this moves them into top 3
  await updateTopRoles(interaction.client);
}
