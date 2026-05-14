export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const codeAliases = {
    Digit1: "1",
    Digit2: "2",
    Digit3: "3",
    Numpad1: "1",
    Numpad2: "2",
    Numpad3: "3",
  };

  function normalize(event) {
    if (codeAliases[event.code]) {
      return codeAliases[event.code];
    }

    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  function down(event) {
    const key = normalize(event);

    if (isGameKey(key)) {
      event.preventDefault();
    }

    if (!held.has(key)) {
      pressed.add(key);
    }

    held.add(key);
  }

  function up(event) {
    held.delete(normalize(event));
  }

  function bind() {
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
  }

  function clearFrame() {
    pressed.clear();
  }

  function clear() {
    held.clear();
    pressed.clear();
  }

  return {
    bind,
    clear,
    clearFrame,
    isDown: (key) => held.has(key),
    wasPressed: (key) => pressed.has(key),
  };
}

function isGameKey(key) {
  return [
    "a",
    "d",
    "w",
    "s",
    "j",
    "k",
    "l",
    "u",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "1",
    "2",
    "3",
    "4",
    " ",
  ].includes(key);
}
