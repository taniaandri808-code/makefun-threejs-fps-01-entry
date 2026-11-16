// Keyboard and mouse input handling, pointer lock, weapon slots, and buy menu toggle.
export function createInput(canvas, onLockChange, onToggleBuy, onSelectWeapon) {
  const keys = new Set();
  const state = { keys, locked: false, firing: false, lookX: 0, lookY: 0 };

  function setKey(event, down) {
    if (down) {
      keys.add(event.code);
      if (event.code === 'KeyB' && onToggleBuy) {
        onToggleBuy();
      }
      if (onSelectWeapon) {
        if (event.code === 'Digit1') onSelectWeapon('pistol');
        if (event.code === 'Digit2') onSelectWeapon('smg');
        if (event.code === 'Digit3') onSelectWeapon('rifle');
        if (event.code === 'Digit4') onSelectWeapon('sniper');
        if (event.code === 'KeyG') onSelectWeapon('grenade');
      }
    } else {
      keys.delete(event.code);
    }
    if (event.code === 'Space') event.preventDefault();
  }

  window.addEventListener('keydown', (event) => setKey(event, true));
  window.addEventListener('keyup', (event) => setKey(event, false));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  });
  window.addEventListener('mousedown', (event) => {
    if (state.locked && event.button === 0) state.firing = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      keys.clear();
      state.firing = false;
    }
    onLockChange(state.locked);
  });

  return {
    state,
    requestLock() {
      canvas.requestPointerLock();
    },
    takeLook() {
      const x = state.lookX;
      const y = state.lookY;
      state.lookX = 0;
      state.lookY = 0;
      return { x, y };
    },
  };
}
