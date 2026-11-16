// Multiple weapons system: Pistol, SMG, Rifle, Sniper, and Grenade.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const WEAPON_CONFIGS = {
  pistol: { name: 'Pistol', mag: 12, reserve: 48, fireGap: 0.18, reload: 1.4, damage: 32, spreadStill: 0.001, spreadMove: 0.015, zoom: 1 },
  smg: { name: 'SMG (Viper-9)', mag: 30, reserve: 120, fireGap: 0.075, reload: 1.6, damage: 24, spreadStill: 0.003, spreadMove: 0.032, zoom: 1 },
  rifle: { name: 'Assault Rifle (Apex-4)', mag: 30, reserve: 90, fireGap: 0.096, reload: 1.9, damage: 34, spreadStill: 0.002, spreadMove: 0.028, zoom: 1 },
  sniper: { name: 'Sniper (Spectre)', mag: 10, reserve: 30, fireGap: 0.8, reload: 2.6, damage: 100, spreadStill: 0.0001, spreadMove: 0.08, zoom: 3 },
  grenade: { name: 'Frag Grenade', mag: 1, reserve: 2, fireGap: 1.0, reload: 1.0, damage: 90, spreadStill: 0.01, spreadMove: 0.05, zoom: 1 },
};

export function createWeapon(camera) {
  const gripMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });

  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), bodyMaterial);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), gripMaterial);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), gripMaterial);
  stock.position.set(0, -0.02, 0.3);
  model.add(receiver, barrel, stock);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  let currentKey = 'rifle';
  const weapons = {};
  for (const [key, cfg] of Object.entries(WEAPON_CONFIGS)) {
    weapons[key] = { mag: cfg.mag, reserve: cfg.reserve };
  }

  const state = {
    current: currentKey,
    mag: weapons[currentKey].mag,
    reserve: weapons[currentKey].reserve,
    name: WEAPON_CONFIGS[currentKey].name,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    zoomed: false,
  };

  function selectWeapon(key) {
    if (!WEAPON_CONFIGS[key] || state.reloadLeft > 0) return;
    // Save current ammo
    weapons[state.current].mag = state.mag;
    weapons[state.current].release = state.reserve;

    state.current = key;
    state.mag = weapons[key].mag;
    state.reserve = weapons[key].reserve;
    state.name = WEAPON_CONFIGS[key].name;
    state.cooldown = 0;
    state.reloadLeft = 0;
    state.zoomed = false;
  }

  function step(dt) {
    const cfg = WEAPON_CONFIGS[state.current];
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;

    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (cfg.reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = cfg.mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
        weapons[state.current].mag = state.mag;
        weapons[state.current].reserve = state.reserve;
      }
    }
  }

  return {
    state,
    config() {
      return WEAPON_CONFIGS[state.current];
    },
    selectWeapon,
    step,
    ready() {
      return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      const cfg = WEAPON_CONFIGS[state.current];
      state.cooldown = cfg.fireGap;
      state.flash = 0.06;
      state.kick = state.current === 'sniper' ? 0.09 : 0.055;
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      weapons[state.current].mag = state.mag;
      return true;
    },
    reload() {
      const cfg = WEAPON_CONFIGS[state.current];
      if (state.reloadLeft > 0 || state.mag === cfg.mag || state.reserve === 0) return;
      state.reloadLeft = cfg.reload;
    },
    spread(speed) {
      const cfg = WEAPON_CONFIGS[state.current];
      return cfg.spreadStill + Math.min(1, speed / 5.2) * cfg.spreadMove;
    },
    refill() {
      for (const [key, cfg] of Object.entries(WEAPON_CONFIGS)) {
        weapons[key].mag = cfg.mag;
        weapons[key].reserve = cfg.reserve;
      }
      state.mag = weapons[state.current].mag;
      state.reserve = weapons[state.current].reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
    },
    addAmmo(type, amount) {
      if (weapons[type]) {
        weapons[type].reserve += amount;
        if (state.current === type) state.reserve = weapons[type].reserve;
      }
    }
  };
}
