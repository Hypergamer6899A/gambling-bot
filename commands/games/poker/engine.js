import { makeDeck, shuffle, draw, scoreHand } from "./utils.js";

// generate all combinations of size k
function combinations(arr, k) {
  const results = [];
  function helper(start, combo) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}

export function newPokerGame() {
  const deck = makeDeck();
  shuffle(deck);

  const playerCards = draw(deck, 5);
  const botCards = draw(deck, 5);
  const extraBotCards = draw(deck, 2); // 7 total for bot
  const board = draw(deck, 5);

  return {
    deck,
    board,
    playerCards,
    botCards: [...botCards, ...extraBotCards],
    chosen: [],
    finished: false
  };
}

// pick the best 3-card combination for bot from 7 cards
export function botPick(botCards, board, boostedPlayer = false) {
  const allCombos = combinations(botCards, 3);

  // compute 5-card hand for each combo + board and pick the strongest
  let bestCombo = allCombos[0];
  let bestScore = scoreHand([...bestCombo, ...board]);

  for (const combo of allCombos) {
    const score = scoreHand([...combo, ...board]);
    if (score.rank > bestScore.rank) {
      bestScore = score;
      bestCombo = combo;
    }
  }

  // If player has boost, 33% chance to pick a weaker hand
  if (boostedPlayer && Math.random() < 0.33) {
    const weakerCombos = allCombos.filter(
      c => scoreHand([...c, ...board]).rank < bestScore.rank
    );
    if (weakerCombos.length) return weakerCombos[Math.floor(Math.random() * weakerCombos.length)];
  }

  return bestCombo;
}

export function finishGame(game, boostedPlayer = false) {
  const botChosen = botPick(game.botCards, game.board, boostedPlayer);

  const playerFinal = [...game.chosen, ...game.board];
  const botFinal = [...botChosen, ...game.board];

  const playerScore = scoreHand(playerFinal);
  const botScore = scoreHand(botFinal);

  let winner;

  // Bot wins almost all games unless player is boosted
  if (!boostedPlayer) {
    if (botScore.rank >= playerScore.rank) winner = "bot";
    else winner = "bot"; // forcibly rig bot to win ties too
  } else {
    // player has boost: use actual comparison
    if (playerScore.rank > botScore.rank) winner = "player";
    else if (playerScore.rank < botScore.rank) winner = "bot";
    else winner = "tie";
  }

  return { playerFinal, botFinal, playerScore, botScore, winner };
}
