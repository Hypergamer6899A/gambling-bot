// src/commands/g/slots.js

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

import { getUser, saveUser } from "../services/userCache.js";
import { processGame, getHouse } from "../utils/house.js";

import {
  newSlotsGame,
  doSpin,
  applySpinResult,
  getTotalEarnings
} from "../games/slots/engine.js";

import { slotsEmbed } from "../utils/slotsEmbed.js";

const activeSlots = new Map();

export async function slotsCommand(client, message, args) {
  const bet = parseInt(args[2]);

  if (isNaN(bet) || bet <= 0)
    return message.reply("Usage: `!g slots <bet>`");

  const user = await getUser(message.author.id);

  if (user.balance < bet)
    return message.reply("You don't have enough money.");

  // Boost role luck
  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = message.member.roles.cache.has(SPECIAL_ROLE);

  // Load house (Gambler)
  const house = await getHouse();

  // Start new slots session
  const game = newSlotsGame(bet);
  activeSlots.set(message.author.id, game);

  // Deduct bet immediately
  user.balance -= bet;
  await saveUser(message.author.id, user);

  // House gains bet
  await processGame(-bet);

  // Spin
  let spin = doSpin(game, hasBoost);

  // Handle payout
  let payout = await handleSlotsPayout(user, house, bet, spin);

  // Track earnings
  applySpinResult(game, spin.multiplier, payout);

  // Save changes
  await saveUser(message.author.id, user);
  await saveUser(process.env.BOT_ID, house);

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

  // Send initial embed
  const reply = await message.reply({
    embeds: [
      slotsEmbed(
        bet,
        spin.slots,
        spin.multiplier,
        spin.outcome,
        getTotalEarnings(game),
        house.jackpotPot
      )
    ],
    components: [row]
  });

  // Collector
  const collector = reply.createMessageComponentCollector({
    idle: 60000
  });

  collector.on("collect", async (interaction) => {
    if (interaction.user.id !== message.author.id)
      return interaction.reply({
        content: "This isn't your slot machine.",
        ephemeral: true
      });

    // Spam prevention
    if (game.locked)
      return interaction.reply({
        content: "Slow down — the reels are still spinning.",
        ephemeral: true
      });

    game.locked = true;

    // STOP BUTTON
    if (interaction.customId === "slots_stop") {
      collector.stop();

      game.locked = false;

      return interaction.update({
        components: [],
        embeds: [
          slotsEmbed(
            bet,
            game.lastSpin.slots,
            game.lastSpin.multiplier,
            "CASHED OUT",
            getTotalEarnings(game),
            house.jackpotPot
          )
        ]
      });
    }

    // SPIN AGAIN BUTTON
    if (interaction.customId === "slots_spin") {
      const user = await getUser(message.author.id);

      if (user.balance < bet) {
        collector.stop();
        game.locked = false;

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
      spin = doSpin(game, hasBoost);

      // Reload house (pot updated)
      const house = await getHouse();

      // Handle payout
      payout = await handleSlotsPayout(user, house, bet, spin);

      // Track earnings
      applySpinResult(game, spin.multiplier, payout);

      // Save changes
      await saveUser(message.author.id, user);
      await saveUser(process.env.BOT_ID, house);

      game.locked = false;

      return interaction.update({
        embeds: [
          slotsEmbed(
            bet,
            spin.slots,
            spin.multiplier,
            spin.outcome,
            getTotalEarnings(game),
            house.jackpotPot
          )
        ],
        components: [row]
      });
    }

    game.locked = false;
  });

  collector.on("end", () => {
    activeSlots.delete(message.author.id);
  });
}

/**
 * Handles jackpot + normal payouts + half-loss pot feeding
 */
async function handleSlotsPayout(user, house, bet, spin) {
  let payout = 0;

  // ===== JACKPOT WIN 👑👑👑 =====
  if (spin.jackpot) {
    payout = house.jackpotPot;

    user.balance += payout;

    // Reset pot
    house.jackpotPot = 0;

    // House pays jackpot
    await processGame(payout);

    return payout;
  }

  // ===== NORMAL MULTIPLIER PAYOUT =====
  if (spin.multiplier > 0) {
    payout = Math.round(bet * spin.multiplier);

    user.balance += payout;

    // House pays winnings
    await processGame(payout);

    // HALF LOSS feeds jackpot pot 🍋🍋🍋
    if (spin.multiplier === 0.5) {
      const lostHalf = Math.round(bet * 0.5);
      house.jackpotPot += lostHalf;
    }

    return payout;
  }

  // LOSS (no payout)
  return 0;
}
