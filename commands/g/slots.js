// commands/g/slots.js
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { getUser, saveUser } from "../services/userCache.js";
import { processGame, getHouse } from "../utils/house.js";
import { newSlotsGame, doSpin, applySpinResult, getTotalEarnings } from "../games/slots/engine.js";
import { slotsEmbed } from "../utils/embeds.js";

const activeSlots = new Map();

export async function slotsCommand(client, message, args) {
  const bet = parseInt(args[2]);

  if (isNaN(bet) || bet <= 0)
    return message.reply("Usage: `!g slots <bet>`");

  const user  = await getUser(message.author.id);
  const house = await getHouse();

  if (user.balance < bet)
    return message.reply("You don't have enough money.");

  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost     = message.member.roles.cache.has(SPECIAL_ROLE);

  const game = newSlotsGame(bet);
  activeSlots.set(message.author.id, game);

  // ── First spin ────────────────────────────────────────────────────────────
  user.balance -= bet;
  await saveUser(message.author.id, user);
  await processGame(-bet);

  const spin   = doSpin(game, hasBoost);
  const payout = await handleSlotsPayout(user, house, bet, spin);
  applySpinResult(game, spin.multiplier, payout);

  await saveUser(message.author.id, user);
  await saveUser(process.env.BOT_ID, house);

  // ── Buttons ───────────────────────────────────────────────────────────────
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("slots_spin").setLabel("Spin Again").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("slots_stop").setLabel("Cash Out").setStyle(ButtonStyle.Danger),
  );

  const reply = await message.reply({
    embeds:     [slotsEmbed(bet, spin.slots, spin.multiplier, spin.outcome, getTotalEarnings(game), house.jackpotPot)],
    components: [row],
  });

  const collector = reply.createMessageComponentCollector({ idle: 60_000 });

  collector.on("collect", async interaction => {
    if (interaction.user.id !== message.author.id)
      return interaction.reply({ content: "This isn't your slot machine.", ephemeral: true });

    if (game.locked)
      return interaction.reply({ content: "Slow down — the reels are still spinning.", ephemeral: true });

    game.locked = true;

    // ── Cash out ──────────────────────────────────────────────────────────
    if (interaction.customId === "slots_stop") {
      game.locked = false;
      collector.stop();

      return interaction.update({
        embeds:     [slotsEmbed(bet, game.lastSpin.slots, game.lastSpin.multiplier, "CASHED OUT", getTotalEarnings(game), house.jackpotPot)],
        components: [],
      });
    }

    // ── Spin again ────────────────────────────────────────────────────────
    if (interaction.customId === "slots_spin") {
      const freshUser = await getUser(message.author.id);

      if (freshUser.balance < bet) {
        game.locked = false;
        collector.stop();

        return interaction.update({
          content:    "You ran out of money to keep spinning.",
          components: [],
        });
      }

      freshUser.balance -= bet;
      await saveUser(message.author.id, freshUser);
      await processGame(-bet);

      const freshHouse    = await getHouse();
      const nextSpin      = doSpin(game, hasBoost);
      const nextPayout    = await handleSlotsPayout(freshUser, freshHouse, bet, nextSpin);
      applySpinResult(game, nextSpin.multiplier, nextPayout);

      await saveUser(message.author.id, freshUser);
      await saveUser(process.env.BOT_ID, freshHouse);

      game.locked = false;

      return interaction.update({
        embeds:     [slotsEmbed(bet, nextSpin.slots, nextSpin.multiplier, nextSpin.outcome, getTotalEarnings(game), freshHouse.jackpotPot)],
        components: [row],
      });
    }

    game.locked = false;
  });

  collector.on("end", () => {
    activeSlots.delete(message.author.id);
  });
}

// ─── Payout handler ───────────────────────────────────────────────────────────

async function handleSlotsPayout(user, house, bet, spin) {
  // Jackpot win — drain the pot
  if (spin.jackpot) {
    const payout     = house.jackpotPot;
    user.balance    += payout;
    house.jackpotPot = 0;
    await processGame(payout);
    return payout;
  }

  // Normal multiplier win
  if (spin.multiplier > 0) {
    const payout = Math.round(bet * spin.multiplier);
    user.balance += payout;
    await processGame(payout);

    const netLoss = bet - payout;
    if (netLoss > 0) house.jackpotPot += Math.round(netLoss * 0.2);

    return payout;
  }

  // Full loss — 20% of bet seeds the pot
  house.jackpotPot += Math.round(bet * 0.2);
  return 0;
}
