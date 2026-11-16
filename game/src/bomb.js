// Bomb Objective: carrying, planting at site A or B, ticking timer, and defusing.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createBomb(scene) {
  const geometry = new THREE.BoxGeometry(0.35, 0.2, 0.35);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.4, metalness: 0.6 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  scene.add(mesh);

  const state = {
    status: 'CARRIED', // CARRIED, DROPPED, PLANTED, DEFUSED, EXPLODED
    position: new THREE.Vector3(),
    plantedAt: null,
    timer: 40,
    plantProgress: 0,
    defuseProgress: 0,
  };

  const plantTime = 3.0; // seconds to plant or defuse

  function plant(pos, siteId) {
    state.status = 'PLANTED';
    state.position.copy(pos);
    mesh.position.copy(pos);
    mesh.position.y += 0.1;
    mesh.visible = true;
    state.plantedAt = siteId;
    state.timer = 40;
    state.plantProgress = 0;
  }

  function step(dt, playerPos, bombSites, keys, onExplode, onDefuse) {
    if (state.status === 'PLANTED') {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.status = 'EXPLODED';
        if (onExplode) onExplode();
        return;
      }

      // Check if player is near bomb to defuse (holding E)
      const dist = playerPos.distanceTo(state.position);
      if (dist < 2.5 && keys.has('KeyE')) {
        state.defuseProgress += dt;
        if (state.defuseProgress >= plantTime) {
          state.status = 'DEFUSED';
          mesh.visible = false;
          if (onDefuse) onDefuse();
        }
      } else {
        state.defuseProgress = Math.max(0, state.defuseProgress - dt * 2);
      }
    } else if (state.status === 'CARRIED') {
      // Check if player wants to plant at site A or B
      let nearSite = null;
      for (const site of bombSites) {
        if (playerPos.distanceTo(site.center) < 3.0) {
          nearSite = site;
          break;
        }
      }

      if (nearSite && keys.has('KeyE')) {
        state.plantProgress += dt;
        if (state.plantProgress >= plantTime) {
          plant(nearSite.center, nearSite.id);
        }
      } else {
        state.plantProgress = Math.max(0, state.plantProgress - dt * 2);
      }
    }
  }

  function reset() {
    state.status = 'CARRIED';
    state.plantedAt = null;
    state.timer = 40;
    state.plantProgress = 0;
    state.defuseProgress = 0;
    mesh.visible = false;
  }

  return {
    state,
    plant,
    step,
    reset,
  };
}
