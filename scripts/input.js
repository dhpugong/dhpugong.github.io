export function bindInput({ elements, directions, game, setDirection, pauseGame, startGame }) {
  let touchStart;

  document.addEventListener("keydown", (event) => {
    const keyDirections = {
      ArrowUp: directions.up,
      KeyW: directions.up,
      ArrowDown: directions.down,
      KeyS: directions.down,
      ArrowLeft: directions.left,
      KeyA: directions.left,
      ArrowRight: directions.right,
      KeyD: directions.right,
    };

    if (event.code === "Space" || event.code === "KeyP") {
      event.preventDefault();
      pauseGame();
      return;
    }

    if (event.code === "Enter" && game.state !== "playing") {
      event.preventDefault();
      startGame();
      return;
    }

    const newDirection = keyDirections[event.code];

    if (newDirection) {
      event.preventDefault();
      setDirection(newDirection);
    }
  });

  elements.canvas.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  elements.canvas.addEventListener("touchend", (event) => {
    if (!touchStart) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) {
      touchStart = undefined;
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDirection(deltaX > 0 ? directions.right : directions.left);
    } else {
      setDirection(deltaY > 0 ? directions.down : directions.up);
    }

    touchStart = undefined;
  }, { passive: true });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("click", () => setDirection(directions[button.dataset.direction]));
  });
}
