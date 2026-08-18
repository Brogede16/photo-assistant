import * as THREE from "../vendor/three.module.min.js";

// Forenklet, selvbygget model af EOS 80D-huset (uden objektiv). Ikke en
// scannet CAD-model, men proportioneret så knapperne sidder cirka, hvor de
// gør på det rigtige kamera. Alle mål er skøn, ikke millimeterpræcise.
const BODY_W = 7.4;
const BODY_H = 4.6;
const BODY_D = 4.4;
const GRIP_W = 1.6;

const HOTSPOT_LAYOUT = {
  modeDial: { x: -BODY_W * 0.3, y: BODY_H / 2, z: -BODY_D * 0.18 },
  shutterButton: { x: BODY_W / 2 - GRIP_W * 0.55, y: BODY_H / 2, z: BODY_D * 0.32 },
  isoButton: { x: BODY_W * 0.08, y: BODY_H / 2, z: -BODY_D * 0.15 },
  afDriveButton: { x: BODY_W * 0.2, y: BODY_H / 2, z: -BODY_D * 0.15 },
  meteringWbButton: { x: BODY_W * 0.32, y: BODY_H / 2, z: -BODY_D * 0.15 },
  quickControlDial: { x: BODY_W / 2 - GRIP_W * 0.45, y: -BODY_H * 0.05, z: -BODY_D / 2 - 0.02 },
  liveViewSwitch: { x: BODY_W / 2 - GRIP_W * 0.45, y: BODY_H * 0.42, z: -BODY_D / 2 - 0.02 }
};

const BODY_COLOR = 0x1c1f24;
const ACCENT_COLOR = 0x3b5bff;

function buildBody() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.55, metalness: 0.2 });

  const main = new THREE.Mesh(new THREE.BoxGeometry(BODY_W - GRIP_W * 0.6, BODY_H, BODY_D), bodyMaterial);
  main.position.set(-GRIP_W * 0.3, 0, 0);
  group.add(main);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(GRIP_W, BODY_H * 0.92, BODY_D * 0.86), bodyMaterial);
  grip.position.set(BODY_W / 2 - GRIP_W / 2, -BODY_H * 0.02, BODY_D * 0.04);
  group.add(grip);

  const hump = new THREE.Mesh(new THREE.BoxGeometry(BODY_W * 0.34, BODY_H * 0.28, BODY_D * 0.7), bodyMaterial);
  hump.position.set(-BODY_W * 0.08, BODY_H / 2 + BODY_H * 0.14, -BODY_D * 0.05);
  group.add(hump);

  const eyepiece = new THREE.Mesh(new THREE.BoxGeometry(BODY_W * 0.14, BODY_H * 0.1, BODY_D * 0.1), bodyMaterial);
  eyepiece.position.set(-BODY_W * 0.08, BODY_H / 2 + BODY_H * 0.14, -BODY_D / 2 - BODY_D * 0.05);
  group.add(eyepiece);

  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(BODY_H * 0.34, BODY_H * 0.34, 0.3, 32),
    new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4, metalness: 0.6 })
  );
  mount.rotation.x = Math.PI / 2;
  mount.position.set(-GRIP_W * 0.3, -BODY_H * 0.05, BODY_D / 2 + 0.14);
  group.add(mount);

  const mountRing = new THREE.Mesh(
    new THREE.TorusGeometry(BODY_H * 0.36, 0.05, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.8 })
  );
  mountRing.position.copy(mount.position);
  group.add(mountRing);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(BODY_W * 0.44, BODY_H * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.3, metalness: 0.1 })
  );
  screen.position.set(-BODY_W * 0.22, -BODY_H * 0.08, -BODY_D / 2 - 0.03);
  screen.rotation.y = Math.PI;
  group.add(screen);

  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(BODY_W * 0.2, 0.06, BODY_D * 0.22),
    new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.4 })
  );
  topPlate.position.set(BODY_W * 0.02, BODY_H / 2 + 0.04, BODY_D * 0.05);
  group.add(topPlate);

  return group;
}

function buildHotspotMarker() {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 16),
    new THREE.MeshStandardMaterial({ color: ACCENT_COLOR, emissive: ACCENT_COLOR, emissiveIntensity: 0.6, roughness: 0.4 })
  );
  return marker;
}

export function initCamera3D(canvas, controlsReference, { onSelect } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const rig = new THREE.Group();
  rig.add(buildBody());
  scene.add(rig);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 6, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fa5ff, 0.4);
  fill.position.set(-5, -2, -4);
  scene.add(fill);

  const hotspotMeshes = [];
  for (const control of controlsReference) {
    const layout = HOTSPOT_LAYOUT[control.id];
    if (!layout) continue;
    const marker = buildHotspotMarker();
    marker.position.set(layout.x, layout.y, layout.z);
    marker.userData.control = control;
    rig.add(marker);
    hotspotMeshes.push(marker);
  }

  let distance = 13;
  let azimuth = Math.PI * 0.28;
  let polar = Math.PI * 0.38;
  const updateCameraPosition = () => {
    const clampedPolar = Math.max(0.18, Math.min(Math.PI - 0.18, polar));
    camera.position.set(
      distance * Math.sin(clampedPolar) * Math.sin(azimuth),
      distance * Math.cos(clampedPolar),
      distance * Math.sin(clampedPolar) * Math.cos(azimuth)
    );
    camera.lookAt(0, 0, 0);
  };
  updateCameraPosition();

  const raycaster = new THREE.Raycaster();
  const pointerVector = new THREE.Vector2();
  const activePointers = new Map();
  let dragTotal = 0;
  let pinchStartDistance = null;
  let pinchStartZoom = null;
  let hasInteracted = false;

  const pointerNdc = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
  };

  const onPointerDown = (event) => {
    hasInteracted = true;
    canvas.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragTotal = 0;
    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      pinchStartDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartZoom = distance;
    }
  };

  const onPointerMove = (event) => {
    if (!activePointers.has(event.pointerId)) return;
    const previous = activePointers.get(event.pointerId);
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      const currentDistance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStartDistance) {
        distance = Math.max(6, Math.min(22, pinchStartZoom * (pinchStartDistance / currentDistance)));
        updateCameraPosition();
      }
      return;
    }

    dragTotal += Math.abs(dx) + Math.abs(dy);
    azimuth -= dx * 0.008;
    polar -= dy * 0.008;
    updateCameraPosition();
  };

  const onPointerUp = (event) => {
    if (activePointers.has(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);
    activePointers.delete(event.pointerId);
    pinchStartDistance = null;
    if (activePointers.size < 2) pinchStartZoom = null;

    if (dragTotal < 6 && onSelect) {
      const { x, y } = pointerNdc(event);
      pointerVector.set(x, y);
      raycaster.setFromCamera(pointerVector, camera);
      const hit = raycaster.intersectObjects(hotspotMeshes)[0];
      if (hit) onSelect(hit.object.userData.control);
    }
  };

  const onWheel = (event) => {
    event.preventDefault();
    distance = Math.max(6, Math.min(22, distance + event.deltaY * 0.01));
    updateCameraPosition();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const resize = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  let frameId = null;
  const tick = () => {
    if (!hasInteracted) rig.rotation.y += 0.0015;
    for (const marker of hotspotMeshes) {
      const pulse = 1 + Math.sin(performance.now() / 400 + marker.id) * 0.08;
      marker.scale.setScalar(pulse);
    }
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(tick);
  };
  tick();

  return function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    scene.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose?.();
    });
    renderer.dispose();
  };
}
