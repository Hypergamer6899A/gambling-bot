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

  // Deduct bet immediately
  user.balance -= bet;
  await saveUser(message.author.id, user);

  // House gains bet immediately
  await processGame(-bet);

  // Boost role luck
  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = message.member.roles.cache.has(SPECIAL_ROLE);
  const BOOST = 0.12;

  let roll = Math.floor(Math.random() * 37);

  // Red number list
  const redNumbers = [
    1,3,5,7,9,12,14,16,18,
    19,21,23,25,27,30,32,34,36
  ];

  // Helper functions
  const isRed = n => redNumbers.includes(n);
  const colorOf = n =>
    n === 0 ? "Green" : isRed(n) ? "Red" : "Black";

  const isOdd = n => n % 2 === 1;
  const isEven = n => n !== 0 && n % 2 === 0;

  // Boosted reroll chance
  if (hasBoost) {
    const altRoll = Math.floor(Math.random() * 37);

    function favorsChoice(number) {
      if (choice === "red") return colorOf(number) === "Red";
      if (choice === "black") return colorOf(number) === "Black";
      if (choice === "odd") return isOdd(number);
      if (choice === "even") return isEven(number);
      return false;
    }

    if (favorsChoice(altRoll) && Math.random() < BOOST) {
      roll = altRoll;
    }
  }

  // Final result values
  const resultColor = colorOf(roll);

  // Determine win
  let win = false;
  if (choice === "red" && resultColor === "Red") win = true;
  if (choice === "black" && resultColor === "Black") win = true;
  if (choice === "odd" && isOdd(roll)) win = true;
  if (choice === "even" && isEven(roll)) win = true;

  // Payout
  let payout = 0;
  if (win) {
    payout = bet * 2;
    user.balance += payout;

    // House pays winnings
    await processGame(payout);
  }

  await saveUser(message.author.id, user);

  // Send embed
return message.reply({
  embeds: [rouletteEmbed(roll, resultColor, choice, bet, win)]
});
};
};
}
