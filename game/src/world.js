// Apex Terminal: An original tactical map with two lanes (Warehouse & Courtyard),
// central connectors, bomb sites A & B, and cover geometry.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: 0.03,
    });
  }

  const colliders = [];
  const shootables = [];
  const bombSites = [];

  function box(width, height, depth, x, y, z, material, isShootable = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const box3 = new THREE.Box3().setFromObject(mesh);
    colliders.push(box3);
    if (isShootable) shootables.push(mesh);
    return mesh;
  }

  // Arena: 30m wide, 36m deep, 5m walls
  // Floor
  box(32, 0.4, 38, 0, -0.2, 0, 'canvas', false);
  // Outer Walls
  box(0.4, 5, 38, -16, 2.5, 0, 'surface');
  box(0.4, 5, 38, 16, 2.5, 0, 'surface');
  box(32, 5, 0.4, 0, 2.5, -19, 'surface');
  box(32, 5, 0.4, 0, 2.5, 19, 'surface');

  // Center divider wall / building creating two main lanes (Left: Warehouse, Right: Courtyard)
  box(1.5, 4, 18, 0, 2, 0, 'surface');

  // Cross connector window/doorway
  // Left Lane covers (Warehouse)
  box(3, 1.2, 1.5, -9, 0.6, -6, 'hairline');
  box(1.5, 2.2, 1.5, -12, 1.1, -12, 'hairline');
  box(2, 0.8, 2, -7, 0.4, 6, 'hairline');
  box(2, 1.4, 1.2, -10, 0.7, 10, 'hairline');

  // Right Lane covers (Courtyard Trench)
  box(3, 1.2, 1.5, 9, 0.6, -6, 'hairline');
  box(1.5, 2.2, 1.5, 12, 1.1, -12, 'hairline');
  box(2, 0.8, 2, 7, 0.4, 6, 'hairline');
  box(2, 1.4, 1.2, 10, 0.7, 10, 'hairline');

  // Bomb Site A (Back Left Warehouse) — red zone with glowing letter marker
  const siteAMesh = box(5, 0.05, 5, -10, 0.02, -14, 'accent', false);
  siteAMesh.material = new THREE.MeshStandardMaterial({ color: 0xd23b2e, emissive: 0xd23b2e, emissiveIntensity: 0.5, roughness: 0.9 });
  siteAMesh.userData = { bombSite: 'A' };
  bombSites.push({ id: 'A', center: new THREE.Vector3(-10, 0, -14), mesh: siteAMesh });

  // Bomb Site B (Back Right Courtyard) — blue zone with glowing letter marker
  const siteBMesh = box(5, 0.05, 5, 10, 0.02, -14, 'accent', false);
  siteBMesh.material = new THREE.MeshStandardMaterial({ color: 0x2e6bd2, emissive: 0x2e6bd2, emissiveIntensity: 0.5, roughness: 0.9 });
  siteBMesh.userData = { bombSite: 'B' };
  bombSites.push({ id: 'B', center: new THREE.Vector3(10, 0, -14), mesh: siteBMesh });

  // Glowing site letter signs so sites read at a glance
  function siteSign(letter, colorHex, x, z) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = colorHex; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffffff'; g.font = 'bold 92px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    sign.position.set(x, 2.6, z);
    group.add(sign);
  }
  siteSign('A', '#d23b2e', -10, -13.9);
  siteSign('B', '#2e6bd2', 10, -13.9);

  // Emissive accent strips along each lane for wayfinding
  function strip(x, z, len, colorHex) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, len),
      new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.7 }),
    );
    s.position.set(x, 0.05, z);
    group.add(s);
  }
  strip(-9, 0, 30, '#ff9d1b');  // Warehouse lane
  strip(9, 0, 30, '#ff9d1b');   // Courtyard lane

  // Spawns
  const playerSpawn = new THREE.Vector3(0, 0, 15);
  const botSpawns = [
    new THREE.Vector3(-10, 0, -14),
    new THREE.Vector3(10, 0, -14),
    new THREE.Vector3(-6, 0, -10),
    new THREE.Vector3(6, 0, -10),
  ];

  // Lighting
  const sky = new THREE.HemisphereLight(new THREE.Color('#eaf1ff'), new THREE.Color('#a89f92'), 1.6);
  scene.add(sky);

  const key = new THREE.DirectionalLight(new THREE.Color(PALETTE.ink), 2.6);
  key.position.set(10, 16, 8);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  key.shadow.camera.far = 55;
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.muted), 0.9);
  fill.position.set(-10, 10, 12);
  scene.add(fill);

  return { colliders, shootables, bombSites, playerSpawn, botSpawns, group };
}
