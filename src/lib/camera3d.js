import * as THREE from "../vendor/three.module.min.js";

// Håndbygget model af Canon EOS 80D-huset (uden objektiv).
//
// Den er ikke en CAD-scanning, men proportionerne følger de officielle mål —
// 139 x 105 x 79 mm — i skalaen 1 enhed = 10 mm, og hver knap sidder, hvor den
// sidder på det rigtige kamera. Det er hele pointen: en generisk DSLR-model
// ville placere hotspots forkert og dermed lære forkert fra sig.
//
// Koordinater: +X er fotografens højre side (greb), +Y er op, +Z er fremad
// (den retning objektivet peger).

const BODY_W = 13.9;
const BODY_BOTTOM = -3.4;
const SLAB_TOP = 3.4;
const PLATE_TOP = 4.4;
const PRISM_TOP = 6.8;
const BODY_FRONT = 2.15;
const BODY_BACK = -2.75;

// Hvert punkt ligger lige uden for den flade, knappen sidder på, så
// markøren kan rammes uden at forsvinde ind i geometrien.
const HOTSPOT_LAYOUT = {
  modeDial: [-4.6, PLATE_TOP + 0.75, -0.5],
  shutterButton: [5.6, 4.55, 3.1],
  afDriveButton: [1.9, PLATE_TOP + 0.28, -1.5],
  isoButton: [3.0, PLATE_TOP + 0.28, -1.5],
  meteringWbButton: [4.1, PLATE_TOP + 0.28, -1.5],
  quickControlDial: [4.9, -0.9, BODY_BACK - 0.3],
  liveViewSwitch: [4.5, 2.7, BODY_BACK - 0.22]
};

const ACCENT = 0x5b7cff;

function makeMaterials() {
  return {
    body: new THREE.MeshStandardMaterial({ color: 0x26282d, roughness: 0.58, metalness: 0.22 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.95, metalness: 0.02 }),
    dial: new THREE.MeshStandardMaterial({ color: 0x2f333a, roughness: 0.45, metalness: 0.45 }),
    ridge: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.75, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb6bac1, roughness: 0.26, metalness: 0.92 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x080a0f, roughness: 0.12, metalness: 0.05 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }),
    white: new THREE.MeshStandardMaterial({ color: 0xd7dae0, roughness: 0.6 })
  };
}

function roundedRectShape(width, height, radius) {
  const r = Math.max(0.01, Math.min(radius, width / 2 - 0.01, height / 2 - 0.01));
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

// ExtrudeGeometry med bevel giver bløde kanter hele vejen rundt. Det er
// forskellen på noget, der ligner en kasse, og noget, der ligner et kamerahus.
function extrudeShape(shape, depth, bevel) {
  const b = Math.max(0.02, Math.min(bevel, depth / 3));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - b * 2,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 14
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function roundedBox(width, height, depth, radius, bevel = 0.16) {
  const b = Math.max(0.02, Math.min(bevel, width / 4, height / 4, depth / 4));
  return extrudeShape(roundedRectShape(width - b * 2, height - b * 2, radius - b), depth, b);
}

function trapezoidShape(bottomWidth, topWidth, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-bottomWidth / 2, -height / 2);
  shape.lineTo(bottomWidth / 2, -height / 2);
  shape.lineTo(topWidth / 2, height / 2);
  shape.lineTo(-topWidth / 2, height / 2);
  shape.closePath();
  return shape;
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Programhjulets bogstaver tegnes som tekstur, så hjulet kan læses direkte
// på modellen i stedet for kun i forklaringen ved siden af.
function modeDialTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = "#2f333a";
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1b1d21";
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.27, 0, Math.PI * 2);
    ctx.fill();

    const modes = ["M", "Av", "Tv", "P", "A+", "SCN", "Q", "B"];
    ctx.font = "bold 46px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    modes.forEach((label, index) => {
      const angle = (index / modes.length) * Math.PI * 2 - Math.PI / 2;
      const radius = w * 0.37;
      ctx.fillStyle = ["M", "Av", "Tv", "P", "B"].includes(label) ? "#f2f4f8" : "#9aa0ab";
      ctx.fillText(label, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    });

    // Hvidt indeksmærke ud for den valgte indstilling.
    ctx.fillStyle = "#f2f4f8";
    ctx.fillRect(cx - 5, cy - w * 0.47, 10, 26);
  });
}

// Topskærmen viser en aflæsning, så det er tydeligt, hvor lukkertid, blænde
// og ISO faktisk kan læses, når en guide siger "kig på topskærmen".
function topLcdTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#8f9a86";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1a1d18";
    ctx.font = "bold 78px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("1/160", 26, 74);
    ctx.textAlign = "right";
    ctx.fillText("F5.6", w - 26, 74);
    ctx.font = "bold 52px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText("ISO 400", 26, 178);
    ctx.textAlign = "right";
    ctx.fillText("[+++]", w - 26, 178);
  });
}

function rearLcdTexture() {
  return canvasTexture(512, 342, (ctx, w, h) => {
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#2a3346";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.fillStyle = "#e8ecf4";
    ctx.font = "bold 96px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("Tv", w / 2, 108);
    ctx.font = "bold 64px ui-monospace, monospace";
    ctx.fillText("1/160  F5.6", w / 2, 200);
    ctx.fillStyle = "#8f9bb3";
    ctx.font = "40px system-ui, sans-serif";
    ctx.fillText("ISO 400", w / 2, 268);
  });
}

function knurledDial(radius, height, teeth, materials, faceMaterial = null) {
  const group = new THREE.Group();
  const sideMaterial = materials.dial;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 44),
    faceMaterial ? [sideMaterial, faceMaterial, sideMaterial] : sideMaterial
  );
  group.add(core);

  const ridgeGeometry = new THREE.BoxGeometry(radius * 0.12, height * 0.98, radius * 0.2);
  const ridges = new THREE.InstancedMesh(ridgeGeometry, materials.ridge, teeth);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < teeth; index += 1) {
    const angle = (index / teeth) * Math.PI * 2;
    position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    quaternion.setFromEuler(new THREE.Euler(0, -angle, 0));
    matrix.compose(position, quaternion, scale);
    ridges.setMatrixAt(index, matrix);
  }
  ridges.instanceMatrix.needsUpdate = true;
  group.add(ridges);
  return group;
}

function buildBody(materials) {
  const group = new THREE.Group();
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  const slabHeight = SLAB_TOP - BODY_BOTTOM;
  const slabDepth = BODY_FRONT - BODY_BACK;
  add(roundedBox(BODY_W, slabHeight, slabDepth, 0.85), materials.body, 0, (SLAB_TOP + BODY_BOTTOM) / 2, (BODY_FRONT + BODY_BACK) / 2);

  // Skulderpartier: topplade til venstre for prismet (programhjul) og til
  // højre (topskærm og knapper).
  const shoulderHeight = PLATE_TOP - SLAB_TOP + 0.5;
  add(roundedBox(5.35, shoulderHeight, slabDepth - 0.25, 0.5), materials.body, -4.28, PLATE_TOP - shoulderHeight / 2, (BODY_FRONT + BODY_BACK) / 2);
  add(roundedBox(5.55, shoulderHeight, slabDepth - 0.25, 0.5), materials.body, 4.18, PLATE_TOP - shoulderHeight / 2, (BODY_FRONT + BODY_BACK) / 2);

  // Pentaprisme: trapez set forfra, hvilket er husets mest genkendelige træk.
  // En bredere sokkel under prismet får det til at gro ud af toppladen i
  // stedet for at stå som en løs kasse ovenpå.
  const prismHeight = PRISM_TOP - SLAB_TOP;
  add(extrudeShape(trapezoidShape(6.4, 4.9, 1.1), 4.0, 0.3), materials.body, -0.35, SLAB_TOP + 0.5, 0.1);
  add(extrudeShape(trapezoidShape(4.7, 3.4, prismHeight), 3.5, 0.16), materials.body, -0.35, SLAB_TOP + prismHeight / 2, 0.15);

  // Blitzsko oven på prismet.
  add(roundedBox(1.9, 0.28, 1.9, 0.1, 0.05), materials.body, -0.35, PRISM_TOP + 0.1, 0.15);
  add(roundedBox(1.55, 0.16, 1.5, 0.06, 0.04), materials.metal, -0.35, PRISM_TOP + 0.24, 0.15);

  // Søgerens gummi-øjestykke.
  add(roundedBox(2.5, 1.5, 0.75, 0.35, 0.14), materials.rubber, -0.35, SLAB_TOP + prismHeight * 0.42, BODY_BACK - 0.2);
  add(roundedBox(1.85, 0.95, 0.2, 0.2, 0.05), materials.glass, -0.35, SLAB_TOP + prismHeight * 0.42, BODY_BACK - 0.5);

  // Grebet bygges som en top-down silhuet, der trækkes op ad Y-aksen, så det
  // buer udad, i stedet for at stå som en firkantet klods. Det stikker cirka
  // 17 mm længere frem end husets forplade, som på det rigtige kamera.
  const gripGeometry = extrudeShape(roundedRectShape(3.4, 3.5, 1.3), 7.3, 0.38);
  gripGeometry.rotateX(-Math.PI / 2);
  add(gripGeometry, materials.rubber, 5.25, 0.3, 2.1);

  // Objektivbajonet med indeksmærker for EF (rød prik) og EF-S (hvidt kvadrat).
  const mountX = -0.6;
  const mountY = -0.1;
  const mountFace = BODY_FRONT + 0.85;
  const flange = add(new THREE.CylinderGeometry(3.1, 3.15, 1.05, 56), materials.body, mountX, mountY, BODY_FRONT + 0.35);
  flange.rotation.x = Math.PI / 2;
  // Selve bajonetringen er en åben ring, ikke en skive, så kameraets indre
  // stadig kan ses igennem den.
  add(new THREE.RingGeometry(2.25, 2.78, 56), materials.metal, mountX, mountY, mountFace);
  const collar = add(new THREE.CylinderGeometry(2.78, 2.78, 0.3, 56, 1, true), materials.metal, mountX, mountY, mountFace - 0.15);
  collar.rotation.x = Math.PI / 2;
  const throat = add(new THREE.CylinderGeometry(2.25, 2.25, 1.5, 48, 1, true), materials.glass, mountX, mountY, BODY_FRONT + 0.35);
  throat.rotation.x = Math.PI / 2;
  add(new THREE.CircleGeometry(2.2, 40), materials.glass, mountX, mountY, BODY_FRONT - 0.35);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 16), materials.red, mountX + 2.92, mountY, mountFace - 0.02).rotation.x = Math.PI / 2;
  add(roundedBox(0.32, 0.32, 0.14, 0.05, 0.04), materials.white, mountX, mountY + 2.92, mountFace - 0.02);

  // Objektivudløser: den knap, der skal holdes inde, når objektivet drejes af.
  add(new THREE.CylinderGeometry(0.32, 0.32, 0.55, 22), materials.dial, mountX - 3.5, mountY + 0.3, BODY_FRONT + 0.1).rotation.z = Math.PI / 2;

  // Bagskærm med ramme.
  add(roundedBox(6.9, 4.8, 0.28, 0.28, 0.08), materials.body, -1.6, -0.2, BODY_BACK - 0.1);
  const rearScreen = add(new THREE.PlaneGeometry(6.3, 4.2), new THREE.MeshStandardMaterial({
    map: rearLcdTexture(), roughness: 0.18, metalness: 0.05
  }), -1.6, -0.2, BODY_BACK - 0.26);
  rearScreen.rotation.y = Math.PI;

  // Topskærm.
  add(roundedBox(3.9, 0.22, 2.2, 0.22, 0.07), materials.body, 3.5, PLATE_TOP + 0.02, 0.55);
  const topScreen = add(new THREE.PlaneGeometry(3.5, 1.8), new THREE.MeshStandardMaterial({
    map: topLcdTexture(), roughness: 0.55, metalness: 0.0
  }), 3.5, PLATE_TOP + 0.14, 0.55);
  topScreen.rotation.x = -Math.PI / 2;

  // Programhjul med læsbare bogstaver på oversiden.
  const modeDial = knurledDial(1.45, 0.62, 30, materials, new THREE.MeshStandardMaterial({
    map: modeDialTexture(), roughness: 0.45, metalness: 0.25
  }));
  modeDial.position.set(-4.6, PLATE_TOP + 0.22, -0.5);
  group.add(modeDial);
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 24), materials.ridge, -4.6, PLATE_TOP + 0.6, -0.5);

  // Main Dial: ligger skråt ved udløseren, så kun overkanten stikker op.
  const mainDial = knurledDial(0.85, 0.42, 26, materials);
  mainDial.position.set(4.85, PLATE_TOP - 0.12, 2.3);
  mainDial.rotation.x = -0.32;
  group.add(mainDial);

  // Udløserknap, let skråtstillet ligesom på grebet.
  const shutter = add(new THREE.CylinderGeometry(0.46, 0.5, 0.34, 28), materials.body, 5.6, 4.28, 3.05);
  shutter.rotation.x = -0.3;

  // Quick Control Dial på bagsiden.
  const quickDial = knurledDial(1.55, 0.34, 32, materials);
  quickDial.position.set(4.9, -0.9, BODY_BACK - 0.08);
  quickDial.rotation.x = Math.PI / 2;
  group.add(quickDial);
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.24, 24), materials.body, 4.9, -0.9, BODY_BACK - 0.24).rotation.x = Math.PI / 2;

  // Live View-kontakt med rød start/stop-knap.
  add(new THREE.CylinderGeometry(0.55, 0.55, 0.26, 26), materials.dial, 4.5, 2.7, BODY_BACK - 0.1).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 20), materials.red, 4.5, 2.7, BODY_BACK - 0.24).rotation.x = Math.PI / 2;

  // Knaprækken bag topskærmen: AF·DRIVE, ISO og målemetode/WB.
  for (const x of [1.9, 3.0, 4.1]) {
    add(new THREE.CylinderGeometry(0.3, 0.32, 0.24, 22), materials.dial, x, PLATE_TOP + 0.06, -1.5);
  }

  // Et par knapper på bagsiden, så bagpladen ikke står tom.
  for (const [x, y] of [[-6.0, 2.5], [-6.0, 1.4], [-6.0, 0.3], [-6.0, -0.8], [4.2, 1.5], [5.6, 1.5]]) {
    add(roundedBox(0.72, 0.42, 0.2, 0.16, 0.05), materials.dial, x, y, BODY_BACK - 0.12);
  }

  // Stativgevind i bunden.
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 24), materials.metal, -0.6, BODY_BOTTOM - 0.02, 0.2);

  return group;
}

function buildHotspot(materials) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 20, 20),
    new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.75, roughness: 0.35 })
  );
  group.add(core);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.44, 0.56, 28),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  group.add(ring);
  group.userData.core = core;
  group.userData.ring = ring;
  return group;
}

// Metal og blanke flader har brug for noget at spejle. Uden et environment map
// bliver metalness nærmest sort, så bajonetringen forsvinder. Det her er et
// billigt studiemiljø: lys top, mørk bund og to "softbox"-felter, der giver
// kanterne deres glans.
function environmentTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.34, "#ccd6ea");
    gradient.addColorStop(0.52, "#78829a");
    gradient.addColorStop(0.72, "#333b4a");
    gradient.addColorStop(1, "#12151c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(w * 0.06, h * 0.08, w * 0.22, h * 0.24);
    ctx.fillRect(w * 0.60, h * 0.05, w * 0.17, h * 0.20);
    ctx.fillStyle = "rgba(180,200,255,0.55)";
    ctx.fillRect(w * 0.34, h * 0.12, w * 0.12, h * 0.16);
  });
}

function contactShadowTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, "rgba(0,0,0,0.5)");
    gradient.addColorStop(0.55, "rgba(0,0,0,0.22)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}

export function initCamera3D(canvas, controlsReference, { onSelect } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const materials = makeMaterials();
  const scene = new THREE.Scene();

  const envSource = environmentTexture();
  envSource.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromEquirectangular(envSource);
  scene.environment = envTarget.texture;
  envSource.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 200);
  const rig = new THREE.Group();
  rig.add(buildBody(materials));
  scene.add(rig);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 20),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = BODY_BOTTOM - 0.1;
  scene.add(shadow);

  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(6, 10, 9);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.35);
  fill.position.set(-9, -1, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 0.85);
  rim.position.set(-4, 5, -11);
  scene.add(rim);

  const hotspots = [];
  for (const control of controlsReference) {
    const layout = HOTSPOT_LAYOUT[control.id];
    if (!layout) continue;
    const marker = buildHotspot(materials);
    marker.position.set(layout[0], layout[1], layout[2]);
    marker.userData.control = control;
    marker.userData.core.userData.marker = marker;
    rig.add(marker);
    hotspots.push(marker);
  }
  const hotspotCores = hotspots.map((marker) => marker.userData.core);

  let distance = 27;
  let azimuth = 0.62;
  let polar = 1.12;
  const target = new THREE.Vector3(0, 0.6, 0);
  const updateCamera = () => {
    polar = Math.max(0.2, Math.min(Math.PI - 0.2, polar));
    camera.position.set(
      target.x + distance * Math.sin(polar) * Math.sin(azimuth),
      target.y + distance * Math.cos(polar),
      target.z + distance * Math.sin(polar) * Math.cos(azimuth)
    );
    camera.lookAt(target);
  };
  updateCamera();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const activePointers = new Map();
  let dragTotal = 0;
  let pinchStart = null;
  let pinchZoom = null;
  let hasInteracted = false;
  let hovered = null;

  const toNdc = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    return pointer;
  };

  const pickHotspot = (event) => {
    raycaster.setFromCamera(toNdc(event), camera);
    return raycaster.intersectObjects(hotspotCores, false)[0]?.object.userData.marker || null;
  };

  const setHovered = (marker) => {
    if (hovered === marker) return;
    if (hovered) hovered.userData.core.material.emissiveIntensity = 0.75;
    hovered = marker;
    if (hovered) hovered.userData.core.material.emissiveIntensity = 1.8;
    canvas.style.cursor = hovered ? "pointer" : "grab";
  };

  const onPointerDown = (event) => {
    hasInteracted = true;
    canvas.setPointerCapture?.(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragTotal = 0;
    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = distance;
    }
  };

  const onPointerMove = (event) => {
    if (!activePointers.has(event.pointerId)) {
      setHovered(pickHotspot(event));
      return;
    }
    const previous = activePointers.get(event.pointerId);
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      const current = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart && current > 0) {
        distance = Math.max(14, Math.min(48, pinchZoom * (pinchStart / current)));
        updateCamera();
      }
      return;
    }

    dragTotal += Math.abs(dx) + Math.abs(dy);
    azimuth -= dx * 0.008;
    polar -= dy * 0.008;
    updateCamera();
  };

  const onPointerUp = (event) => {
    if (activePointers.has(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);
    activePointers.delete(event.pointerId);
    pinchStart = null;
    if (activePointers.size < 2) pinchZoom = null;
    if (dragTotal < 6 && onSelect) {
      const marker = pickHotspot(event);
      if (marker) onSelect(marker.userData.control);
    }
  };

  const onWheel = (event) => {
    event.preventDefault();
    hasInteracted = true;
    distance = Math.max(14, Math.min(48, distance + event.deltaY * 0.016));
    updateCamera();
  };

  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const resize = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  let frameId = null;
  const tick = () => {
    if (!hasInteracted) {
      azimuth += 0.0022;
      updateCamera();
    }
    for (const marker of hotspots) {
      marker.userData.ring.quaternion.copy(camera.quaternion);
      const pulse = 1 + Math.sin(performance.now() / 520 + marker.position.x) * 0.09;
      marker.userData.ring.scale.setScalar(pulse);
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
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        material?.map?.dispose?.();
        material?.dispose?.();
      }
    });
    envTarget.dispose();
    renderer.dispose();
  };
}
