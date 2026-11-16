// The HUD & UI Manager: health, armor, money, ammo, round timer, bomb status, buy menu, and overlays.
const COPY = {
  start: {
    title: 'Apex Terminal',
    copy: 'Tactical FPS. Plant or defuse the bomb, eliminate enemy operatives. Click to play.',
    action: 'Click to play',
  },
  paused: {
    title: 'Apex Terminal',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  buy: {
    title: 'Buy Phase',
    copy: 'Press B to open buy menu. Prepare for round.',
    action: 'Start Round',
  },
  win: {
    title: 'Round Won',
    copy: 'Objectives secured. Enemy eliminated.',
    action: 'Next Round',
  },
  loss: {
    title: 'Round Lost',
    copy: 'Operative down / Objective failed.',
    action: 'Try Again',
  },
};

export function createHud() {
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const copy = document.getElementById('overlay-copy');
  const play = document.getElementById('play');
  const buyMenu = document.getElementById('buy-menu');
  const buyClose = document.getElementById('buy-close');

  const ammo = document.getElementById('ammo');
  const ammoMag = document.getElementById('ammo-mag');
  const ammoReserve = document.getElementById('ammo-reserve');
  const weaponName = document.getElementById('weapon-name');
  const scoreValue = document.getElementById('score-value');
  const hpVal = document.getElementById('hp-val');
  const armorVal = document.getElementById('armor-val');
  const moneyVal = document.getElementById('money-val');
  const roundTimer = document.getElementById('round-timer');
  const bombStatus = document.getElementById('bomb-status');
  const hitmarker = document.getElementById('hitmarker');

  let hitTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastScore = -1;
  let lastHp = -1;
  let lastArmor = -1;
  let lastMoney = -1;

  return {
    setAmmo(mag, reserve, name) {
      if (mag === lastMag && reserve === lastReserve) return;
      lastMag = mag;
      lastReserve = reserve;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      ammo.classList.toggle('empty', mag === 0);
      if (name) weaponName.textContent = name;
    },
    setStats(hp, armor, money) {
      if (hp !== lastHp) {
        lastHp = hp;
        hpVal.textContent = String(Math.round(hp));
        hpVal.classList.toggle('low', hp < 30);
      }
      if (armor !== lastArmor) {
        lastArmor = armor;
        armorVal.textContent = String(Math.round(armor));
      }
      if (money !== lastMoney) {
        lastMoney = money;
        moneyVal.textContent = `$${money}`;
      }
    },
    setScore(value) {
      if (value === lastScore) return;
      lastScore = value;
      scoreValue.textContent = String(value);
    },
    setTimer(seconds) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      roundTimer.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    },
    setBombStatus(statusText, active = false) {
      bombStatus.textContent = statusText;
      bombStatus.classList.toggle('active', active);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.style.transform = '';
      }, holdMs);
    },
    showOverlay(mode, score) {
      const text = COPY[mode] || COPY.start;
      title.textContent = text.title;
      copy.textContent = mode === 'win' || mode === 'loss' ? `${text.copy} Score: ${score}.` : text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    toggleBuyMenu(show) {
      buyMenu.hidden = !show;
    },
    isBuyMenuOpen() {
      return !buyMenu.hidden;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    onBuyClose(handler) {
      buyClose.addEventListener('click', handler);
    },
    onBuyItem(handler) {
      document.querySelectorAll('.buy-item').forEach((item) => {
        item.addEventListener('click', () => {
          handler(item.dataset.buy);
        });
      });
    },
  };
}
