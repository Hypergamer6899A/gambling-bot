// commands/g/roulette.js
import { getUser, saveUser } from "../services/userCache.js";
import { rouletteEmbed } from "../utils/embeds.js";
import { processGame, getHouse } from "../utils/house.js";

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function colorOf(n)  { return n === 0 ? "Green" : RED_NUMBERS.has(n) ? "Red" : "Black"; }
function isOdd(n)    { return n % 2 === 1; }
function isEven(n)   { return n !== 0 && n % 2 === 0; }
function favors(choice, n) {
  if (choice === "red")   return colorOf(n) === "Red";
  if (choice === "black") return colorOf(n) === "Black";
  if (choice === "odd")   return isOdd(n);
  if (choice === "even")  return isEven(n);
  return false;
}

export async function rouletteCommand(client, message, args) {
  const choice = args[2]?.toLowerCase();
  const bet    = parseInt(args[3]);

  if (!["red","black","odd","even"].includes(choice))
    return message.reply("Usage: `!g roulette <red|black|odd|even> <amount>`");

  if (isNaN(bet) || bet <= 0)
    return message.reply("Enter a valid bet amount.");

  const user  = await getUser(message.author.id);
  const house = await getHouse();

  if (user.balance < bet)
    return message.reply("You don't have enough money.");

  // Deduct bet
  user.balance -= bet;
  await processGame(-bet);

  // ── Boost roll ────────────────────────────────────────────────────────────
  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost     = message.member.roles.cache.has(SPECIAL_ROLE);
  const BOOST        = 0.12;

  let roll = Math.floor(Math.random() * 37);

  if (hasBoost) {
    const alt = Math.floor(Math.random() * 37);
    if (favors(choice, alt) && Math.random() < BOOST) roll = alt;
  }

  // ── Resolve ───────────────────────────────────────────────────────────────
  const resultColor = colorOf(roll);
  const win = favors(choice, roll);

  let payout  = 0;
  let netLoss = 0;

  if (win) {
    payout        = bet * 2;
    netLoss       = bet - payout;
    user.balance += payout;
    await processGame(payout);
  } else {
    netLoss = bet;
  }

  if (netLoss > 0) house.jackpotPot += Math.round(netLoss * 0.2);

  await saveUser(message.author.id, user);
  await saveUser(process.env.BOT_ID, house);

  return message.reply({
    embeds: [rouletteEmbed(roll, resultColor, choice, bet, win)],
  });
}
