// src/commands/g/slots.js

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

import { getUser, saveUser } from "../services/userCache.js";
import { processGame } from "../utils/house.js";

import { newSlotsGame, doSpin, finishSlots } from "../games/slots/engine.js";
import { slotsEmbed } from "../utils/slotsEmbed.js";

const activeSlots = new Map();

export async function slotsCommand(client, message, args) {
  const bet = parseInt(args[2]);

  if (isNaN(bet) || bet <= 0)
    return message.reply("Usage: `!g slots <bet>`");

  const user = await getUser(message.author.id);

  if (user.balance < bet)
    return message.reply("You don't have enough money.");

  // Start game
  const game = newSlotsGame(bet);
  activeSlots.set(message.author.id, game);

  // First spin costs bet immediately
  user.balance -= bet;
  await saveUser(message.author.id, user);

  // House gains bet immediately
  await processGame(-bet);

  // Spin
  const spin = doSpin(game);

  // Pay winnings if any
  if (spin.multiplier > 0) {
    const payout = bet * spin.multiplier;
    user.balance += payout;

    // House pays winnings
    await processGame(payout);

    await saveUser(message.author.id, user);
  }

  // Buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("slots_spin")
      .setLabel("Spin Again")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("slots_stop")
      .setLabel("Cash Out")
      .setStyle(ButtonStyle.Danger)
  );

  const reply = await message.reply({
    embeds: [
      slotsEmbed(
        bet,
        spin.slots,
        spin.multiplier,
        spin.outcome,
        game.totalProfit
      )
    ],
    components: [row]
  });

  // Collector
  const collector = reply.createMessageComponentCollector({
    time: 60000
  });

collector.on("collect", async (interaction) => {
  if (interaction.user.id !== message.author.id)
    return interaction.reply({
      content: "This isn't your slot machine.",
      ephemeral: true
    });

  if (interaction.customId === "slots_stop") {
    collector.stop();
    finishSlots(game);

    return interaction.update({
      components: [],
      embeds: [
        slotsEmbed(
          bet,
          game.lastSpin.slots,
          game.lastSpin.multiplier,
          "CASHED OUT",
          game.totalProfit
        )
      ]
    });
  }

  if (interaction.customId === "slots_spin") {
    const user = await getUser(message.author.id);

    if (user.balance < bet) {
      collector.stop();
      return interaction.update({
        components: [],
        content: "You ran out of money to keep spinning."
      });
    }

    // Deduct bet again
    user.balance -= bet;
    await saveUser(message.author.id, user);

    // House gains bet
    await processGame(-bet);

    // Spin again
    const spin = doSpin(game);

    // Pay winnings
    if (spin.multiplier > 0) {
      const payout = bet * spin.multiplier;
      user.balance += payout;

      await processGame(payout);
      await saveUser(message.author.id, user);
    }

    return interaction.update({
      embeds: [
        slotsEmbed(
          bet,
          spin.slots,
          spin.multiplier,
          spin.outcome,
          game.totalProfit
        )
      ],
      components: [row]
    });
  }
});

  collector.on("end", () => {
    activeSlots.delete(message.author.id);
  });
}
