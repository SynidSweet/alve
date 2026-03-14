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

// Map definition: 1 = wall, 0 = open, 2 = enemy spawn, 3 = secret wall (passable after IDCLIP)
const DOOM_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,1,0,0,0,0,0,1,1,0,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,3,1],
  [1,1,1,0,0,0,1,1,1,1,0,0,0,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,2,0,0,0,0,0,0,0,0,2,0,0,1],
  [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Secret wall position (the cell marked 3 in DOOM_MAP)
const SECRET_WALL = { x: 14, z: 7 };

// Pig Level map: circular pen with mud patches
// 1 = wall, 0 = open, 2 = pig spawn, 4 = mud (open, visual only)
const PIG_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1],
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  [1,0,0,0,0,4,0,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,4,4,0,0,4,4,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,2,0,1],
  [1,0,0,4,0,0,0,0,0,0,0,0,4,0,0,1],
  [1,0,0,4,4,0,0,0,0,0,0,4,4,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,4,0,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,4,4,0,0,0,0,4,4,0,0,2,1],
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  [1,1,0,0,0,0,0,2,0,0,0,0,0,0,1,1],
  [1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const PIG_MAX_HEALTH = 2;
const PIG_DAMAGE = 8;
const PIG_SPEED = 2.0; // pigs are fast!

const CREEPER_MAX_HEALTH = 3;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_MAX_AMMO = 50;
const SHOOT_DAMAGE = 1;
const CREEPER_DAMAGE = 10;
const CREEPER_SPEED = 1.5; // units per second
const CREEPER_ATTACK_RANGE = 1.5;
const SHOOT_RANGE = 20;

function createGameState(level) {
  level = level || 'doom';
  return {
    level: level, // 'doom' or 'pig'
    player: {
      x: level === 'pig' ? 8.5 : 1.5,
      z: level === 'pig' ? 8.5 : 1.5,
      rotation: 0,
      health: PLAYER_MAX_HEALTH,
      ammo: PLAYER_MAX_AMMO,
      score: 0,
      alive: true,
    },
    creepers: [], // also used for pigs
    projectiles: [],
    spawnTimer: 0,
    spawnInterval: level === 'pig' ? 3 : 5,
    gameTime: 0,
    gameOver: false,
    secretWallOpen: false, // IDCLIP activated
  };
}

function getActiveMap(state) {
  return state.level === 'pig' ? PIG_MAP : DOOM_MAP;
}

function getSpawnPoints(state) {
  const map = getActiveMap(state);
  const points = [];
  for (let z = 0; z < map.length; z++) {
    for (let x = 0; x < map[z].length; x++) {
      if (map[z][x] === 2) {
        points.push({ x: x + 0.5, z: z + 0.5 });
      }
    }
  }
  return points;
}

function spawnCreeper(state) {
  const spawnPoints = getSpawnPoints(state);
  if (spawnPoints.length === 0) return null;

  const point = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  const isPig = state.level === 'pig';
  const creeper = {
    id: Date.now() + Math.random(),
    x: point.x,
    z: point.z,
    health: isPig ? PIG_MAX_HEALTH : CREEPER_MAX_HEALTH,
    alive: true,
    type: isPig ? 'pig' : 'creeper',
  };
  state.creepers.push(creeper);
  return creeper;
}

function isWall(x, z, state) {
  const map = state ? getActiveMap(state) : DOOM_MAP;
  const mapX = Math.floor(x);
  const mapZ = Math.floor(z);
  if (mapZ < 0 || mapZ >= map.length || mapX < 0 || mapX >= map[0].length) {
    return true;
  }
  const cell = map[mapZ][mapX];
  // Secret wall (3) is passable when open
  if (cell === 3 && state && state.secretWallOpen) {
    return false;
  }
  // Mud (4) is open ground
  if (cell === 4) return false;
  return cell === 1 || cell === 3;
}

function movePlayer(state, forward, strafe, dt) {
  const speed = 4.0 * dt;
  const dx = (Math.sin(state.player.rotation) * forward + Math.cos(state.player.rotation) * strafe) * speed;
  const dz = (Math.cos(state.player.rotation) * forward - Math.sin(state.player.rotation) * strafe) * speed;

  const newX = state.player.x + dx;
  const newZ = state.player.z + dz;
  const radius = 0.3;

  if (!isWall(newX + radius, state.player.z, state) && !isWall(newX - radius, state.player.z, state)) {
    state.player.x = newX;
  }
  if (!isWall(state.player.x, newZ + radius, state) && !isWall(state.player.x, newZ - radius, state)) {
    state.player.z = newZ;
  }

  // Check if player walked through secret wall into pig dimension
  if (state.level === 'doom' && state.secretWallOpen) {
    const mapX = Math.floor(state.player.x);
    const mapZ = Math.floor(state.player.z);
    // If player is beyond the secret wall (outside the doom map bounds)
    if (mapX >= DOOM_MAP[0].length - 1 || mapX < 0 || mapZ < 0 || mapZ >= DOOM_MAP.length) {
      return 'enter_pig_level';
    }
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

function activateSecretWall(state) {
  state.secretWallOpen = true;
}

function switchToPigLevel(state) {
  state.level = 'pig';
  state.player.x = 8.5;
  state.player.z = 8.5;
  state.player.rotation = 0;
  state.player.health = PLAYER_MAX_HEALTH;
  state.player.ammo = PLAYER_MAX_AMMO;
  state.creepers = [];
  state.spawnTimer = 0;
  state.spawnInterval = 3;
  state.gameTime = 0;
  // Keep score from doom level
}

function updateCreepers(state, dt) {
  const isPig = state.level === 'pig';
  const damage = isPig ? PIG_DAMAGE : CREEPER_DAMAGE;
  const speed = isPig ? PIG_SPEED : CREEPER_SPEED;

  for (const creeper of state.creepers) {
    if (!creeper.alive) continue;

    const dx = state.player.x - creeper.x;
    const dz = state.player.z - creeper.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < CREEPER_ATTACK_RANGE) {
      state.player.health -= damage * dt;
      if (state.player.health <= 0) {
        state.player.health = 0;
        state.player.alive = false;
        state.gameOver = true;
      }
    } else {
      const moveX = (dx / dist) * speed * dt;
      const moveZ = (dz / dist) * speed * dt;

      const newX = creeper.x + moveX;
      const newZ = creeper.z + moveZ;

      if (!isWall(newX, creeper.z, state)) creeper.x = newX;
      if (!isWall(creeper.x, newZ, state)) creeper.z = newZ;
    }
  }

  state.creepers = state.creepers.filter(c => c.alive);
}

function updateGameState(state, dt) {
  if (state.gameOver) return;

  state.gameTime += dt;
  state.spawnTimer += dt;

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
    PIG_MAP,
    SECRET_WALL,
    PIG_MAX_HEALTH,
    PIG_DAMAGE,
    PIG_SPEED,
    CREEPER_MAX_HEALTH,
    PLAYER_MAX_HEALTH,
    PLAYER_MAX_AMMO,
    SHOOT_DAMAGE,
    CREEPER_DAMAGE,
    CREEPER_SPEED,
    CREEPER_ATTACK_RANGE,
    SHOOT_RANGE,
    createGameState,
    getActiveMap,
    getSpawnPoints,
    spawnCreeper,
    isWall,
    movePlayer,
    shoot,
    activateSecretWall,
    switchToPigLevel,
    updateCreepers,
    updateGameState,
  };
}
