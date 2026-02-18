import { makeDeck, shuffle, draw, scoreHand } from "./utils.js";

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
  const extraBotCards = draw(deck, 2); // give bot 7 cards
  const board = draw(deck, 5);

  return {
    deck,
    board,
    playerCards,
    botCards: [...botCards, ...extraBotCards], // bot has 7 cards
    chosen: [],
    finished: false
  };
}

export function botPick(botCards, board, boostedPlayer = false) {
  const allCombos = combinations(botCards, 3);

  let bestCombo = allCombos[0];
  let bestScore = scoreHand([...bestCombo, ...board]);

  for (const combo of allCombos) {
    const score = scoreHand([...combo, ...board]);
    if (score.rank > bestScore.rank) {
      bestScore = score;
      bestCombo = combo;
    }
  }

  // House advantage: ~67% bot win chance
  if (!boostedPlayer && Math.random() < 0.67) return bestCombo;

  // otherwise player gets lucky
  return allCombos[Math.floor(Math.random() * allCombos.length)];
}

export function finishGame(game, boostedPlayer = false) {
  const botChosen = botPick(game.botCards, game.board, boostedPlayer);

  const playerFinal = [...game.chosen, ...game.board];
  const botFinal = [...botChosen, ...game.board];

  const playerScore = scoreHand(playerFinal);
  const botScore = scoreHand(botFinal);

  let winner;
  if (!boostedPlayer && Math.random() < 0.67) {
    winner = botScore.rank >= playerScore.rank ? "bot" : "player";
  } else {
    if (playerScore.rank > botScore.rank) winner = "player";
    else if (playerScore.rank < botScore.rank) winner = "bot";
    else winner = "tie";
  }

  return { playerFinal, botFinal, playerScore, botScore, winner };
}
