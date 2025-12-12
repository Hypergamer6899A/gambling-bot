const games = new Map();

export function createGame(userId, state) {
  games.set(userId, state);
}

export function getGame(userId) {
  return games.get(userId) || null;
}

export function updateGame(userId, newState) {
  games.set(userId, newState);
}

export function deleteGame(userId) {
  games.delete(userId);
}
