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
  const extraBotCards = draw(deck, 2);
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

// pick a bot hand with occasional suboptimal choices
export function botPick(botCards, board, boostedPlayer = false) {
  const allCombos = combinations(botCards, 3);

  // evaluate all combos and rank them
  const scoredCombos = allCombos
    .map(c => ({ combo: c, score: scoreHand([...c, ...board]) }))
    .sort((a, b) => b.score.rank - a.score.rank); // best first

  let chosenCombo;

  if (boostedPlayer) {
    // player boost: pick a weaker hand occasionally
    chosenCombo = scoredCombos[Math.min(scoredCombos.length - 1, Math.floor(Math.random() * 3) + 1)].combo;
  } else {
    // 2/3 chance best hand, 1/3 chance 2nd or 3rd best
    if (Math.random() < 0.66) {
      chosenCombo = scoredCombos[0].combo; // best
    } else {
      const secondThirdIndex = Math.min(scoredCombos.length - 1, Math.floor(Math.random() * 2) + 1);
      chosenCombo = scoredCombos[secondThirdIndex].combo;
    }
  }

  return chosenCombo;
}

export function finishGame(game, boostedPlayer = false) {
  const botChosen = botPick(game.botCards, game.board, boostedPlayer);

  const playerFinal = [...game.chosen, ...game.board];
  const botFinal = [...botChosen, ...game.board];

  const playerScore = scoreHand(playerFinal);
  const botScore = scoreHand(botFinal);

  let winner;

  if (!boostedPlayer) {
    // normal rules: higher score wins, ties go to bot
    if (botScore.rank >= playerScore.rank) winner = "bot";
    else winner = "player"; // rare chance when bot picks 2nd/3rd best
  } else {
    // boosted player: normal comparison
    if (playerScore.rank > botScore.rank) winner = "player";
    else if (playerScore.rank < botScore.rank) winner = "bot";
    else winner = "tie";
  }

  return { playerFinal, botFinal, playerScore, botScore, winner };
}
