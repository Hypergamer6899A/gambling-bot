// commands/utils/embeds.js
// Single source of truth for all game and utility embeds.

import { EmbedBuilder } from "discord.js";

// ─── Colors ──────────────────────────────────────────────────────────────────

export const COLOR = {
  WIN:     0x57F287,  // Green
  LOSS:    0xED4245,  // Red
  TIE:     0xFEE75C,  // Yellow
  INFO:    0x5865F2,  // Blurple
  BLUE:    0x3498DB,
  PURPLE:  0x9B59B6,
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function outcomeColor(outcome) {
  return COLOR[outcome] ?? COLOR.TIE;
}

function fmt(n) {
  return `$${Number(n).toLocaleString()}`;
}

// ─── Blackjack ────────────────────────────────────────────────────────────────

/**
 * @param {string}   title
 * @param {number}   bet
 * @param {string[]} playerHand
 * @param {string[]} dealerHand
 * @param {number}   playerTotal
 * @param {number|null} dealerTotal  null = hidden second card
 * @param {number}   streak
 * @param {"WIN"|"LOSS"|"TIE"|"PLAYING"} outcome
 */
export function bjEmbed(title, bet, playerHand, dealerHand, playerTotal, dealerTotal, streak, outcome) {
  const playerCards = [].concat(playerHand).join(" | ");
  const dealerCards = dealerTotal === null
    ? `${[].concat(dealerHand)[0]} | ??`
    : [].concat(dealerHand).join(" | ");

  const color = outcome === "PLAYING" ? COLOR.INFO : outcomeColor(outcome);

  return new EmbedBuilder()
    .setTitle(`Blackjack — ${title}`)
    .setColor(color)
    .addFields(
      { name: `Your Hand (${playerTotal})`,                             value: playerCards,                          inline: false },
      { name: `Dealer Hand (${dealerTotal === null ? "?" : dealerTotal})`, value: dealerCards,                      inline: false },
      { name: "Bet",    value: fmt(bet),    inline: true },
      { name: "Streak", value: `${streak}`, inline: true },
    );
}

// ─── Slots ────────────────────────────────────────────────────────────────────

/**
 * @param {number}   bet
 * @param {string[]} slots
 * @param {number}   multiplier
 * @param {string}   outcome
 * @param {number}   sessionEarnings  net gain/loss this session
 * @param {number}   jackpotPot
 */
export function slotsEmbed(bet, slots, multiplier, outcome, sessionEarnings, jackpotPot) {
  const isJackpot  = outcome === "JACKPOT!!!";
  const isWin      = multiplier >= 1 || isJackpot;
  const isLoss     = multiplier === 0 && !isJackpot;
  const color      = isJackpot ? COLOR.WIN : isLoss ? COLOR.LOSS : COLOR.TIE;

  const earningsStr = sessionEarnings >= 0
    ? `+${fmt(sessionEarnings)}`
    : `-${fmt(Math.abs(sessionEarnings))}`;

  return new EmbedBuilder()
    .setTitle("Slots")
    .setColor(color)
    .addFields(
      { name: "Reels",          value: slots.join("  "),  inline: false },
      { name: "Result",         value: outcome,           inline: true  },
      { name: "Multiplier",     value: `x${multiplier}`, inline: true  },
      { name: "Bet",            value: fmt(bet),          inline: true  },
      { name: "Session",        value: earningsStr,       inline: true  },
      { name: "🎰 Jackpot Pot", value: fmt(jackpotPot),  inline: true  },
    );
}

// ─── Roulette ─────────────────────────────────────────────────────────────────

/**
 * @param {number}  resultNumber
 * @param {string}  resultColor   "Red" | "Black" | "Green"
 * @param {string}  choice
 * @param {number}  bet
 * @param {boolean} win
 */
export function rouletteEmbed(resultNumber, resultColor, choice, bet, win) {
  const colorDot = resultColor === "Red" ? "🔴" : resultColor === "Black" ? "⚫" : "🟢";

  return new EmbedBuilder()
    .setTitle("Roulette")
    .setColor(win ? COLOR.WIN : COLOR.LOSS)
    .addFields(
      { name: "Landed On", value: `${colorDot} ${resultNumber} (${resultColor})`, inline: true },
      { name: "Your Bet",  value: choice.toUpperCase(),                           inline: true },
      { name: "Amount",    value: fmt(bet),                                       inline: true },
      { name: "Outcome",   value: win ? "✅ WIN" : "❌ LOSS",                     inline: false },
    );
}

// ─── Poker ────────────────────────────────────────────────────────────────────

/**
 * @param {string}   title
 * @param {number}   bet
 * @param {string[]} board
 * @param {string[]} playerCards
 * @param {string[]} chosen
 * @param {string}   status
 * @param {number}   [color]
 * @param {string[]|null} [dealerCards]
 * @param {string|null}   [outcome]
 */
export function pokerEmbed(title, bet, board, playerCards, chosen, status, color = COLOR.INFO, dealerCards = null, outcome = null) {
  const embed = new EmbedBuilder()
    .setTitle(`Poker — ${title}`)
    .setColor(color)
    .addFields(
      { name: "Board",                        value: board.join(" | "),                         inline: false },
      { name: "Your Cards",                   value: playerCards.join(" | "),                   inline: false },
      { name: `Chosen (${chosen.length}/3)`,  value: chosen.length ? chosen.join(" | ") : "—", inline: false },
    );

  if (dealerCards) {
    embed.addFields({ name: "Dealer Played", value: dealerCards.join(" | "), inline: false });
  }

  embed.addFields(
    { name: "Bet",    value: fmt(bet), inline: true },
    { name: "Status", value: status,  inline: true },
  );

  if (outcome) {
    embed.addFields({ name: "Outcome", value: `**${outcome}**`, inline: false });
  }

  return embed;
}

// ─── Balance ──────────────────────────────────────────────────────────────────

export function balanceEmbed(balance, jackpotPot) {
  return new EmbedBuilder()
    .setTitle("Balance")
    .setColor(COLOR.INFO)
    .addFields(
      { name: "Wallet",         value: fmt(balance),   inline: true },
      { name: "🎰 Jackpot Pot", value: fmt(jackpotPot), inline: true },
    );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export function leaderboardEmbed(top5, callerEntry) {
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  let desc = top5
    .map((u, i) => `${medals[i]} <@${u.id}> — **${fmt(u.balance)}**`)
    .join("\n");

  if (callerEntry) {
    desc += `\n\n━━━━━━━━━━━━━━\n**#${callerEntry.rank}** <@${callerEntry.id}> — **${fmt(callerEntry.balance)}**`;
  }

  return new EmbedBuilder()
    .setTitle("🏆 Leaderboard")
    .setColor(COLOR.PURPLE)
    .setDescription(desc || "No users found.");
}

// ─── Help ─────────────────────────────────────────────────────────────────────

export function helpEmbed() {
  return new EmbedBuilder()
    .setTitle("Gambler — Commands")
    .setColor(COLOR.PURPLE)
    .addFields(
      {
        name: "💰 Economy",
        value: [
          "`!g balance` — Check your wallet",
          "`!g gift <@user> <amount>` — Send money",
          "`!g claim` — Claim $100 when broke (24h cooldown)",
          "`!g leaderboard` — Top balances",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🎰 Games",
        value: [
          "`!g slots <bet>`",
          "`!g blackjack <bet>`",
          "`!g roulette <red|black|odd|even> <bet>`",
          "`!g poker <bet>`",
        ].join("\n"),
        inline: false,
      },
    );
}
