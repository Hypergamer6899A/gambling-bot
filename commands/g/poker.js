// commands/g/poker.js
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { getUser, saveUser } from "../services/userCache.js";
import { processGame, getHouse } from "../utils/house.js";
import { COLOR, pokerEmbed } from "../utils/embeds.js";
import { newPokerGame, finishGame } from "../games/poker/engine.js";

const activeGames = new Map();

export async function pokerCommand(client, message, args) {
  const bet = parseInt(args[2]);

  if (isNaN(bet) || bet <= 0)
    return message.reply("Usage: `!g poker <bet>`");

  const user = await getUser(message.author.id);

  if (user.balance < bet)
    return message.reply("You don't have enough money.");

  // Deduct bet
  user.balance -= bet;
  await saveUser(message.author.id, user);
  await processGame(-bet);

  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost     = message.member.roles.cache.has(SPECIAL_ROLE);

  const game = newPokerGame();
  activeGames.set(message.author.id, game);

  // ── Buttons ───────────────────────────────────────────────────────────────
  function buildButtons() {
    const cardRow = new ActionRowBuilder();
    game.playerCards.forEach((card, i) => {
      cardRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poker_pick_${i}`)
          .setLabel(card)
          .setStyle(game.chosen.includes(card) ? ButtonStyle.Success : ButtonStyle.Primary),
      );
    });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("Fold").setLabel("Fold").setStyle(ButtonStyle.Danger),
    );

    return [cardRow, actionRow];
  }

  const sent = await message.reply({
    embeds:     [pokerEmbed("Quick Draw", bet, game.board, game.playerCards, game.chosen, "Pick 3 cards to play, or Fold.")],
    components: buildButtons(),
  });

  const collector = sent.createMessageComponentCollector({ time: 60_000 });

  collector.on("collect", async interaction => {
    if (interaction.user.id !== message.author.id) {
      return interaction.reply({ content: "This isn't your game.", ephemeral: true });
    }

    // ── Fold ──────────────────────────────────────────────────────────────
    if (interaction.customId === "Fold") {
      const house   = await getHouse();
      const refund  = Math.floor(bet / 2);
      const netLoss = bet - refund;

      user.balance += refund;
      await processGame(refund);

      if (netLoss > 0) house.jackpotPot += Math.round(netLoss * 0.2);

      await saveUser(message.author.id, user);
      await saveUser(process.env.BOT_ID, house);
      activeGames.delete(message.author.id);

      return interaction.update({
        embeds:     [pokerEmbed("Folded", bet, game.board, game.playerCards, game.chosen, `Half your bet returned (${fmt(refund)}).`, COLOR.INFO)],
        components: [],
      });
    }

    // ── Card selection ────────────────────────────────────────────────────
    const index  = parseInt(interaction.customId.split("_")[2]);
    const picked = game.playerCards[index];

    if (game.chosen.includes(picked)) {
      game.chosen = game.chosen.filter(c => c !== picked);
    } else {
      if (game.chosen.length >= 3) {
        return interaction.reply({ content: "You can only pick 3 cards.", ephemeral: true });
      }
      game.chosen.push(picked);
    }

    // ── Resolve on 3 chosen ───────────────────────────────────────────────
    if (game.chosen.length === 3) {
      collector.stop();

      const house  = await getHouse();
      const result = finishGame(game, hasBoost);

      let payout      = 0;
      let netLoss     = 0;
      let outcomeText = "";
      let outcome     = "";
      let color       = COLOR.TIE;

      if (result.winner === "player") {
        payout        = bet * 2;
        netLoss       = bet - payout;
        outcomeText   = `${result.playerScore.name} beats ${result.botScore.name}`;
        outcome       = "WIN";
        color         = COLOR.WIN;
        user.balance += payout;
        await processGame(payout);
      } else if (result.winner === "bot") {
        netLoss     = bet;
        outcomeText = `${result.botScore.name} beats ${result.playerScore.name}`;
        outcome     = "LOSS";
        color       = COLOR.LOSS;
      } else {
        payout        = bet;
        outcomeText   = `Tie — both had ${result.playerScore.name}`;
        outcome       = "TIE";
        color         = COLOR.TIE;
        user.balance += payout;
        await processGame(payout);
      }

      if (netLoss > 0) house.jackpotPot += Math.round(netLoss * 0.2);

      await saveUser(message.author.id, user);
      await saveUser(process.env.BOT_ID, house);
      activeGames.delete(message.author.id);

      return interaction.update({
        embeds: [
          pokerEmbed(
            "Game Over",
            bet,
            game.board,
            game.playerCards,
            game.chosen,
            `${outcomeText} — Payout: $${payout}`,
            color,
            result.botFinal.slice(0, 3),
            outcome,
          ),
        ],
        components: [],
      });
    }

    // ── Live selection update ─────────────────────────────────────────────
    return interaction.update({
      embeds:     [pokerEmbed("Quick Draw", bet, game.board, game.playerCards, game.chosen, `${game.chosen.length}/3 selected — or Fold.`)],
      components: buildButtons(),
    });
  });

  collector.on("end", () => {
    activeGames.delete(message.author.id);
  });
}

function fmt(n) { return `$${n}`; }
