import { getUser, saveUser } from "../services/userCache.js";
import { rouletteEmbed } from "../utils/rouletteEmbed.js";
import { processGame } from "../utils/house.js";

export async function rouletteCommand(client, message, args) {
  const choice = args[2]?.toLowerCase();
  const bet = parseInt(args[3]);

  if (!["red", "black", "odd", "even"].includes(choice))
    return message.reply("Usage: `!g roulette <red|black|even|odd> <amount>`");

  if (isNaN(bet) || bet <= 0)
    return message.reply("Enter a valid bet amount.");

  const user = await getUser(message.author.id);
  if (user.balance < bet)
    return message.reply("You don't have enough money.");

  // Deduct temporary
  user.balance -= bet;

  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = message.member.roles.cache.has(SPECIAL_ROLE);
  const BOOST = 0.12;

  let roll = Math.floor(Math.random() * 37);

  if (hasBoost) {
    const altRoll = Math.floor(Math.random() * 37);
    const isRed = n => [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n);
    const colorOf = n => (n === 0 ? "Green" : (isRed(n) ? "Red" : "Black"));
    const odd = n => n % 2 === 1;
    const even = n => n % 2 === 0 && n !== 0;
    function favorsChoice(number) {
      if (choice === "red") return colorOf(number) === "Red";
      if (choice === "black") return colorOf(number) === "Black";
      if (choice === "odd") return odd(number);
      if (choice === "even") return even(number);
      return false;
    }
    if (favorsChoice(altRoll) && Math.random() < BOOST) roll = altRoll;
  }

  const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(roll);
  const color = roll === 0 ? "Green" : (isRed ? "Red" : "Black");
  const isOdd = roll % 2 === 1;
  const isEven = roll % 2 === 0 && roll !== 0;

  let win = false;
  if (choice === "red" && color === "Red") win = true;
  if (choice === "black" && color === "Black") win = true;
  if (choice === "odd" && isOdd) win = true;
  if (choice === "even" && isEven) win = true;

  let payout = 0;
  if (win) {
    payout = bet * 2;
    user.balance += payout;
    await processGame(payout); // house loses
  } else {
    await processGame(-bet); // house gains
  }

  await saveUser(message.author.id, user);

  message.reply({
    embeds: [rouletteEmbed(roll, win ? "Green" : "Red", color, bet, payout)]
  });
}
