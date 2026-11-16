// AI Opponent Bots: patrol routes, vision/hearing detection, combat state machine, and hitboxes.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const WAYPOINTS = [
  [new THREE.Vector3(-10, 0, -14), new THREE.Vector3(-10, 0, 0), new THREE.Vector3(-10, 0, 10)],
  [new THREE.Vector3(10, 0, -14), new THREE.Vector3(10, 0, 0), new THREE.Vector3(10, 0, 10)],
  [new THREE.Vector3(-6, 0, -6), new THREE.Vector3(6, 0, -6), new THREE.Vector3(0, 0, 0)],
  [new THREE.Vector3(0, 0, -14), new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, 0, 6)],
];

export function createBots(scene) {
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.6, metalness: 0.05 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.1 });
  const standMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.85 });

  const torsoGeometry = new THREE.BoxGeometry(0.52, 0.78, 0.3);
  const headGeometry = new THREE.SphereGeometry(0.155, 16, 12);
  const limbGeometry = new THREE.BoxGeometry(0.18, 0.7, 0.2);

  const items = [];
  const hitMeshes = [];

  for (let index = 0; index < WAYPOINTS.length; index += 1) {
    const waypoints = WAYPOINTS[index];
    const startPos = waypoints[0];

    const group = new THREE.Group();
    group.position.copy(startPos);

    const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
    torso.position.y = 1.0;
    torso.userData.part = 'torso';

    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.53;
    head.userData.part = 'head';

    const leftArm = new THREE.Mesh(limbGeometry, standMaterial);
    leftArm.position.set(-0.38, 1.0, 0);
    const rightArm = new THREE.Mesh(limbGeometry, standMaterial);
    rightArm.position.set(0.38, 1.0, 0);

    group.add(torso, head, leftArm, rightArm);
    group.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    scene.add(group);

    const bot = {
      index,
      group,
      torso,
      head,
      health: 100,
      maxHealth: 100,
      alive: true,
      fall: 0,
      respawnAt: 0,
      waypoints,
      waypointIndex: 0,
      state: 'PATROL', // PATROL, ALERT, COMBAT, DEAD
      speed: 2.4,
      targetPos: waypoints[0].clone(),
      lastSeenPlayer: 0,
      shootCooldown: 0,
      home: startPos.clone(),
    };

    torso.userData.target = bot;
    head.userData.target = bot;
    hitMeshes.push(torso, head);
    items.push(bot);
  }

  function damage(mesh, amount) {
    const bot = mesh.userData.target;
    if (!bot || !bot.alive) return false;
    const multiplier = mesh.userData.part === 'head' ? 4 : 1;
    bot.health -= amount * multiplier;
    bot.state = 'COMBAT';
    if (bot.health > 0) return false;
    bot.alive = false;
    bot.fall = 0;
    bot.group.rotation.x = -1.57;
    bot.group.position.y = 0.2;
    return true;
  }

  function step(dt, time, playerPos, onBotShoot) {
    for (const bot of items) {
      if (!bot.alive) continue;

      const distToPlayer = bot.group.position.distanceTo(playerPos);
      if (distToPlayer < 14) {
        bot.state = 'COMBAT';
        bot.lastSeenPlayer = time;
      } else if (bot.state === 'COMBAT' && time - bot.lastSeenPlayer > 4) {
        bot.state = 'PATROL';
      }

      if (bot.state === 'PATROL') {
        const target = bot.waypoints[bot.waypointIndex];
        const dir = target.clone().sub(bot.group.position);
        dir.y = 0;
        const dist = dir.length();
        if (dist < 0.5) {
          bot.waypointIndex = (bot.waypointIndex + 1) % bot.waypoints.length;
        } else {
          dir.normalize();
          bot.group.position.addScaledVector(dir, bot.speed * dt);
          bot.group.rotation.y = Math.atan2(dir.x, dir.z);
        }
      } else if (bot.state === 'COMBAT') {
        // Face player
        const dir = playerPos.clone().sub(bot.group.position);
        dir.y = 0;
        bot.group.rotation.y = Math.atan2(dir.x, dir.z);

        // Shoot back
        bot.shootCooldown -= dt;
        if (bot.shootCooldown <= 0 && distToPlayer < 18) {
          bot.shootCooldown = 0.8 + Math.random() * 0.6;
          if (onBotShoot) onBotShoot(bot);
        }
      }
    }
  }

  return {
    items,
    hitMeshes,
    damage,
    step,
    remaining() {
      return items.filter((b) => b.alive).length;
    },
    reset() {
      for (const bot of items) {
        bot.alive = true;
        bot.health = 100;
        bot.fall = 0;
        bot.state = 'PATROL';
        bot.group.rotation.set(0, 0, 0);
        bot.group.position.copy(bot.home);
      }
    },
    aimPoint(index) {
      const bot = items[index % items.length];
      return new THREE.Vector3(bot.group.position.x, bot.torso.position.y, bot.group.position.z);
    },
  };
}
