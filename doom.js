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
  let pointerLocked = false;
  let gameState = null;
  let lastTime = 0;
  let wallMeshes = [];
  let floorMesh = null;
  let ceilingMesh = null;
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

  // ---- TEXTURES (created lazily) ----
  let wallTexture = null;
  let floorTexture = null;
  let ceilingTexture = null;
  let creeperTexture = null;
  let creeperHitTex = null;

  function getTextures() {
    if (!wallTexture) wallTexture = createWallTexture();
    if (!floorTexture) floorTexture = createFloorTexture(false);
    if (!ceilingTexture) ceilingTexture = createFloorTexture(true);
    if (!creeperTexture) creeperTexture = createCreeperTexture();
    if (!creeperHitTex) creeperHitTex = createCreeperHitTexture();
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

    // Lighting
    const ambient = new THREE.AmbientLight(0x330000, 0.4);
    scene.add(ambient);

    // Point lights scattered in the map
    const lightPositions = [
      [4, 2, 4], [12, 2, 4], [8, 2, 8], [4, 2, 12], [12, 2, 12]
    ];
    lightPositions.forEach(([x, y, z]) => {
      const pl = new THREE.PointLight(0xff4400, 1.2, 8);
      pl.position.set(x, y, z);
      scene.add(pl);
    });

    // Extra dim fill light on player
    const playerLight = new THREE.PointLight(0x664422, 0.6, 6);
    playerLight.position.copy(camera.position);
    scene.add(playerLight);
    // Store reference to update with camera
    scene.userData.playerLight = playerLight;
  }

  function buildLevel() {
    getTextures();
    const wallHeight = 2;
    const cellSize = 1;

    const wallGeo = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (let z = 0; z < DOOM_MAP.length; z++) {
      for (let x = 0; x < DOOM_MAP[z].length; x++) {
        if (DOOM_MAP[z][x] === 1) {
          const mesh = new THREE.Mesh(wallGeo, wallMat);
          mesh.position.set(x + 0.5, wallHeight / 2, z + 0.5);
          scene.add(mesh);
          wallMeshes.push(mesh);
        }
      }
    }

    // Floor
    const mapW = DOOM_MAP[0].length;
    const mapH = DOOM_MAP.length;
    const floorGeo = new THREE.PlaneGeometry(mapW, mapH);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 1.0,
    });
    floorTexture.repeat.set(mapW, mapH);
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(mapW / 2, 0, mapH / 2);
    scene.add(floorMesh);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(mapW, mapH);
    const ceilMat = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      roughness: 1.0,
    });
    ceilingTexture.repeat.set(mapW, mapH);
    ceilingMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(mapW / 2, 2, mapH / 2);
    scene.add(ceilingMesh);
  }

  // ---- WEAPON (3D overlay) ----

  function createWeapon() {
    // Simple shotgun shape using boxes
    const group = new THREE.Group();

    // Barrel
    const barrelGeo = new THREE.BoxGeometry(0.06, 0.06, 0.5);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0, -0.2);
    group.add(barrel);

    // Second barrel
    const barrel2 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel2.position.set(0.07, 0, -0.2);
    group.add(barrel2);

    // Stock/grip
    const stockGeo = new THREE.BoxGeometry(0.08, 0.15, 0.2);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 });
    const stock = new THREE.Mesh(stockGeo, stockMat);
    stock.position.set(0.03, -0.08, 0.05);
    group.add(stock);

    // Handle
    const handleGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);
    const handle = new THREE.Mesh(handleGeo, stockMat);
    handle.position.set(0.03, -0.15, 0.02);
    handle.rotation.x = 0.3;
    group.add(handle);

    // Position relative to camera
    group.position.set(0.3, -0.3, -0.5);

    weaponMesh = group;
    camera.add(group);
    scene.add(camera);

    // Muzzle flash
    const flashGeo = new THREE.PlaneGeometry(0.15, 0.15);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlashMesh.position.set(0.03, 0.02, -0.5);
    camera.add(muzzleFlashMesh);
  }

  // ---- CREEPER SPRITES ----

  function createCreeperSprite(creeper) {
    getTextures();
    const spriteMat = new THREE.SpriteMaterial({ map: creeperTexture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1, 1.5, 1);
    sprite.position.set(creeper.x, 0.75, creeper.z);
    scene.add(sprite);
    creeperMeshes[creeper.id] = {
      sprite: sprite,
      hitTimer: 0,
      normalMat: spriteMat,
    };
  }

  function syncCreepers() {
    if (!gameState) return;

    // Add new creepers
    for (const creeper of gameState.creepers) {
      if (!creeperMeshes[creeper.id]) {
        createCreeperSprite(creeper);
      }
    }

    // Update positions and remove dead
    const aliveIds = new Set(gameState.creepers.map(c => c.id));
    for (const id in creeperMeshes) {
      if (!aliveIds.has(Number(id))) {
        // Start death animation
        const cm = creeperMeshes[id];
        creeperDeathAnims.push({
          sprite: cm.sprite,
          timer: 0,
          duration: 0.5,
        });
        delete creeperMeshes[id];
      }
    }

    // Sync alive creeper positions
    for (const creeper of gameState.creepers) {
      const cm = creeperMeshes[creeper.id];
      if (cm) {
        cm.sprite.position.set(creeper.x, 0.75, creeper.z);

        // Handle hit flash
        if (cm.hitTimer > 0) {
          cm.hitTimer -= 0.016;
          if (cm.hitTimer <= 0) {
            cm.sprite.material = cm.normalMat;
          }
        }
      }
    }
  }

  function updateDeathAnims(dt) {
    for (let i = creeperDeathAnims.length - 1; i >= 0; i--) {
      const anim = creeperDeathAnims[i];
      anim.timer += dt;
      const progress = anim.timer / anim.duration;

      if (progress >= 1) {
        scene.remove(anim.sprite);
        if (anim.sprite.material.map) anim.sprite.material.map.dispose();
        anim.sprite.material.dispose();
        creeperDeathAnims.splice(i, 1);
      } else {
        // Scale down and fade
        const scale = 1 - progress;
        anim.sprite.scale.set(scale, scale * 1.5, scale);
        anim.sprite.material.opacity = 1 - progress;
        anim.sprite.material.transparent = true;
      }
    }
  }

  // ---- HUD ----

  function createHUD() {
    hudElement = document.getElementById('doom-hud-game');
    if (!hudElement) {
      hudElement = document.createElement('div');
      hudElement.id = 'doom-hud-game';
      doomContainer.appendChild(hudElement);
    }

    hudElement.innerHTML = '';

    hudElement.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      font-family: 'Press Start 2P', monospace;
      color: #00FF00;
      z-index: 100;
    `;

    // Crosshair
    const crosshair = document.createElement('div');
    crosshair.id = 'doom-crosshair';
    crosshair.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 24px;
      color: #00FF00;
      text-shadow: 0 0 4px rgba(0,255,0,0.5);
      user-select: none;
    `;
    crosshair.textContent = '+';
    hudElement.appendChild(crosshair);

    // Score (center top)
    const score = document.createElement('div');
    score.id = 'doom-score';
    score.style.cssText = `
      position: absolute;
      top: 15px; left: 50%;
      transform: translateX(-50%);
      font-size: 14px;
      text-shadow: 2px 2px 0 #000;
      background: rgba(0,0,0,0.5);
      padding: 4px 12px;
    `;
    score.textContent = 'SCORE: 0';
    hudElement.appendChild(score);

    // Health (left side)
    const health = document.createElement('div');
    health.id = 'doom-health';
    health.style.cssText = `
      position: absolute;
      bottom: 15px; left: 15px;
      font-size: 12px;
      text-shadow: 2px 2px 0 #000;
      background: rgba(0,0,0,0.6);
      padding: 8px 12px;
      border: 1px solid #00FF00;
    `;
    health.innerHTML = '<span style="color:#ff4444">HP</span> 100';
    hudElement.appendChild(health);

    // Health bar
    const healthBar = document.createElement('div');
    healthBar.id = 'doom-health-bar';
    healthBar.style.cssText = `
      position: absolute;
      bottom: 55px; left: 15px;
      width: 150px; height: 8px;
      background: #1a1a1a;
      border: 1px solid #00FF00;
    `;
    const healthFill = document.createElement('div');
    healthFill.id = 'doom-health-fill';
    healthFill.style.cssText = `
      width: 100%; height: 100%;
      background: #00FF00;
      transition: width 0.2s;
    `;
    healthBar.appendChild(healthFill);
    hudElement.appendChild(healthBar);

    // Ammo (right side)
    const ammo = document.createElement('div');
    ammo.id = 'doom-ammo';
    ammo.style.cssText = `
      position: absolute;
      bottom: 15px; right: 15px;
      font-size: 12px;
      text-shadow: 2px 2px 0 #000;
      background: rgba(0,0,0,0.6);
      padding: 8px 12px;
      border: 1px solid #00FF00;
    `;
    ammo.innerHTML = 'AMMO <span style="color:#ffaa00">50</span>';
    hudElement.appendChild(ammo);

    // Doom face (center bottom)
    const faceContainer = document.createElement('div');
    faceContainer.id = 'doom-face-container';
    faceContainer.style.cssText = `
      position: absolute;
      bottom: 10px; left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      border: 2px solid #00FF00;
      padding: 4px;
    `;
    const faceCanvas = document.createElement('canvas');
    faceCanvas.id = 'doom-face';
    faceCanvas.width = 48;
    faceCanvas.height = 48;
    faceCanvas.style.cssText = 'image-rendering: pixelated; width: 48px; height: 48px;';
    faceContainer.appendChild(faceCanvas);
    hudElement.appendChild(faceContainer);

    // Hurt flash overlay
    const hurtOverlay = document.createElement('div');
    hurtOverlay.id = 'doom-hurt-flash';
    hurtOverlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 0, 0, 0);
      pointer-events: none;
      transition: background 0.1s;
    `;
    hudElement.appendChild(hurtOverlay);

    // Game over screen (hidden initially)
    const gameOverScreen = document.createElement('div');
    gameOverScreen.id = 'doom-gameover';
    gameOverScreen.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 200;
    `;
    gameOverScreen.innerHTML = `
      <div style="font-size: 32px; color: #ff0000; text-shadow: 0 0 10px #ff0000; margin-bottom: 30px;">GAME OVER</div>
      <div id="doom-final-score" style="font-size: 16px; color: #00FF00; margin-bottom: 20px;">SCORE: 0</div>
      <div style="font-size: 10px; color: #aaa; margin-bottom: 10px;">Press ENTER to restart</div>
      <div style="font-size: 10px; color: #666;">Press ESC to exit</div>
    `;
    hudElement.appendChild(gameOverScreen);

    drawFace('neutral', 1.0);
  }

  function drawFace(expression, healthPercent) {
    const faceCanvas = document.getElementById('doom-face');
    if (!faceCanvas) return;
    const ctx = faceCanvas.getContext('2d');
    const px = 6; // 8x8 grid in 48x48 canvas

    // Clear
    ctx.fillStyle = '#c8a878';
    ctx.fillRect(0, 0, 48, 48);

    // Skin tone gets redder as health drops
    const bloodLevel = 1 - healthPercent;
    const skinR = Math.floor(200 - bloodLevel * 60);
    const skinG = Math.floor(168 - bloodLevel * 100);
    const skinB = Math.floor(120 - bloodLevel * 80);
    ctx.fillStyle = `rgb(${skinR}, ${skinG}, ${skinB})`;
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

  function updateHUD() {
    if (!gameState || !hudElement) return;

    const p = gameState.player;
    const healthPercent = p.health / PLAYER_MAX_HEALTH;

    // Score
    const scoreEl = document.getElementById('doom-score');
    if (scoreEl) scoreEl.textContent = 'SCORE: ' + p.score;

    // Health
    const healthEl = document.getElementById('doom-health');
    if (healthEl) {
      const healthColor = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#ffaa00' : '#ff0000';
      healthEl.innerHTML = `<span style="color:${healthColor}">HP</span> ${Math.ceil(p.health)}`;
    }

    // Health bar
    const healthFill = document.getElementById('doom-health-fill');
    if (healthFill) {
      healthFill.style.width = (healthPercent * 100) + '%';
      healthFill.style.background = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#ffaa00' : '#ff0000';
    }

    // Ammo
    const ammoEl = document.getElementById('doom-ammo');
    if (ammoEl) {
      const ammoColor = p.ammo > 10 ? '#ffaa00' : '#ff0000';
      ammoEl.innerHTML = `AMMO <span style="color:${ammoColor}">${p.ammo}</span>`;
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
    const hurtFlash = document.getElementById('doom-hurt-flash');
    if (hurtFlash) {
      if (hurtFlashTimer > 0) {
        hurtFlash.style.background = `rgba(255, 0, 0, ${hurtFlashTimer * 1.5})`;
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

    // Game over
    if (gameState.gameOver && !gameOverShown) {
      gameOverShown = true;
      const goScreen = document.getElementById('doom-gameover');
      if (goScreen) {
        goScreen.style.display = 'flex';
        const finalScore = document.getElementById('doom-final-score');
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

    // Ambient hum
    ambientOsc = audioCtx.createOscillator();
    ambientOsc.type = 'sine';
    ambientOsc.frequency.value = 55;
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.04;
    ambientOsc.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);
    ambientOsc.start();

    // Add a second detuned oscillator for eerie feel
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 55.5;
    const gain2 = audioCtx.createGain();
    gain2.gain.value = 0.03;
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start();

    // Store for cleanup
    audioCtx._extraOsc = osc2;
    audioCtx._extraGain = gain2;
  }

  function playGunshotSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // White noise burst
    const bufferSize = audioCtx.sampleRate * 0.1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    noise.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.15);

    // Low frequency punch
    const punch = audioCtx.createOscillator();
    punch.type = 'sine';
    punch.frequency.setValueAtTime(150, now);
    punch.frequency.exponentialRampToValueAtTime(30, now + 0.1);
    const punchGain = audioCtx.createGain();
    punchGain.gain.setValueAtTime(0.4, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    punch.connect(punchGain);
    punchGain.connect(audioCtx.destination);
    punch.start(now);
    punch.stop(now + 0.2);
  }

  function playCreeperDeathSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  function playHurtSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const bufferSize = audioCtx.sampleRate * 0.08;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
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
      if (audioCtx._extraOsc) { audioCtx._extraOsc.stop(); audioCtx._extraOsc = null; }
      if (audioCtx._extraGain) { audioCtx._extraGain.disconnect(); audioCtx._extraGain = null; }
      audioCtx.close();
    } catch (e) { /* ignore */ }
    audioCtx = null;
  }

  // ---- INPUT HANDLING ----

  function onKeyDown(e) {
    keys[e.code] = true;

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

    const result = shoot(gameState);

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
      const cm = creeperMeshes[result.creeper.id];
      if (cm) {
        // Flash white
        const hitMat = new THREE.SpriteMaterial({ map: creeperHitTex });
        cm.sprite.material = hitMat;
        cm.hitTimer = 0.1;
      }

      if (!result.creeper.alive) {
        // Creeper killed
        faceState = 'grin';
        faceStateTimer = 1.0;
        playCreeperDeathSound();
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

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // Cap delta
    lastTime = timestamp;

    if (!gameState || gameState.gameOver) {
      // Still render scene even when game over
      updateHUD();
      renderer.render(scene, camera);
      return;
    }

    // Process input
    let forward = 0;
    let strafe = 0;
    if (keys['KeyW'] || keys['ArrowUp']) forward += 1;
    if (keys['KeyS'] || keys['ArrowDown']) forward -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) strafe -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) strafe += 1;

    // Mouse look
    if (pointerLocked) {
      gameState.player.rotation += mouseDeltaX * 0.002;
      mouseDeltaX = 0;
    }

    // Move player (from game-logic.js)
    if (forward !== 0 || strafe !== 0) {
      movePlayer(gameState, forward, strafe, dt);
    }

    // Update game state (from game-logic.js)
    updateGameState(gameState, dt);

    // Sync camera to player
    camera.position.set(gameState.player.x, 0.6, gameState.player.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = -gameState.player.rotation;

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
    for (const id in creeperMeshes) {
      scene.remove(creeperMeshes[id].sprite);
      if (creeperMeshes[id].sprite.material.map) creeperMeshes[id].sprite.material.map.dispose();
      creeperMeshes[id].sprite.material.dispose();
    }
    creeperMeshes = {};

    // Clear death anims
    for (const anim of creeperDeathAnims) {
      scene.remove(anim.sprite);
      if (anim.sprite.material.map) anim.sprite.material.map.dispose();
      anim.sprite.material.dispose();
    }
    creeperDeathAnims = [];

    // New game state
    gameState = createGameState();
    lastPlayerHealth = gameState.player.health;
    gameOverShown = false;
    lastTime = 0;

    // Hide game over screen
    const goScreen = document.getElementById('doom-gameover');
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

    // Clear references
    scene = null;
    camera = null;
    canvas = null;
    wallMeshes = [];
    floorMesh = null;
    ceilingMesh = null;
    creeperMeshes = {};
    weaponMesh = null;
    muzzleFlashMesh = null;
    creeperDeathAnims = [];
    gameState = null;
    lastTime = 0;
    pointerLocked = false;
    gameOverShown = false;
  }

  // ---- PUBLIC API ----

  function exitGame() {
    cleanupResources();

    // Hide container
    if (doomContainer) {
      doomContainer.style.display = 'none';
    }

    // Reset key state
    for (const k in keys) {
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
      doomContainer.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 99999;
        background: #000;
        display: none;
      `;
      const canvasEl = document.createElement('canvas');
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

    // Initialize game state (from game-logic.js)
    gameState = createGameState();
    lastPlayerHealth = gameState.player.health;
    gameOverShown = false;

    // Setup Three.js
    setupScene();
    buildLevel();
    createWeapon();

    // Create HUD
    createHUD();

    // Initialize audio
    initAudio();

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
