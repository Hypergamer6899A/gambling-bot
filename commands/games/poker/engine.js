// src/commands/games/poker/engine.js

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

  return {
    deck,
    board: draw(deck, 5),
    playerCards: draw(deck, 5),
    botCards: draw(deck, 5),
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

  if (boostedPlayer && Math.random() < 0.12) {
    return allCombos[Math.floor(Math.random() * allCombos.length)];
  }

  return bestCombo;
}

export function finishGame(game, boostedPlayer = false) {
  const botChosen = botPick(game.botCards, game.board, boostedPlayer);

  const playerFinal = [...game.chosen, ...game.board];
  const botFinal = [...botChosen, ...game.board];

  const playerScore = scoreHand(playerFinal);
  const botScore = scoreHand(botFinal);

  return {
    playerFinal,
    botFinal,
    playerScore,
    botScore,
    winner:
      playerScore.rank > botScore.rank
        ? "player"
        : playerScore.rank < botScore.rank
        ? "bot"
        : "tie"
  };
}
