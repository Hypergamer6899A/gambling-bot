import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const suits = ["♠", "♥", "♦", "♣"];
const values = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const ALLOWED_CHANNEL_ID = "1434934862430867487";

function drawDeck() {
  const deck = [];
  for (const s of suits)
    for (const v of values)
      deck.push(`${v}${s}`);
  return deck.sort(() => Math.random() - 0.5);
}

function rankHand(cards) {
  // Simplified hand ranking
  const vals = cards.map(c => c.replace(/[♠♥♦♣]/g, ""));
  const suitsOnly = cards.map(c => c.slice(-1));
  const counts = vals.reduce((a,v) => ((a[v]=(a[v]||0)+1),a), {});
  const unique = Object.keys(counts).length;
  const flush = new Set(suitsOnly).size === 1;

  const order = values;
  const sorted = vals.map(v => order.indexOf(v)).sort((a,b)=>a-b);
  const straight = sorted.every((v,i)=>i===0||v-sorted[i-1]===1);

  if (straight && flush) return { name:"Straight Flush", mult:10 };
  if (Object.values(counts).includes(4)) return { name:"Four of a Kind", mult:6 };
  if (Object.values(counts).includes(3) && Object.values(counts).includes(2)) return { name:"Full House", mult:4 };
  if (flush) return { name:"Flush", mult:3 };
  if (straight) return { name:"Straight", mult:2 };
  if (Object.values(counts).includes(3)) return { name:"Three of a Kind", mult:1.5 };
  if (Object.values(counts).filter(v=>v===2).length===2) return { name:"Two Pair", mult:1.2 };
  if (Object.values(counts).includes(2)) return { name:"Pair", mult:1.1 };
  return { name:"Nothing", mult:0 };
}

export const data = new SlashCommandBuilder()
  .setName("poker")
  .setDescription("Play a quick round of video poker")
  .addIntegerOption(opt => 
    opt.setName("amount")
      .setDescription("Bet amount")
      .setRequired(true)
  );

export async function execute(interaction, client) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID)
    return interaction.reply({ content:`Use this command only in <#${ALLOWED_CHANNEL_ID}>.`, ephemeral:true });

  const amount = interaction.options.getInteger("amount");
  if (amount <= 0) return interaction.reply("Bet must be greater than 0.");

  const id = interaction.user.id;
  const userRef = db.collection("users").doc(id);
  const doc = await userRef.get();
  let balance = doc.exists ? doc.data().balance : 1000;
  if (amount > balance) return interaction.reply("Not enough money.");

  let deck = drawDeck();
  let hand = deck.splice(0,5);
  const handMsg = hand.map((c,i)=>`[${i+1}] ${c}`).join("  ");

  const embed = new EmbedBuilder()
    .setTitle("Poker")
    .setDescription(`Your hand:\n${handMsg}\n\nSelect cards to **keep** then click "Draw".`)
    .setColor("Gold");

  const buttons = new ActionRowBuilder().addComponents(
    ...hand.map((_,i)=>
      new ButtonBuilder()
        .setCustomId(`keep_${i}`)
        .setLabel(`${i+1}`)
        .setStyle(ButtonStyle.Secondary)
    ),
    new ButtonBuilder().setCustomId("draw").setLabel("Draw").setStyle(ButtonStyle.Success)
  );

  const reply = await interaction.reply({ embeds:[embed], components:[buttons] });
  const collector = reply.createMessageComponentCollector({ time:15000 });

  const kept = new Set();

  collector.on("collect", async btn => {
    if (btn.user.id !== interaction.user.id) return btn.reply({ content:"Not your game.", ephemeral:true });

    if (btn.customId.startsWith("keep_")) {
      const i = parseInt(btn.customId.split("_")[1]);
      if (kept.has(i)) kept.delete(i);
      else kept.add(i);
      const newButtons = new ActionRowBuilder().addComponents(
        ...hand.map((_,j)=>
          new ButtonBuilder()
            .setCustomId(`keep_${j}`)
            .setLabel(`${j+1}`)
            .setStyle(kept.has(j) ? ButtonStyle.Success : ButtonStyle.Secondary)
        ),
        new ButtonBuilder().setCustomId("draw").setLabel("Draw").setStyle(ButtonStyle.Success)
      );
      await btn.update({ components:[newButtons] });
    } else if (btn.customId === "draw") {
      collector.stop("drawn");
      await btn.deferUpdate();
    }
  });

  collector.on("end", async (_, reason) => {
    if (reason !== "drawn") return interaction.editReply({ content:"Timed out.", embeds:[], components:[] });

    for (let i=0;i<5;i++) {
      if (!kept.has(i)) hand[i] = deck.pop();
    }

    const result = rankHand(hand);
    const win = result.mult > 0;
    const change = win ? Math.floor(amount * (result.mult - 1)) : -amount;
    balance += change;
    await userRef.set({ balance, username: interaction.user.username });

    const endEmbed = new EmbedBuilder()
      .setTitle("Final Hand")
      .setDescription(`${hand.join("  ")}\n**${result.name}**\n${win ? `Won $${change}` : `Lost $${-change}`}\nBalance: $${balance}`)
      .setColor(win ? "Green" : "Red");

    await interaction.editReply({ embeds:[endEmbed], components:[] });
    await updateTopRoles(client);
  });
}
