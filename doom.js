// ============================================
// ALVE'S WORLD - DOOM-Style FPS Renderer
// Three.js rendering, audio, input, HUD
// All game logic from game-logic.js globals
// ============================================

(function () {
  'use strict';

  // ---- MODULE STATE ----
  let scene, camera, renderer, canvas;
  let animationFrameId = null;
  let audioCtx = null;
  let ambientOsc = null;
  let ambientGain = null;
  let ambientOsc2 = null;
  let ambientGain2 = null;
  let pointerLocked = false;
  let gameState = null;
  let lastTime = 0;
  let wallMeshes = [];
  let floorMesh = null;
  let ceilingMesh = null;
  let mudMeshes = [];
  let creeperMeshes = {};
  let weaponMesh = null;
  let muzzleFlashMesh = null;
  let muzzleFlashTimer = 0;
  let weaponRecoil = 0;
  let hurtFlashTimer = 0;
  let lastPlayerHealth = 0;
  let faceState = 'neutral'; // neutral, grimace, grin
  let faceStateTimer = 0;
  let gameOverShown = false;
  let doomContainer = null;
  let hudElement = null;
  let creeperDeathAnims = []; // { mesh, timer, duration }

  // Cheat code detector
  let cheatDetector = null;

  // Secret wall state
  let secretWallMessageTimer = 0;

  // Level transition state
  let levelTransitionTimer = 0;
  let levelTransitionActive = false;

  // Current active level textures
  let currentLevel = 'doom';

  // Lighting references for level switching
  let sceneLights = [];

  // Input state
  const keys = {};
  let mouseDeltaX = 0;

  // ---- PROCEDURAL TEXTURES ----

  function createWallTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Base dark grey
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, size, size);

    // Random noise for stone texture
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const noise = Math.random() * 30 - 15;
        const base = 58 + noise;
        ctx.fillStyle = `rgb(${base}, ${base}, ${base})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Grid lines (mortar)
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    // Horizontal lines
    for (let y = 0; y < size; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    // Vertical lines (offset every other row for brick pattern)
    for (let row = 0; row < size / 16; row++) {
      const offset = row % 2 === 0 ? 0 : 8;
      for (let x = offset; x < size; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, row * 16);
        ctx.lineTo(x, (row + 1) * 16);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createPigWallTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Base pink
    ctx.fillStyle = '#FFB6C1';
    ctx.fillRect(0, 0, size, size);

    // Pink noise for texture
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const noise = Math.random() * 30 - 15;
        const r = Math.min(255, Math.max(0, 255 + noise - 20));
        const g = Math.min(255, Math.max(0, 182 + noise - 20));
        const b = Math.min(255, Math.max(0, 193 + noise - 15));
        ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Darker pink brick lines
    ctx.strokeStyle = '#CC8899';
    ctx.lineWidth = 1;
    for (let y = 0; y < size; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    for (let row = 0; row < size / 16; row++) {
      const offset = row % 2 === 0 ? 0 : 8;
      for (let x = offset; x < size; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, row * 16);
        ctx.lineTo(x, (row + 1) * 16);
        ctx.stroke();
      }
    }

    // Brown mud splotches
    for (let i = 0; i < 8; i++) {
      const sx = Math.floor(Math.random() * (size - 8));
      const sy = Math.floor(Math.random() * (size - 8));
      const sw = Math.floor(Math.random() * 6) + 3;
      const sh = Math.floor(Math.random() * 6) + 3;
      ctx.fillStyle = `rgba(${100 + Math.floor(Math.random() * 40)}, ${60 + Math.floor(Math.random() * 30)}, ${30 + Math.floor(Math.random() * 20)}, 0.4)`;
      ctx.fillRect(sx, sy, sw, sh);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createFloorTexture(dark) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    const col1 = dark ? '#1a1a1a' : '#2a2a2a';
    const col2 = dark ? '#111111' : '#1e1e1e';
    const tileSize = 16;

    for (let y = 0; y < size / tileSize; y++) {
      for (let x = 0; x < size / tileSize; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? col1 : col2;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createPigFloorTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Brown/muddy checkered pattern
    const col1 = '#5a3a20';
    const col2 = '#4a2a15';
    const tileSize = 16;

    for (let y = 0; y < size / tileSize; y++) {
      for (let x = 0; x < size / tileSize; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? col1 : col2;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createPigCeilingTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Lighter pink
    const col1 = '#FFD0D8';
    const col2 = '#FFC0CC';
    const tileSize = 16;

    for (let y = 0; y < size / tileSize; y++) {
      for (let x = 0; x < size / tileSize; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? col1 : col2;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createMudTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Darker brown muddy texture
    ctx.fillStyle = '#3a2510';
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const noise = Math.random() * 25 - 12;
        const r = Math.min(255, Math.max(0, 58 + noise));
        const g = Math.min(255, Math.max(0, 37 + noise * 0.7));
        const b = Math.min(255, Math.max(0, 16 + noise * 0.4));
        ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Some lighter mud patches
    for (let i = 0; i < 5; i++) {
      const sx = Math.floor(Math.random() * (size - 10));
      const sy = Math.floor(Math.random() * (size - 10));
      ctx.fillStyle = 'rgba(90, 60, 30, 0.3)';
      ctx.beginPath();
      ctx.arc(sx + 5, sy + 5, 4 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createCreeperTexture() {
    const size = 64; // 64x64 but draw an 8x8 pixel pattern
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const px = size / 8;

    // Creeper face pattern (8x8)
    // 0 = green, 1 = dark green (eyes/mouth)
    const pattern = [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
    ];

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = pattern[y][x] === 1 ? '#1a3a1a' : '#4CAF50';
        ctx.fillRect(x * px, y * px, px, px);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createPigTexture() {
    const size = 64; // 64x64, draw 8x8 pixel pattern
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const px = size / 8;

    // Pig face pattern (8x8)
    // 0 = pink skin (#FFB6C1), 1 = dark pink features (#FF69B4), 2 = black (eyes), 3 = ear color (darker pink)
    const pattern = [
      [0, 3, 0, 0, 0, 0, 3, 0],  // ears at top corners
      [0, 3, 0, 0, 0, 0, 3, 0],  // ears
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0, 2, 0, 0],  // eyes
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],  // snout center
      [0, 0, 1, 1, 1, 1, 0, 0],  // snout wider
      [0, 0, 0, 0, 0, 0, 0, 0],
    ];

    const colors = {
      0: '#FFB6C1',  // pink skin
      1: '#FF69B4',  // hot pink snout
      2: '#000000',  // black eyes
      3: '#E8829B',  // darker pink ears
    };

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = colors[pattern[y][x]];
        ctx.fillRect(x * px, y * px, px, px);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createCreeperHitTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // All white flash
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createPigHitTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Yellow flash for pigs
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  // ---- TEXTURES (created lazily) ----
  let wallTexture = null;
  let floorTexture = null;
  let ceilingTexture = null;
  let creeperTexture = null;
  let creeperHitTex = null;
  let pigWallTexture = null;
  let pigFloorTexture = null;
  let pigCeilingTexture = null;
  let pigTexture = null;
  let pigHitTex = null;
  let mudTexture = null;

  function getTextures() {
    if (!wallTexture) wallTexture = createWallTexture();
    if (!floorTexture) floorTexture = createFloorTexture(false);
    if (!ceilingTexture) ceilingTexture = createFloorTexture(true);
    if (!creeperTexture) creeperTexture = createCreeperTexture();
    if (!creeperHitTex) creeperHitTex = createCreeperHitTexture();
  }

  function getPigTextures() {
    if (!pigWallTexture) pigWallTexture = createPigWallTexture();
    if (!pigFloorTexture) pigFloorTexture = createPigFloorTexture();
    if (!pigCeilingTexture) pigCeilingTexture = createPigCeilingTexture();
    if (!pigTexture) pigTexture = createPigTexture();
    if (!pigHitTex) pigHitTex = createPigHitTexture();
    if (!mudTexture) mudTexture = createMudTexture();
  }

  // ---- SCENE SETUP ----

  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0505);
    scene.fog = new THREE.Fog(0x1a0505, 2, 14);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(1.5, 0.6, 1.5);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    setupLighting('doom');
  }

  function setupLighting(level) {
    // Remove old lights
    for (const light of sceneLights) {
      scene.remove(light);
    }
    sceneLights = [];

    if (level === 'doom') {
      // Doom lighting
      const ambient = new THREE.AmbientLight(0x330000, 0.4);
      scene.add(ambient);
      sceneLights.push(ambient);

      const lightPositions = [
        [4, 2, 4], [12, 2, 4], [8, 2, 8], [4, 2, 12], [12, 2, 12]
      ];
      lightPositions.forEach(function(pos) {
        const pl = new THREE.PointLight(0xff4400, 1.2, 8);
        pl.position.set(pos[0], pos[1], pos[2]);
        scene.add(pl);
        sceneLights.push(pl);
      });

      scene.background = new THREE.Color(0x1a0505);
      scene.fog = new THREE.Fog(0x1a0505, 2, 14);
    } else {
      // Pig level lighting: pink/warm tones
      const ambient = new THREE.AmbientLight(0x663344, 0.5);
      scene.add(ambient);
      sceneLights.push(ambient);

      const lightPositions = [
        [4, 2, 4], [12, 2, 4], [8, 2, 8], [4, 2, 12], [12, 2, 12]
      ];
      lightPositions.forEach(function(pos) {
        const pl = new THREE.PointLight(0xff88aa, 1.0, 8);
        pl.position.set(pos[0], pos[1], pos[2]);
        scene.add(pl);
        sceneLights.push(pl);
      });

      scene.background = new THREE.Color(0x2a0a1a);
      scene.fog = new THREE.Fog(0x2a0a1a, 2, 14);
    }

    // Player light (always present)
    const playerLight = new THREE.PointLight(
      level === 'pig' ? 0xffaacc : 0x664422,
      0.6, 6
    );
    playerLight.position.copy(camera.position);
    scene.add(playerLight);
    sceneLights.push(playerLight);
    scene.userData.playerLight = playerLight;
  }

  function clearLevelGeometry() {
    // Remove wall meshes
    for (const mesh of wallMeshes) {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
      }
    }
    wallMeshes = [];

    // Remove floor
    if (floorMesh) {
      scene.remove(floorMesh);
      if (floorMesh.geometry) floorMesh.geometry.dispose();
      if (floorMesh.material) floorMesh.material.dispose();
      floorMesh = null;
    }

    // Remove ceiling
    if (ceilingMesh) {
      scene.remove(ceilingMesh);
      if (ceilingMesh.geometry) ceilingMesh.geometry.dispose();
      if (ceilingMesh.material) ceilingMesh.material.dispose();
      ceilingMesh = null;
    }

    // Remove mud meshes
    for (const mesh of mudMeshes) {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }
    mudMeshes = [];

  }

  function clearCreepers() {
    for (var id in creeperMeshes) {
      scene.remove(creeperMeshes[id].sprite);
      if (creeperMeshes[id].sprite.material.map) creeperMeshes[id].sprite.material.map.dispose();
      creeperMeshes[id].sprite.material.dispose();
    }
    creeperMeshes = {};

    for (var i = 0; i < creeperDeathAnims.length; i++) {
      var anim = creeperDeathAnims[i];
      scene.remove(anim.sprite);
      if (anim.sprite.material.map) anim.sprite.material.map.dispose();
      anim.sprite.material.dispose();
    }
    creeperDeathAnims = [];
  }

  function buildLevel() {
    var level = gameState ? gameState.level : 'doom';
    currentLevel = level;

    clearLevelGeometry();

    if (level === 'pig') {
      buildPigLevel();
    } else {
      buildDoomLevel();
    }
  }

  function buildDoomLevel() {
    getTextures();
    var wallHeight = 2;
    var cellSize = 1;

    var wallGeo = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
    var wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (var z = 0; z < DOOM_MAP.length; z++) {
      for (var x = 0; x < DOOM_MAP[z].length; x++) {
        if (DOOM_MAP[z][x] === 1 || DOOM_MAP[z][x] === 3) {
          var mesh = new THREE.Mesh(wallGeo, wallMat);
          mesh.position.set(x + 0.5, wallHeight / 2, z + 0.5);
          scene.add(mesh);
          wallMeshes.push(mesh);
        }
      }
    }

    // Floor
    var mapW = DOOM_MAP[0].length;
    var mapH = DOOM_MAP.length;
    var floorGeo = new THREE.PlaneGeometry(mapW, mapH);
    var floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 1.0,
    });
    floorTexture.repeat.set(mapW, mapH);
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(mapW / 2, 0, mapH / 2);
    scene.add(floorMesh);

    // Ceiling
    var ceilGeo = new THREE.PlaneGeometry(mapW, mapH);
    var ceilMat = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      roughness: 1.0,
    });
    ceilingTexture.repeat.set(mapW, mapH);
    ceilingMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(mapW / 2, 2, mapH / 2);
    scene.add(ceilingMesh);

    // No visual hints for secret wall - player discovers by exploring
  }

  function buildPigLevel() {
    getPigTextures();
    var wallHeight = 2;
    var cellSize = 1;

    var wallGeo = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
    var wallMat = new THREE.MeshStandardMaterial({
      map: pigWallTexture,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (var z = 0; z < PIG_MAP.length; z++) {
      for (var x = 0; x < PIG_MAP[z].length; x++) {
        if (PIG_MAP[z][x] === 1) {
          var mesh = new THREE.Mesh(wallGeo, wallMat);
          mesh.position.set(x + 0.5, wallHeight / 2, z + 0.5);
          scene.add(mesh);
          wallMeshes.push(mesh);
        } else if (PIG_MAP[z][x] === 4) {
          // Mud cell: flat plane at floor level with mud texture
          var mudGeo = new THREE.PlaneGeometry(cellSize, cellSize);
          var mudMat = new THREE.MeshStandardMaterial({
            map: mudTexture,
            roughness: 1.0,
          });
          var mudMesh = new THREE.Mesh(mudGeo, mudMat);
          mudMesh.rotation.x = -Math.PI / 2;
          mudMesh.position.set(x + 0.5, 0.01, z + 0.5); // Slightly above floor
          scene.add(mudMesh);
          mudMeshes.push(mudMesh);
        }
      }
    }

    // Floor
    var mapW = PIG_MAP[0].length;
    var mapH = PIG_MAP.length;
    var floorGeo = new THREE.PlaneGeometry(mapW, mapH);
    var floorMat = new THREE.MeshStandardMaterial({
      map: pigFloorTexture,
      roughness: 1.0,
    });
    pigFloorTexture.repeat.set(mapW, mapH);
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(mapW / 2, 0, mapH / 2);
    scene.add(floorMesh);

    // Ceiling
    var ceilGeo = new THREE.PlaneGeometry(mapW, mapH);
    var ceilMat = new THREE.MeshStandardMaterial({
      map: pigCeilingTexture,
      roughness: 1.0,
    });
    pigCeilingTexture.repeat.set(mapW, mapH);
    ceilingMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(mapW / 2, 2, mapH / 2);
    scene.add(ceilingMesh);
  }


  // ---- WEAPON (3D overlay) ----

  function createWeapon() {
    // Remove existing weapon from camera
    if (weaponMesh) {
      camera.remove(weaponMesh);
    }
    if (muzzleFlashMesh) {
      camera.remove(muzzleFlashMesh);
    }

    var isPig = currentLevel === 'pig';
    var group = new THREE.Group();

    // Barrel
    var barrelGeo = new THREE.BoxGeometry(0.06, 0.06, 0.5);
    var barrelColor = isPig ? 0xFF69B4 : 0x444444;
    var barrelMat = new THREE.MeshStandardMaterial({ color: barrelColor, metalness: 0.8, roughness: 0.3 });
    var barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0, -0.2);
    group.add(barrel);

    // Second barrel
    var barrel2 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel2.position.set(0.07, 0, -0.2);
    group.add(barrel2);

    if (isPig) {
      // Pig nose on barrel tip
      var noseGeo = new THREE.SphereGeometry(0.04, 8, 8);
      var noseMat = new THREE.MeshStandardMaterial({ color: 0xFF1493, roughness: 0.5 });
      var nose = new THREE.Mesh(noseGeo, noseMat);
      nose.position.set(0.035, 0, -0.47);
      group.add(nose);
    }

    // Stock/grip
    var stockGeo = new THREE.BoxGeometry(0.08, 0.15, 0.2);
    var stockColor = isPig ? 0xFFB6C1 : 0x5a3a1a;
    var stockMat = new THREE.MeshStandardMaterial({ color: stockColor, roughness: 0.8 });
    var stock = new THREE.Mesh(stockGeo, stockMat);
    stock.position.set(0.03, -0.08, 0.05);
    group.add(stock);

    // Handle
    var handleGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);
    var handle = new THREE.Mesh(handleGeo, stockMat);
    handle.position.set(0.03, -0.15, 0.02);
    handle.rotation.x = 0.3;
    group.add(handle);

    // Position relative to camera
    group.position.set(0.3, -0.3, -0.5);

    weaponMesh = group;
    camera.add(group);

    // Make sure camera is in the scene
    if (!camera.parent) {
      scene.add(camera);
    }

    // Muzzle flash
    var flashGeo = new THREE.PlaneGeometry(0.15, 0.15);
    var flashMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlashMesh.position.set(0.03, 0.02, -0.5);
    camera.add(muzzleFlashMesh);
  }

  // ---- CREEPER/PIG SPRITES ----

  function createCreeperSprite(creeper) {
    getTextures();
    getPigTextures();

    var isPig = creeper.type === 'pig';
    var tex = isPig ? pigTexture : creeperTexture;
    var spriteMat = new THREE.SpriteMaterial({ map: tex });
    var sprite = new THREE.Sprite(spriteMat);

    if (isPig) {
      sprite.scale.set(0.9, 1.2, 0.9); // Slightly smaller than creepers
    } else {
      sprite.scale.set(1, 1.5, 1);
    }

    sprite.position.set(creeper.x, isPig ? 0.6 : 0.75, creeper.z);
    scene.add(sprite);
    creeperMeshes[creeper.id] = {
      sprite: sprite,
      hitTimer: 0,
      normalMat: spriteMat,
      type: creeper.type,
    };
  }

  function syncCreepers() {
    if (!gameState) return;

    // Add new creepers
    for (var i = 0; i < gameState.creepers.length; i++) {
      var creeper = gameState.creepers[i];
      if (!creeperMeshes[creeper.id]) {
        createCreeperSprite(creeper);
      }
    }

    // Update positions and remove dead
    var aliveIds = new Set(gameState.creepers.map(function(c) { return c.id; }));
    for (var id in creeperMeshes) {
      if (!aliveIds.has(Number(id))) {
        // Start death animation
        var cm = creeperMeshes[id];
        creeperDeathAnims.push({
          sprite: cm.sprite,
          timer: 0,
          duration: 0.5,
        });
        delete creeperMeshes[id];
      }
    }

    // Sync alive creeper positions
    for (var j = 0; j < gameState.creepers.length; j++) {
      var c = gameState.creepers[j];
      var cmesh = creeperMeshes[c.id];
      if (cmesh) {
        var yPos = cmesh.type === 'pig' ? 0.6 : 0.75;
        cmesh.sprite.position.set(c.x, yPos, c.z);

        // Handle hit flash
        if (cmesh.hitTimer > 0) {
          cmesh.hitTimer -= 0.016;
          if (cmesh.hitTimer <= 0) {
            cmesh.sprite.material = cmesh.normalMat;
          }
        }
      }
    }
  }

  function updateDeathAnims(dt) {
    for (var i = creeperDeathAnims.length - 1; i >= 0; i--) {
      var anim = creeperDeathAnims[i];
      anim.timer += dt;
      var progress = anim.timer / anim.duration;

      if (progress >= 1) {
        scene.remove(anim.sprite);
        if (anim.sprite.material.map) anim.sprite.material.map.dispose();
        anim.sprite.material.dispose();
        creeperDeathAnims.splice(i, 1);
      } else {
        // Scale down and fade
        var scale = 1 - progress;
        anim.sprite.scale.set(scale, scale * 1.5, scale);
        anim.sprite.material.opacity = 1 - progress;
        anim.sprite.material.transparent = true;
      }
    }
  }

  // ---- HUD ----

  function getHUDColors() {
    var isPig = gameState && gameState.level === 'pig';
    return {
      primary: isPig ? '#FF69B4' : '#00FF00',
      background: isPig ? 'rgba(42, 10, 26, 0.6)' : 'rgba(0, 0, 0, 0.6)',
      backgroundSolid: isPig ? 'rgba(42, 10, 26, 0.5)' : 'rgba(0, 0, 0, 0.5)',
      border: isPig ? '#FF69B4' : '#00FF00',
      barBg: isPig ? '#2a0a1a' : '#1a1a1a',
      crosshairShadow: isPig ? 'rgba(255, 105, 180, 0.5)' : 'rgba(0, 255, 0, 0.5)',
    };
  }

  function createHUD() {
    hudElement = document.getElementById('doom-hud-game');
    if (!hudElement) {
      hudElement = document.createElement('div');
      hudElement.id = 'doom-hud-game';
      doomContainer.appendChild(hudElement);
    }

    hudElement.innerHTML = '';

    var colors = getHUDColors();

    hudElement.style.cssText = '\
      position: absolute;\
      top: 0; left: 0; right: 0; bottom: 0;\
      pointer-events: none;\
      font-family: "Press Start 2P", monospace;\
      color: ' + colors.primary + ';\
      z-index: 100;\
    ';

    // Crosshair
    var crosshair = document.createElement('div');
    crosshair.id = 'doom-crosshair';
    crosshair.style.cssText = '\
      position: absolute;\
      top: 50%; left: 50%;\
      transform: translate(-50%, -50%);\
      font-size: 24px;\
      color: ' + colors.primary + ';\
      text-shadow: 0 0 4px ' + colors.crosshairShadow + ';\
      user-select: none;\
    ';
    crosshair.textContent = '+';
    hudElement.appendChild(crosshair);

    // Score (center top)
    var score = document.createElement('div');
    score.id = 'doom-score';
    score.style.cssText = '\
      position: absolute;\
      top: 15px; left: 50%;\
      transform: translateX(-50%);\
      font-size: 14px;\
      text-shadow: 2px 2px 0 #000;\
      background: ' + colors.backgroundSolid + ';\
      padding: 4px 12px;\
    ';
    score.textContent = 'SCORE: 0';
    hudElement.appendChild(score);

    // Health (left side)
    var health = document.createElement('div');
    health.id = 'doom-health';
    health.style.cssText = '\
      position: absolute;\
      bottom: 15px; left: 15px;\
      font-size: 12px;\
      text-shadow: 2px 2px 0 #000;\
      background: ' + colors.background + ';\
      padding: 8px 12px;\
      border: 1px solid ' + colors.border + ';\
    ';
    health.innerHTML = '<span style="color:#ff4444">HP</span> 100';
    hudElement.appendChild(health);

    // Health bar
    var healthBar = document.createElement('div');
    healthBar.id = 'doom-health-bar';
    healthBar.style.cssText = '\
      position: absolute;\
      bottom: 55px; left: 15px;\
      width: 150px; height: 8px;\
      background: ' + colors.barBg + ';\
      border: 1px solid ' + colors.border + ';\
    ';
    var healthFill = document.createElement('div');
    healthFill.id = 'doom-health-fill';
    healthFill.style.cssText = '\
      width: 100%; height: 100%;\
      background: ' + colors.primary + ';\
      transition: width 0.2s;\
    ';
    healthBar.appendChild(healthFill);
    hudElement.appendChild(healthBar);

    // Ammo (right side)
    var ammo = document.createElement('div');
    ammo.id = 'doom-ammo';
    ammo.style.cssText = '\
      position: absolute;\
      bottom: 15px; right: 15px;\
      font-size: 12px;\
      text-shadow: 2px 2px 0 #000;\
      background: ' + colors.background + ';\
      padding: 8px 12px;\
      border: 1px solid ' + colors.border + ';\
    ';
    ammo.innerHTML = 'AMMO <span style="color:#ffaa00">50</span>';
    hudElement.appendChild(ammo);

    // Face container (center bottom)
    var faceContainer = document.createElement('div');
    faceContainer.id = 'doom-face-container';
    faceContainer.style.cssText = '\
      position: absolute;\
      bottom: 10px; left: 50%;\
      transform: translateX(-50%);\
      background: rgba(0,0,0,0.7);\
      border: 2px solid ' + colors.border + ';\
      padding: 4px;\
    ';
    var faceCanvas = document.createElement('canvas');
    faceCanvas.id = 'doom-face';
    faceCanvas.width = 48;
    faceCanvas.height = 48;
    faceCanvas.style.cssText = 'image-rendering: pixelated; width: 48px; height: 48px;';
    faceContainer.appendChild(faceCanvas);
    hudElement.appendChild(faceContainer);

    // Hurt flash overlay
    var hurtOverlay = document.createElement('div');
    hurtOverlay.id = 'doom-hurt-flash';
    hurtOverlay.style.cssText = '\
      position: absolute;\
      top: 0; left: 0; right: 0; bottom: 0;\
      background: rgba(255, 0, 0, 0);\
      pointer-events: none;\
      transition: background 0.1s;\
    ';
    hudElement.appendChild(hurtOverlay);

    // Game over screen (hidden initially)
    var gameOverScreen = document.createElement('div');
    gameOverScreen.id = 'doom-gameover';
    gameOverScreen.style.cssText = '\
      position: absolute;\
      top: 0; left: 0; right: 0; bottom: 0;\
      background: rgba(0, 0, 0, 0.85);\
      display: none;\
      flex-direction: column;\
      align-items: center;\
      justify-content: center;\
      z-index: 200;\
    ';
    gameOverScreen.innerHTML = '\
      <div style="font-size: 32px; color: #ff0000; text-shadow: 0 0 10px #ff0000; margin-bottom: 30px;">GAME OVER</div>\
      <div id="doom-final-score" style="font-size: 16px; color: ' + colors.primary + '; margin-bottom: 20px;">SCORE: 0</div>\
      <div style="font-size: 10px; color: #aaa; margin-bottom: 10px;">Press ENTER to restart</div>\
      <div style="font-size: 10px; color: #666;">Press ESC to exit</div>\
    ';
    hudElement.appendChild(gameOverScreen);

    // Secret wall message overlay (hidden)
    var secretMsg = document.createElement('div');
    secretMsg.id = 'doom-secret-msg';
    secretMsg.style.cssText = '\
      position: absolute;\
      top: 30%; left: 50%;\
      transform: translate(-50%, -50%);\
      font-size: 18px;\
      color: #ff0000;\
      text-shadow: 0 0 10px #ff0000, 0 0 20px #880000;\
      text-align: center;\
      opacity: 0;\
      pointer-events: none;\
      z-index: 250;\
      white-space: nowrap;\
    ';
    secretMsg.textContent = 'Something has changed...';
    hudElement.appendChild(secretMsg);

    // Level transition overlay (hidden)
    var transitionOverlay = document.createElement('div');
    transitionOverlay.id = 'doom-transition';
    transitionOverlay.style.cssText = '\
      position: absolute;\
      top: 0; left: 0; right: 0; bottom: 0;\
      background: rgba(0, 0, 0, 0.95);\
      display: none;\
      flex-direction: column;\
      align-items: center;\
      justify-content: center;\
      z-index: 300;\
    ';
    transitionOverlay.innerHTML = '\
      <div style="font-size: 24px; color: #FF69B4; text-shadow: 0 0 15px #FF69B4, 0 0 30px #FF1493; animation: pigPulse 0.5s ease-in-out infinite alternate;">ENTERING THE PIG DIMENSION...</div>\
    ';
    hudElement.appendChild(transitionOverlay);

    // Add CSS animation for transition
    var style = document.getElementById('doom-pig-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'doom-pig-styles';
      style.textContent = '\
        @keyframes pigPulse {\
          from { opacity: 0.7; transform: scale(0.98); }\
          to { opacity: 1; transform: scale(1.02); }\
        }\
        @keyframes secretFlicker {\
          0% { opacity: 1; }\
          10% { opacity: 0.3; }\
          20% { opacity: 0.9; }\
          30% { opacity: 0.5; }\
          40% { opacity: 1; }\
          50% { opacity: 0.4; }\
          60% { opacity: 0.8; }\
          70% { opacity: 0.2; }\
          80% { opacity: 0.9; }\
          90% { opacity: 0.6; }\
          100% { opacity: 1; }\
        }\
      ';
      document.head.appendChild(style);
    }

    drawFace(faceState, 1.0);
  }

  function drawFace(expression, healthPercent) {
    var faceCanvas = document.getElementById('doom-face');
    if (!faceCanvas) return;
    var ctx = faceCanvas.getContext('2d');
    var px = 6; // 8x8 grid in 48x48 canvas

    var isPig = gameState && gameState.level === 'pig';

    if (isPig) {
      drawPigFace(ctx, px, expression, healthPercent);
    } else {
      drawDoomFace(ctx, px, expression, healthPercent);
    }
  }

  function drawDoomFace(ctx, px, expression, healthPercent) {
    // Clear
    ctx.fillStyle = '#c8a878';
    ctx.fillRect(0, 0, 48, 48);

    // Skin tone gets redder as health drops
    var bloodLevel = 1 - healthPercent;
    var skinR = Math.floor(200 - bloodLevel * 60);
    var skinG = Math.floor(168 - bloodLevel * 100);
    var skinB = Math.floor(120 - bloodLevel * 80);
    ctx.fillStyle = 'rgb(' + skinR + ', ' + skinG + ', ' + skinB + ')';
    ctx.fillRect(0, 0, 48, 48);

    // Eyes (always present)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1 * px, 2 * px, 2 * px, 2 * px);
    ctx.fillRect(5 * px, 2 * px, 2 * px, 2 * px);

    // Pupils
    ctx.fillStyle = '#000000';
    if (expression === 'neutral') {
      ctx.fillRect(2 * px, 3 * px, px, px);
      ctx.fillRect(6 * px, 3 * px, px, px);
    } else if (expression === 'grimace') {
      ctx.fillRect(1 * px, 3 * px, px, px);
      ctx.fillRect(5 * px, 3 * px, px, px);
    } else if (expression === 'grin') {
      ctx.fillRect(2 * px, 2 * px, px, px);
      ctx.fillRect(6 * px, 2 * px, px, px);
    }

    // Mouth
    if (expression === 'neutral') {
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(2 * px, 6 * px, 4 * px, px);
    } else if (expression === 'grimace') {
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(2 * px, 5 * px, 4 * px, 2 * px);
      // Teeth
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3 * px, 5 * px, px, px);
      ctx.fillRect(5 * px, 5 * px, px, px);
    } else if (expression === 'grin') {
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(2 * px, 6 * px, 4 * px, px);
      // Smile curve
      ctx.fillRect(1 * px, 5 * px, px, px);
      ctx.fillRect(6 * px, 5 * px, px, px);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3 * px, 6 * px, 2 * px, px);
    }

    // Blood splatters at low health
    if (healthPercent < 0.5) {
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(0, 0, px, px);
      ctx.fillRect(7 * px, px, px, px);
    }
    if (healthPercent < 0.25) {
      ctx.fillStyle = '#990000';
      ctx.fillRect(0, px, px, px);
      ctx.fillRect(px, 0, px, px);
      ctx.fillRect(6 * px, 0, 2 * px, px);
      ctx.fillRect(7 * px, 2 * px, px, px);
    }
  }

  function drawPigFace(ctx, px, expression, healthPercent) {
    // Pink background
    var pinkLevel = 1 - (1 - healthPercent) * 0.3;
    var bgR = Math.floor(255 * pinkLevel);
    var bgG = Math.floor(182 * pinkLevel);
    var bgB = Math.floor(193 * pinkLevel);
    ctx.fillStyle = 'rgb(' + bgR + ', ' + bgG + ', ' + bgB + ')';
    ctx.fillRect(0, 0, 48, 48);

    // Pig ears (top)
    ctx.fillStyle = '#E8829B';
    // Left ear (triangle-ish)
    ctx.fillRect(0, 0, 2 * px, px);
    ctx.fillRect(0, px, px, px);
    // Right ear
    ctx.fillRect(6 * px, 0, 2 * px, px);
    ctx.fillRect(7 * px, px, px, px);

    // Eyes
    ctx.fillStyle = '#000000';
    if (expression === 'neutral') {
      ctx.fillRect(2 * px, 2 * px, px, px);
      ctx.fillRect(5 * px, 2 * px, px, px);
    } else if (expression === 'grimace') {
      // Squinting eyes
      ctx.fillRect(1 * px, 3 * px, 2 * px, px);
      ctx.fillRect(5 * px, 3 * px, 2 * px, px);
    } else if (expression === 'grin') {
      // Happy eyes
      ctx.fillRect(2 * px, 2 * px, px, px);
      ctx.fillRect(5 * px, 2 * px, px, px);
      // Eye sparkle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2 * px, 2 * px, Math.floor(px * 0.4), Math.floor(px * 0.4));
      ctx.fillRect(5 * px, 2 * px, Math.floor(px * 0.4), Math.floor(px * 0.4));
    }

    // Pig snout (center, big)
    ctx.fillStyle = '#FF69B4';
    ctx.fillRect(2 * px, 4 * px, 4 * px, 2 * px);
    // Nostrils
    ctx.fillStyle = '#CC3377';
    ctx.fillRect(3 * px, 5 * px, px, px);
    ctx.fillRect(4 * px, 5 * px, px, px);

    // Mouth
    if (expression === 'grimace') {
      ctx.fillStyle = '#CC3377';
      ctx.fillRect(3 * px, 7 * px, 2 * px, px);
    } else {
      ctx.fillStyle = '#CC3377';
      ctx.fillRect(3 * px, 7 * px, 2 * px, px);
      // Slight smile
      ctx.fillRect(2 * px, 7 * px, px, Math.floor(px * 0.5));
      ctx.fillRect(5 * px, 7 * px, px, Math.floor(px * 0.5));
    }

    // Damage marks
    if (healthPercent < 0.5) {
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(0, 2 * px, px, px);
      ctx.fillRect(7 * px, 3 * px, px, px);
    }
  }

  function updateHUD() {
    if (!gameState || !hudElement) return;

    var p = gameState.player;
    var healthPercent = p.health / PLAYER_MAX_HEALTH;
    var isPig = gameState.level === 'pig';
    var colors = getHUDColors();

    // Score
    var scoreEl = document.getElementById('doom-score');
    if (scoreEl) scoreEl.textContent = 'SCORE: ' + p.score;

    // Health
    var healthEl = document.getElementById('doom-health');
    if (healthEl) {
      var healthColor = healthPercent > 0.5 ? colors.primary : healthPercent > 0.25 ? '#ffaa00' : '#ff0000';
      healthEl.innerHTML = '<span style="color:' + healthColor + '">HP</span> ' + Math.ceil(p.health);
    }

    // Health bar
    var healthFill = document.getElementById('doom-health-fill');
    if (healthFill) {
      healthFill.style.width = (healthPercent * 100) + '%';
      healthFill.style.background = healthPercent > 0.5 ? colors.primary : healthPercent > 0.25 ? '#ffaa00' : '#ff0000';
    }

    // Ammo
    var ammoEl = document.getElementById('doom-ammo');
    if (ammoEl) {
      var ammoColor = p.ammo > 10 ? '#ffaa00' : '#ff0000';
      ammoEl.innerHTML = 'AMMO <span style="color:' + ammoColor + '">' + p.ammo + '</span>';
    }

    // Hurt detection
    if (p.health < lastPlayerHealth) {
      hurtFlashTimer = 0.2;
      faceState = 'grimace';
      faceStateTimer = 0.5;
      playHurtSound();
    }
    lastPlayerHealth = p.health;

    // Hurt flash
    var hurtFlash = document.getElementById('doom-hurt-flash');
    if (hurtFlash) {
      if (hurtFlashTimer > 0) {
        hurtFlash.style.background = 'rgba(255, 0, 0, ' + (hurtFlashTimer * 1.5) + ')';
      } else {
        hurtFlash.style.background = 'rgba(255, 0, 0, 0)';
      }
    }

    // Face state timeout
    if (faceStateTimer > 0) {
      faceStateTimer -= 0.016;
      if (faceStateTimer <= 0) {
        faceState = 'neutral';
      }
    }

    drawFace(faceState, healthPercent);

    // Secret wall message
    var secretMsgEl = document.getElementById('doom-secret-msg');
    if (secretMsgEl) {
      if (secretWallMessageTimer > 0) {
        secretMsgEl.style.opacity = '1';
        secretMsgEl.style.animation = 'secretFlicker 0.3s infinite';
      } else {
        secretMsgEl.style.opacity = '0';
        secretMsgEl.style.animation = 'none';
      }
    }

    // Game over
    if (gameState.gameOver && !gameOverShown) {
      gameOverShown = true;
      var goScreen = document.getElementById('doom-gameover');
      if (goScreen) {
        goScreen.style.display = 'flex';
        var finalScore = document.getElementById('doom-final-score');
        if (finalScore) finalScore.textContent = 'SCORE: ' + p.score;
      }
      // Release pointer lock
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }

  // ---- AUDIO ----

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    setupAmbientSound(gameState ? gameState.level : 'doom');
  }

  function setupAmbientSound(level) {
    if (!audioCtx) return;

    // Stop existing ambient sounds
    if (ambientOsc) { try { ambientOsc.stop(); } catch (e) {} ambientOsc = null; }
    if (ambientGain) { ambientGain.disconnect(); ambientGain = null; }
    if (ambientOsc2) { try { ambientOsc2.stop(); } catch (e) {} ambientOsc2 = null; }
    if (ambientGain2) { ambientGain2.disconnect(); ambientGain2 = null; }

    if (level === 'pig') {
      // Farmyard ambient: lower tone
      ambientOsc = audioCtx.createOscillator();
      ambientOsc.type = 'sine';
      ambientOsc.frequency.value = 35; // Lower tone
      ambientGain = audioCtx.createGain();
      ambientGain.gain.value = 0.04;
      ambientOsc.connect(ambientGain);
      ambientGain.connect(audioCtx.destination);
      ambientOsc.start();

      // Second detuned oscillator
      ambientOsc2 = audioCtx.createOscillator();
      ambientOsc2.type = 'sine';
      ambientOsc2.frequency.value = 35.8;
      ambientGain2 = audioCtx.createGain();
      ambientGain2.gain.value = 0.03;
      ambientOsc2.connect(ambientGain2);
      ambientGain2.connect(audioCtx.destination);
      ambientOsc2.start();
    } else {
      // Doom ambient hum
      ambientOsc = audioCtx.createOscillator();
      ambientOsc.type = 'sine';
      ambientOsc.frequency.value = 55;
      ambientGain = audioCtx.createGain();
      ambientGain.gain.value = 0.04;
      ambientOsc.connect(ambientGain);
      ambientGain.connect(audioCtx.destination);
      ambientOsc.start();

      // Second detuned oscillator for eerie feel
      ambientOsc2 = audioCtx.createOscillator();
      ambientOsc2.type = 'sine';
      ambientOsc2.frequency.value = 55.5;
      ambientGain2 = audioCtx.createGain();
      ambientGain2.gain.value = 0.03;
      ambientOsc2.connect(ambientGain2);
      ambientGain2.connect(audioCtx.destination);
      ambientOsc2.start();
    }
  }

  function playGunshotSound() {
    if (!audioCtx) return;
    var now = audioCtx.currentTime;

    // White noise burst
    var bufferSize = audioCtx.sampleRate * 0.1;
    var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    var noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    noise.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.15);

    // Low frequency punch
    var punch = audioCtx.createOscillator();
    punch.type = 'sine';
    punch.frequency.setValueAtTime(150, now);
    punch.frequency.exponentialRampToValueAtTime(30, now + 0.1);
    var punchGain = audioCtx.createGain();
    punchGain.gain.setValueAtTime(0.4, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    punch.connect(punchGain);
    punchGain.connect(audioCtx.destination);
    punch.start(now);
    punch.stop(now + 0.2);
  }

  function playCreeperDeathSound() {
    if (!audioCtx) return;
    var now = audioCtx.currentTime;

    var osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  function playPigDeathSound() {
    if (!audioCtx) return;
    var now = audioCtx.currentTime;

    // Oink sound: ascending then descending tone (square wave, playful)
    // 200Hz -> 400Hz -> 200Hz over 150ms
    var osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(400, now + 0.075);
    osc.frequency.linearRampToValueAtTime(200, now + 0.15);

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.setValueAtTime(0.15, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function playHurtSound() {
    if (!audioCtx) return;
    var now = audioCtx.currentTime;

    var bufferSize = audioCtx.sampleRate * 0.08;
    var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    noise.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  function stopAudio() {
    if (!audioCtx) return;
    try {
      if (ambientOsc) { ambientOsc.stop(); ambientOsc = null; }
      if (ambientGain) { ambientGain.disconnect(); ambientGain = null; }
      if (ambientOsc2) { ambientOsc2.stop(); ambientOsc2 = null; }
      if (ambientGain2) { ambientGain2.disconnect(); ambientGain2 = null; }
      audioCtx.close();
    } catch (e) { /* ignore */ }
    audioCtx = null;
  }

  // ---- CHEAT CODE DETECTION ----

  function setupCheatDetector() {
    cheatDetector = createCheatDetector([
      {
        name: 'idclip',
        sequence: 'idclip',
        onActivate: function() {
          onIdclipActivated();
        }
      }
    ]);
  }

  function onIdclipActivated() {
    if (!gameState || gameState.level !== 'doom') return;

    // Activate secret wall in game state
    activateSecretWall(gameState);

    // Show cryptic message briefly
    secretWallMessageTimer = 3.0;
  }

  // ---- LEVEL TRANSITION ----

  function startPigLevelTransition() {
    levelTransitionActive = true;
    levelTransitionTimer = 2.0;

    // Show transition screen
    var transitionEl = document.getElementById('doom-transition');
    if (transitionEl) {
      transitionEl.style.display = 'flex';
    }

    // Call game logic to switch state
    switchToPigLevel(gameState);

    // Schedule the actual level rebuild
    setTimeout(function() {
      // Rebuild level geometry
      clearCreepers();
      clearLevelGeometry();
      currentLevel = 'pig';
      setupLighting('pig');
      buildLevel();

      // Recreate weapon with pig theme
      createWeapon();

      // Rebuild HUD with pig theme
      createHUD();

      // Switch ambient audio
      setupAmbientSound('pig');

      // Sync player position
      lastPlayerHealth = gameState.player.health;

      // Hide transition
      levelTransitionActive = false;
      var transitionEl = document.getElementById('doom-transition');
      if (transitionEl) {
        transitionEl.style.display = 'none';
      }

      // Re-lock pointer
      if (canvas && !document.pointerLockElement) {
        canvas.requestPointerLock();
      }
    }, 2000);
  }

  // ---- INPUT HANDLING ----

  function onKeyDown(e) {
    keys[e.code] = true;

    // Feed key to cheat detector
    if (cheatDetector && gameState && !gameState.gameOver) {
      cheatDetector.handleKey(e.key);
    }

    // Enter to restart when game over
    if (e.code === 'Enter' && gameState && gameState.gameOver) {
      e.preventDefault();
      restartGame();
    }

    // ESC to exit
    if (e.code === 'Escape') {
      e.preventDefault();
      exitGame();
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  function onMouseMove(e) {
    if (!pointerLocked) return;
    mouseDeltaX += e.movementX || 0;
  }

  function onMouseDown(e) {
    if (!pointerLocked) return;
    if (e.button === 0) {
      performShoot();
    }
  }

  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
  }

  function performShoot() {
    if (!gameState || gameState.gameOver || !gameState.player.alive) return;
    if (levelTransitionActive) return;

    var result = shoot(gameState);

    // Muzzle flash
    muzzleFlashTimer = 0.08;
    if (muzzleFlashMesh) {
      muzzleFlashMesh.material.opacity = 1;
    }

    // Weapon recoil
    weaponRecoil = 0.15;

    // Audio
    playGunshotSound();

    // Handle hit
    if (result && result.hit) {
      var cm = creeperMeshes[result.creeper.id];
      if (cm) {
        // Flash white (creeper) or yellow (pig)
        var isPigEnemy = cm.type === 'pig';
        var hitTex = isPigEnemy ? pigHitTex : creeperHitTex;
        getPigTextures(); // Ensure pig hit tex exists
        var hitMat = new THREE.SpriteMaterial({ map: hitTex });
        cm.sprite.material = hitMat;
        cm.hitTimer = 0.1;
      }

      if (!result.creeper.alive) {
        // Enemy killed
        faceState = 'grin';
        faceStateTimer = 1.0;

        var isPigType = result.creeper.type === 'pig';
        if (isPigType) {
          playPigDeathSound();
        } else {
          playCreeperDeathSound();
        }
      }
    }
  }

  // ---- GAME LOOP ----

  function gameLoop(timestamp) {
    animationFrameId = requestAnimationFrame(gameLoop);

    if (lastTime === 0) {
      lastTime = timestamp;
      return;
    }

    var dt = Math.min((timestamp - lastTime) / 1000, 0.05); // Cap delta
    lastTime = timestamp;

    // During level transition, just render the transition screen
    if (levelTransitionActive) {
      renderer.render(scene, camera);
      return;
    }

    if (!gameState || gameState.gameOver) {
      // Still render scene even when game over
      updateHUD();
      renderer.render(scene, camera);
      return;
    }

    // Process input
    var forward = 0;
    var strafe = 0;
    if (keys['KeyW'] || keys['ArrowUp']) forward += 1;
    if (keys['KeyS'] || keys['ArrowDown']) forward -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) strafe -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) strafe += 1;

    // Mouse look
    if (pointerLocked) {
      gameState.player.rotation -= mouseDeltaX * 0.002;
      mouseDeltaX = 0;
    }

    // Move player (from game-logic.js)
    var moveResult = null;
    if (forward !== 0 || strafe !== 0) {
      moveResult = movePlayer(gameState, forward, -strafe, dt);
    }

    // Check for pig level transition
    if (moveResult === 'enter_pig_level') {
      startPigLevelTransition();
      return;
    }

    // Update game state (from game-logic.js)
    updateGameState(gameState, dt);

    // Sync camera to player
    camera.position.set(gameState.player.x, 0.6, gameState.player.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = gameState.player.rotation + Math.PI;

    // Update player light
    if (scene.userData.playerLight) {
      scene.userData.playerLight.position.copy(camera.position);
      scene.userData.playerLight.position.y += 0.5;
    }

    // Sync creepers
    syncCreepers();
    updateDeathAnims(dt);

    // Muzzle flash
    if (muzzleFlashTimer > 0) {
      muzzleFlashTimer -= dt;
      if (muzzleFlashMesh) {
        muzzleFlashMesh.material.opacity = muzzleFlashTimer > 0 ? 1 : 0;
        // Random rotation for flash
        muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
      }
    }

    // Weapon recoil
    if (weaponRecoil > 0) {
      weaponRecoil = Math.max(0, weaponRecoil - dt * 2);
    }
    if (weaponMesh) {
      weaponMesh.position.y = -0.3 + weaponRecoil * 0.3;
      weaponMesh.position.z = -0.5 + weaponRecoil * 0.1;
      weaponMesh.rotation.x = -weaponRecoil * 0.5;
    }

    // Hurt flash
    if (hurtFlashTimer > 0) {
      hurtFlashTimer -= dt;
    }

    // Secret wall message timer
    if (secretWallMessageTimer > 0) {
      secretWallMessageTimer -= dt;
    }

    // Secret wall: no visual hints - player must explore to find it
    }

    // Update HUD
    updateHUD();

    // Render
    renderer.render(scene, camera);
  }

  // ---- RESIZE ----

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---- RESTART ----

  function restartGame() {
    // Clear existing creeper meshes
    clearCreepers();

    // New game state in current level
    var level = gameState ? gameState.level : 'doom';
    gameState = createGameState(level);
    lastPlayerHealth = gameState.player.health;
    gameOverShown = false;
    lastTime = 0;

    // Rebuild level if needed (in case we need fresh state)
    currentLevel = level;
    clearLevelGeometry();
    setupLighting(level);
    buildLevel();
    createWeapon();
    createHUD();
    setupAmbientSound(level);

    // Reset secret wall state when restarting in doom
    if (level === 'doom') {
      secretWallMessageTimer = 0;
    }

    // Reset cheat detector
    if (cheatDetector) {
      cheatDetector.reset();
    }

    // Hide game over screen
    var goScreen = document.getElementById('doom-gameover');
    if (goScreen) goScreen.style.display = 'none';

    // Re-lock pointer
    if (canvas) {
      canvas.requestPointerLock();
    }
  }

  // ---- CLEANUP ----

  function cleanupResources() {
    // Stop animation
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Stop audio
    stopAudio();

    // Remove event listeners
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    window.removeEventListener('resize', onResize);

    // Release pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Dispose Three.js resources
    if (scene) {
      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
    }

    if (renderer) {
      renderer.dispose();
      renderer = null;
    }

    // Clear texture cache
    if (wallTexture) { wallTexture.dispose(); wallTexture = null; }
    if (floorTexture) { floorTexture.dispose(); floorTexture = null; }
    if (ceilingTexture) { ceilingTexture.dispose(); ceilingTexture = null; }
    if (creeperTexture) { creeperTexture.dispose(); creeperTexture = null; }
    if (creeperHitTex) { creeperHitTex.dispose(); creeperHitTex = null; }
    if (pigWallTexture) { pigWallTexture.dispose(); pigWallTexture = null; }
    if (pigFloorTexture) { pigFloorTexture.dispose(); pigFloorTexture = null; }
    if (pigCeilingTexture) { pigCeilingTexture.dispose(); pigCeilingTexture = null; }
    if (pigTexture) { pigTexture.dispose(); pigTexture = null; }
    if (pigHitTex) { pigHitTex.dispose(); pigHitTex = null; }
    if (mudTexture) { mudTexture.dispose(); mudTexture = null; }

    // Remove styles
    var pigStyles = document.getElementById('doom-pig-styles');
    if (pigStyles) pigStyles.remove();

    // Clear references
    scene = null;
    camera = null;
    canvas = null;
    wallMeshes = [];
    floorMesh = null;
    ceilingMesh = null;
    mudMeshes = [];
    creeperMeshes = {};
    weaponMesh = null;
    muzzleFlashMesh = null;
    creeperDeathAnims = [];
    gameState = null;
    lastTime = 0;
    pointerLocked = false;
    gameOverShown = false;
    cheatDetector = null;
    secretWallMessageTimer = 0;
    levelTransitionTimer = 0;
    levelTransitionActive = false;
    currentLevel = 'doom';
    sceneLights = [];
  }

  // ---- PUBLIC API ----

  function exitGame() {
    cleanupResources();

    // Hide container
    if (doomContainer) {
      doomContainer.style.display = 'none';
    }

    // Reset key state
    for (var k in keys) {
      keys[k] = false;
    }
  }

  function launchGame() {
    // Show container
    doomContainer = document.getElementById('doom-container');
    if (!doomContainer) {
      // Create doom container if not in DOM
      doomContainer = document.createElement('div');
      doomContainer.id = 'doom-container';
      doomContainer.style.cssText = '\
        position: fixed;\
        top: 0; left: 0;\
        width: 100%; height: 100%;\
        z-index: 99999;\
        background: #000;\
        display: none;\
      ';
      var canvasEl = document.createElement('canvas');
      canvasEl.id = 'doom-canvas';
      doomContainer.appendChild(canvasEl);
      document.body.appendChild(doomContainer);
    }

    doomContainer.style.display = 'block';

    // Get canvas
    canvas = document.getElementById('doom-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'doom-canvas';
      doomContainer.appendChild(canvas);
    }
    canvas.style.cssText = 'width: 100%; height: 100%; display: block;';

    // Initialize game state (from game-logic.js) - always start fresh in doom level
    gameState = createGameState('doom');
    currentLevel = 'doom';
    lastPlayerHealth = gameState.player.health;
    gameOverShown = false;
    secretWallMessageTimer = 0;
    levelTransitionActive = false;

    // Setup Three.js
    setupScene();
    buildLevel();
    createWeapon();

    // Create HUD
    createHUD();

    // Initialize audio
    initAudio();

    // Setup cheat detector
    setupCheatDetector();

    // Event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('resize', onResize);

    // Request pointer lock
    canvas.addEventListener('click', function requestLock() {
      if (!pointerLocked && !gameState.gameOver) {
        canvas.requestPointerLock();
      }
    });

    // Initial pointer lock
    canvas.requestPointerLock();

    // Start game loop
    lastTime = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // Expose to global scope
  window.launchDoomGame = launchGame;
  window.exitDoomGame = exitGame;

})();
