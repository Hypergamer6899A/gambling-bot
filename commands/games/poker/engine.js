import { makeDeck, shuffle, draw, scoreHand } from "./utils.js";

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

export function botPick(botCards) {
  // Bot picks best 3 by brute forcing combos later
  return botCards.slice(0, 3);
}

export function finishGame(game) {
  const botChosen = botPick(game.botCards);

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
