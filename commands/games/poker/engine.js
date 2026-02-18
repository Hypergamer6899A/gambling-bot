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
  const bestCombo = allCombos.reduce((best, combo) => {
    const score = scoreHand([...combo, ...board]);
    const bestScore = scoreHand([...best, ...board]);
    return score.rank > bestScore.rank ? combo : best;
  });

  // House advantage: 67% bot win chance
  if (Math.random() < 0.67 && !boostedPlayer) {
    return bestCombo;
  } else {
    // Player gets lucky ~33% of time
    return allCombos[Math.floor(Math.random() * allCombos.length)];
  }
}

export function finishGame(game, boostedPlayer = false) {
  const botChosen = botPick(game.botCards, game.board, boostedPlayer);

  const playerFinal = [...game.chosen, ...game.board];
  const botFinal = [...botChosen, ...game.board];

  const playerScore = scoreHand(playerFinal);
  const botScore = scoreHand(botFinal);

  let winner;
  // Force bot win ~67% unless player boosted
  if (!boostedPlayer && Math.random() < 0.67) {
    winner = botScore.rank >= playerScore.rank ? "bot" : "player";
  } else {
    if (playerScore.rank > botScore.rank) winner = "player";
    else if (playerScore.rank < botScore.rank) winner = "bot";
    else winner = "tie";
  }

  return { playerFinal, botFinal, playerScore, botScore, winner };
}
