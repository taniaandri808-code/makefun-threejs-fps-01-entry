// Main game entry point: fixed 60 Hz simulation, round state machine, bomb mechanics, and screenshot rendering.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon } from './weapon.js';
import { createBots } from './bots.js';
import { createBomb } from './bomb.js';
import { createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd0e8');
scene.fog = new THREE.Fog(new THREE.Color('#cfd8e4'), 30, 80);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const bots = createBots(scene);
const weapon = createWeapon(camera);
const bomb = createBomb(scene);
const hud = createHud();
const player = createPlayer(world.colliders, world.playerSpawn);

const input = createInput(
  renderer.domElement,
  onLockChange,
  () => {
    if (shot || roundState !== 'BUY') return;
    const open = !hud.isBuyMenuOpen();
    hud.toggleBuyMenu(open);
    if (open && document.pointerLockElement) document.exitPointerLock();
  },
  (key) => {
    weapon.selectWeapon(key);
    hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.state.name);
  }
);

const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const shootables = world.shootables.concat(bots.hitMeshes);
const direction = new THREE.Vector3();

const body = player.state;
const markerHoldMs = shot ? 4000 : 90;
let score = 0;
let elapsed = 0;
let roundTimer = 120;
let roundState = 'BUY'; // BUY, COMBAT, END
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();

hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.state.name);
hud.setStats(body.health, body.armor, body.money);
hud.setScore(0);
hud.setTimer(roundTimer);
hud.setBombStatus('Buy Phase (Press B)');

hud.onPlay(() => {
  if (shot) return;
  if (roundState === 'END') restartRound();
  if (!hud.isBuyMenuOpen()) input.requestLock();
});

hud.onBuyClose(() => {
  hud.toggleBuyMenu(false);
  input.requestLock();
});

hud.onBuyItem((itemKey) => {
  const prices = { pistol: 200, smg: 1250, rifle: 2700, sniper: 4750, grenade: 300, armor: 1000 };
  const price = prices[itemKey] || 0;
  if (body.money < price) return;

  if (itemKey === 'armor') {
    body.armor = 100;
    body.money -= price;
  } else if (itemKey === 'grenade') {
    weapon.addAmmo('grenade', 1);
    body.money -= price;
  } else {
    body.money -= price;
    weapon.selectWeapon(itemKey);
  }
  hud.setStats(body.health, body.armor, body.money);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.state.name);
});

function restartRound() {
  roundState = 'BUY';
  roundTimer = 120;
  player.reset(world.playerSpawn);
  bots.reset();
  weapon.refill();
  bomb.reset();
  hud.hideOverlay();
  hud.toggleBuyMenu(false);
  hud.setBombStatus('Buy Phase (Press B)');
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
    hud.toggleBuyMenu(false);
  } else if (roundState !== 'END') {
    hud.showOverlay(started ? 'paused' : 'start', score);
  }
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
  const targetFov = weapon.state.zoomed ? 25 : 74;
  camera.fov += (targetFov - camera.fov) * 0.2;
  camera.updateProjectionMatrix();
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spread) {
  if (!weapon.ready()) return false;
  const cfg = weapon.config();
  if (!weapon.takeRound()) return false;

  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const hit = raycaster.intersectObjects(shootables, false)[0];
  if (hit && hit.object.userData.target) {
    const killed = bots.damage(hit.object, cfg.damage);
    score += killed ? 300 : 25;
    if (killed) body.money += 300;
    hud.setScore(score);
    hud.setStats(body.health, body.armor, body.money);
    hud.hitMarker(killed, markerHoldMs);

    if (bots.remaining() === 0 && roundState !== 'END') {
      roundState = 'END';
      score += 1000;
      body.money += 3200;
      hud.showOverlay('win', score);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }
  weapon.pullTrigger();
  player.recoil(0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.state.name);
  return true;
}

function step(dt) {
  elapsed += dt;
  if (roundState === 'BUY') {
    roundTimer -= dt;
    if (roundTimer <= 115) {
      roundState = 'COMBAT';
      hud.setBombStatus('Bomb: Available');
    }
  } else if (roundState === 'COMBAT') {
    roundTimer -= dt;
    if (roundTimer <= 0) {
      roundState = 'END';
      hud.showOverlay('loss', score);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  player.step(dt, input.state.keys);
  weapon.step(dt);
  bots.step(dt, elapsed, body.position, (bot) => {
    // Bot shoots back at player
    const dead = player.damage(18);
    hud.setStats(body.health, body.armor, body.money);
    if (dead && roundState !== 'END') {
      roundState = 'END';
      hud.showOverlay('loss', score);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  });

  bomb.step(dt, body.position, world.bombSites, input.state.keys,
    () => {
      roundState = 'END';
      hud.showOverlay('loss', score);
      if (document.pointerLockElement) document.exitPointerLock();
    },
    () => {
      roundState = 'END';
      score += 1500;
      hud.showOverlay('win', score);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  );

  if (bomb.state.status === 'PLANTED') {
    hud.setBombStatus(`Bomb Planted (${Math.ceil(bomb.state.timer)}s)`, true);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen && !hud.isBuyMenuOpen()) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    if (input.state.firing && weapon.ready()) shoot(shot ? 0 : weapon.spread(player.groundSpeed()));
    if (input.state.keys.has('KeyR')) weapon.reload();
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    hud.setTimer(roundTimer);
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  hud.toggleBuyMenu(false);
  body.pitch = 0;
  body.yaw = 0;

  if (name === 'play') {
    body.position.set(0, 0, 4);
    settle(20);
    aimAt(bots.aimPoint(0));
    shoot(0);
    settle(10);
    shoot(0);
  } else if (name === 'end') {
    roundState = 'END';
    score = 2400;
    body.position.set(0, 0, 0);
    settle(20);
    hud.showOverlay('win', score);
  } else {
    // start
    body.position.copy(world.playerSpawn);
    settle(10);
    aimAt(new THREE.Vector3(0, 1.5, -10));
    hud.showOverlay('start', 0);
  }
  hud.setScore(score);
  hud.setStats(body.health, body.armor, body.money);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.state.name);
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
