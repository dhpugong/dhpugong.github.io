import { aiAlgorithms } from "./aiAlgorithms.js";
import { getLegalMoves } from "./aiShared.js";

export { aiAlgorithms };

export function chooseDirection(state, algorithmName = "lookahead") {
  const algorithm = aiAlgorithms[algorithmName] || aiAlgorithms.lookahead;
  return algorithm(state);
}

export function countLegalMoves(state) {
  return getLegalMoves(state).length;
}
