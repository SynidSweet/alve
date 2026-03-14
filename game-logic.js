// ============================================
// ALVE'S WORLD - Shared Game Logic
// Pure functions, testable without DOM/browser
// ============================================

// ---- CHEAT CODE DETECTOR ----
function createCheatDetector(codes) {
  // codes: { name: string, sequence: string[] | string, onActivate: Function }
  const trackers = codes.map(code => ({
    name: code.name,
    sequence: typeof code.sequence === 'string' ? code.sequence.split('') : code.sequence,
    index: 0,
    onActivate: code.onActivate
  }));

  return {
    handleKey(key) {
      const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
      const activated = [];

      for (const tracker of trackers) {
        if (normalizedKey === tracker.sequence[tracker.index]) {
          tracker.index++;
          if (tracker.index === tracker.sequence.length) {
            tracker.index = 0;
            activated.push(tracker.name);
            if (tracker.onActivate) tracker.onActivate();
          }
        } else {
          // Check if the current key matches the start of the sequence
          tracker.index = normalizedKey === tracker.sequence[0] ? 1 : 0;
        }
      }

      return activated;
    },

    reset() {
      for (const tracker of trackers) {
        tracker.index = 0;
      }
    },

    getProgress(name) {
      const tracker = trackers.find(t => t.name === name);
      if (!tracker) return 0;
      return tracker.index / tracker.sequence.length;
    }
  };
}

// ---- DOOM E1M1 THEME NOTES ----
// Simplified E1M1 "At Doom's Gate" melody
// Format: [frequency_hz, duration_seconds, start_time_seconds]
const DOOM_E1M1_NOTES = [
  // Intro riff (E minor pentatonic power)
  [164.81, 0.15, 0.0],   // E3
  [164.81, 0.15, 0.15],  // E3
  [329.63, 0.15, 0.3],   // E4
  [164.81, 0.15, 0.45],  // E3
  [164.81, 0.15, 0.6],   // E3
  [293.66, 0.15, 0.75],  // D4
  [164.81, 0.15, 0.9],   // E3
  [164.81, 0.15, 1.05],  // E3
  [261.63, 0.15, 1.2],   // C4
  [164.81, 0.15, 1.35],  // E3
  [164.81, 0.15, 1.5],   // E3
  [246.94, 0.15, 1.65],  // B3
  [164.81, 0.15, 1.8],   // E3
  [164.81, 0.15, 1.95],  // E3
  [261.63, 0.2, 2.1],    // C4
  [293.66, 0.2, 2.3],    // D4
  // Second phrase
  [164.81, 0.15, 2.6],   // E3
  [164.81, 0.15, 2.75],  // E3
  [329.63, 0.15, 2.9],   // E4
  [164.81, 0.15, 3.05],  // E3
  [164.81, 0.15, 3.2],   // E3
  [349.23, 0.15, 3.35],  // F4
  [164.81, 0.15, 3.5],   // E3
  [164.81, 0.15, 3.65],  // E3
  [329.63, 0.15, 3.8],   // E4
  [164.81, 0.15, 3.95],  // E3
  [164.81, 0.15, 4.1],   // E3
  [293.66, 0.15, 4.25],  // D4
  // Power ending
  [164.81, 0.3, 4.5],    // E3
  [196.00, 0.3, 4.8],    // G3
  [220.00, 0.3, 5.1],    // A3
  [164.81, 0.6, 5.4],    // E3 (held)
];

// ---- DOOM GAME LOGIC ----

// Map definition: 1 = wall, 0 = open, 2 = creeper spawn
const DOOM_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,1,0,0,0,0,0,1,1,0,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,0,0,1,1,1,1,0,0,0,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,2,0,0,0,0,0,0,0,0,2,0,0,1],
  [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const CREEPER_MAX_HEALTH = 3;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_MAX_AMMO = 50;
const SHOOT_DAMAGE = 1;
const CREEPER_DAMAGE = 10;
const CREEPER_SPEED = 1.5; // units per second
const CREEPER_ATTACK_RANGE = 1.5;
const SHOOT_RANGE = 20;

function createGameState() {
  return {
    player: {
      x: 1.5,
      z: 1.5,
      rotation: 0, // radians
      health: PLAYER_MAX_HEALTH,
      ammo: PLAYER_MAX_AMMO,
      score: 0,
      alive: true,
    },
    creepers: [],
    projectiles: [],
    spawnTimer: 0,
    spawnInterval: 5, // seconds
    gameTime: 0,
    gameOver: false,
  };
}

function getSpawnPoints() {
  const points = [];
  for (let z = 0; z < DOOM_MAP.length; z++) {
    for (let x = 0; x < DOOM_MAP[z].length; x++) {
      if (DOOM_MAP[z][x] === 2) {
        points.push({ x: x + 0.5, z: z + 0.5 });
      }
    }
  }
  return points;
}

function spawnCreeper(state) {
  const spawnPoints = getSpawnPoints();
  if (spawnPoints.length === 0) return null;

  const point = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  const creeper = {
    id: Date.now() + Math.random(),
    x: point.x,
    z: point.z,
    health: CREEPER_MAX_HEALTH,
    alive: true,
  };
  state.creepers.push(creeper);
  return creeper;
}

function isWall(x, z) {
  const mapX = Math.floor(x);
  const mapZ = Math.floor(z);
  if (mapZ < 0 || mapZ >= DOOM_MAP.length || mapX < 0 || mapX >= DOOM_MAP[0].length) {
    return true;
  }
  return DOOM_MAP[mapZ][mapX] === 1;
}

function movePlayer(state, forward, strafe, dt) {
  const speed = 4.0 * dt;
  const dx = (Math.sin(state.player.rotation) * forward + Math.cos(state.player.rotation) * strafe) * speed;
  const dz = (Math.cos(state.player.rotation) * forward - Math.sin(state.player.rotation) * strafe) * speed;

  const newX = state.player.x + dx;
  const newZ = state.player.z + dz;
  const radius = 0.3;

  // Collision with walls (slide along walls)
  if (!isWall(newX + radius, state.player.z) && !isWall(newX - radius, state.player.z)) {
    state.player.x = newX;
  }
  if (!isWall(state.player.x, newZ + radius) && !isWall(state.player.x, newZ - radius)) {
    state.player.z = newZ;
  }
}

function shoot(state) {
  if (!state.player.alive || state.player.ammo <= 0) return null;

  state.player.ammo--;

  // Raycast to find closest creeper in crosshair
  const px = state.player.x;
  const pz = state.player.z;
  const dirX = Math.sin(state.player.rotation);
  const dirZ = Math.cos(state.player.rotation);

  let closestCreeper = null;
  let closestDist = SHOOT_RANGE;

  for (const creeper of state.creepers) {
    if (!creeper.alive) continue;

    const toX = creeper.x - px;
    const toZ = creeper.z - pz;
    const dist = Math.sqrt(toX * toX + toZ * toZ);

    if (dist > SHOOT_RANGE) continue;

    // Check if creeper is in the firing cone (within ~15 degrees)
    const dot = (toX * dirX + toZ * dirZ) / dist;
    const angle = Math.acos(Math.min(1, Math.max(-1, dot)));

    // Wider hit cone at close range, narrower at distance
    const hitCone = Math.atan2(0.5, dist);
    if (angle < hitCone && dist < closestDist) {
      closestCreeper = creeper;
      closestDist = dist;
    }
  }

  if (closestCreeper) {
    closestCreeper.health -= SHOOT_DAMAGE;
    if (closestCreeper.health <= 0) {
      closestCreeper.alive = false;
      state.player.score += 100;
      // Ammo drop
      state.player.ammo = Math.min(state.player.ammo + 5, PLAYER_MAX_AMMO);
    }
    return { hit: true, creeper: closestCreeper, distance: closestDist };
  }

  return { hit: false };
}

function updateCreepers(state, dt) {
  for (const creeper of state.creepers) {
    if (!creeper.alive) continue;

    // Move toward player
    const dx = state.player.x - creeper.x;
    const dz = state.player.z - creeper.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < CREEPER_ATTACK_RANGE) {
      // Attack player
      state.player.health -= CREEPER_DAMAGE * dt;
      if (state.player.health <= 0) {
        state.player.health = 0;
        state.player.alive = false;
        state.gameOver = true;
      }
    } else {
      // Move toward player
      const moveX = (dx / dist) * CREEPER_SPEED * dt;
      const moveZ = (dz / dist) * CREEPER_SPEED * dt;

      const newX = creeper.x + moveX;
      const newZ = creeper.z + moveZ;

      if (!isWall(newX, creeper.z)) creeper.x = newX;
      if (!isWall(creeper.x, newZ)) creeper.z = newZ;
    }
  }

  // Remove dead creepers
  state.creepers = state.creepers.filter(c => c.alive);
}

function updateGameState(state, dt) {
  if (state.gameOver) return;

  state.gameTime += dt;
  state.spawnTimer += dt;

  // Spawn creepers periodically (faster as game progresses)
  const adjustedInterval = Math.max(1.5, state.spawnInterval - state.gameTime * 0.05);
  if (state.spawnTimer >= adjustedInterval && state.creepers.length < 10) {
    spawnCreeper(state);
    state.spawnTimer = 0;
  }

  updateCreepers(state, dt);
}

// ---- EXPORTS ----
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createCheatDetector,
    DOOM_E1M1_NOTES,
    DOOM_MAP,
    CREEPER_MAX_HEALTH,
    PLAYER_MAX_HEALTH,
    PLAYER_MAX_AMMO,
    SHOOT_DAMAGE,
    CREEPER_DAMAGE,
    CREEPER_SPEED,
    CREEPER_ATTACK_RANGE,
    SHOOT_RANGE,
    createGameState,
    getSpawnPoints,
    spawnCreeper,
    isWall,
    movePlayer,
    shoot,
    updateCreepers,
    updateGameState,
  };
}
