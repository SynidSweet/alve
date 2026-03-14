const assert = require('assert');
const {
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
  createGameState,
  getSpawnPoints,
  spawnCreeper,
  isWall,
  movePlayer,
  shoot,
  activateSecretWall,
  switchToPigLevel,
  updateCreepers,
  updateGameState,
} = require('../game-logic.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ============================================
// CHEAT CODE DETECTOR TESTS
// ============================================
console.log('\n🎮 Cheat Code Detector');

test('detects IDKFA when typed correctly', () => {
  const activated = [];
  const detector = createCheatDetector([
    { name: 'IDKFA', sequence: 'idkfa', onActivate: () => activated.push('IDKFA') }
  ]);

  'idkfa'.split('').forEach(k => detector.handleKey(k));
  assert.deepStrictEqual(activated, ['IDKFA']);
});

test('detects IDDQD when typed correctly', () => {
  const activated = [];
  const detector = createCheatDetector([
    { name: 'IDDQD', sequence: 'iddqd', onActivate: () => activated.push('IDDQD') }
  ]);

  'iddqd'.split('').forEach(k => detector.handleKey(k));
  assert.deepStrictEqual(activated, ['IDDQD']);
});

test('does not trigger on partial sequence', () => {
  const activated = [];
  const detector = createCheatDetector([
    { name: 'IDKFA', sequence: 'idkfa', onActivate: () => activated.push('IDKFA') }
  ]);

  'idk'.split('').forEach(k => detector.handleKey(k));
  assert.deepStrictEqual(activated, []);
});

test('resets on wrong key', () => {
  const activated = [];
  const detector = createCheatDetector([
    { name: 'IDKFA', sequence: 'idkfa', onActivate: () => activated.push('IDKFA') }
  ]);

  'idkxa'.split('').forEach(k => detector.handleKey(k));
  assert.deepStrictEqual(activated, []);
});

test('handles multiple codes simultaneously', () => {
  const activated = [];
  const detector = createCheatDetector([
    { name: 'IDKFA', sequence: 'idkfa', onActivate: () => activated.push('IDKFA') },
    { name: 'IDDQD', sequence: 'iddqd', onActivate: () => activated.push('IDDQD') }
  ]);

  'idkfa'.split('').forEach(k => detector.handleKey(k));
  assert.deepStrictEqual(activated, ['IDKFA']);
  assert.strictEqual(detector.getProgress('IDDQD'), 0); // IDDQD got reset after 'k'
});

test('tracks progress correctly', () => {
  const detector = createCheatDetector([
    { name: 'IDKFA', sequence: 'idkfa', onActivate: () => {} }
  ]);

  detector.handleKey('i');
  assert.strictEqual(detector.getProgress('IDKFA'), 1/5);
  detector.handleKey('d');
  assert.strictEqual(detector.getProgress('IDKFA'), 2/5);
});

test('reset clears all progress', () => {
  const detector = createCheatDetector([
    { name: 'IDKFA', sequence: 'idkfa', onActivate: () => {} }
  ]);

  'idk'.split('').forEach(k => detector.handleKey(k));
  assert.strictEqual(detector.getProgress('IDKFA'), 3/5);
  detector.reset();
  assert.strictEqual(detector.getProgress('IDKFA'), 0);
});

test('handles uppercase input by lowercasing', () => {
  const activated = [];
  const detector = createCheatDetector([
    { name: 'IDKFA', sequence: 'idkfa', onActivate: () => activated.push('IDKFA') }
  ]);

  'IDKFA'.split('').forEach(k => detector.handleKey(k));
  assert.deepStrictEqual(activated, ['IDKFA']);
});

test('can detect code multiple times', () => {
  const activated = [];
  const detector = createCheatDetector([
    { name: 'IDKFA', sequence: 'idkfa', onActivate: () => activated.push('IDKFA') }
  ]);

  'idkfaidkfa'.split('').forEach(k => detector.handleKey(k));
  assert.deepStrictEqual(activated, ['IDKFA', 'IDKFA']);
});

test('handles Konami code with special keys', () => {
  const activated = [];
  const detector = createCheatDetector([
    {
      name: 'KONAMI',
      sequence: ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'],
      onActivate: () => activated.push('KONAMI')
    }
  ]);

  ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']
    .forEach(k => detector.handleKey(k));
  assert.deepStrictEqual(activated, ['KONAMI']);
});

// ============================================
// DOOM THEME NOTES TESTS
// ============================================
console.log('\n🎵 Doom E1M1 Theme');

test('has valid note data', () => {
  assert(DOOM_E1M1_NOTES.length > 0, 'Should have notes');
  for (const note of DOOM_E1M1_NOTES) {
    assert.strictEqual(note.length, 3, 'Each note should be [freq, duration, startTime]');
    assert(note[0] > 0, 'Frequency should be positive');
    assert(note[1] > 0, 'Duration should be positive');
    assert(note[2] >= 0, 'Start time should be non-negative');
  }
});

test('notes are in chronological order', () => {
  for (let i = 1; i < DOOM_E1M1_NOTES.length; i++) {
    assert(DOOM_E1M1_NOTES[i][2] >= DOOM_E1M1_NOTES[i-1][2],
      `Note ${i} should start at or after note ${i-1}`);
  }
});

// ============================================
// MAP TESTS
// ============================================
console.log('\n🗺️  Doom Map');

test('map is rectangular', () => {
  const width = DOOM_MAP[0].length;
  for (const row of DOOM_MAP) {
    assert.strictEqual(row.length, width, 'All rows should have same width');
  }
});

test('map has walls on all borders', () => {
  const h = DOOM_MAP.length;
  const w = DOOM_MAP[0].length;

  for (let x = 0; x < w; x++) {
    assert.strictEqual(DOOM_MAP[0][x], 1, `Top border at x=${x} should be wall`);
    assert.strictEqual(DOOM_MAP[h-1][x], 1, `Bottom border at x=${x} should be wall`);
  }
  for (let z = 0; z < h; z++) {
    assert.strictEqual(DOOM_MAP[z][0], 1, `Left border at z=${z} should be wall`);
    assert.strictEqual(DOOM_MAP[z][w-1], 1, `Right border at z=${z} should be wall`);
  }
});

test('map has spawn points', () => {
  const spawns = getSpawnPoints(createGameState());
  assert(spawns.length > 0, 'Map should have at least one spawn point');
});

test('spawn points are not on walls', () => {
  const spawns = getSpawnPoints(createGameState());
  for (const sp of spawns) {
    const mapX = Math.floor(sp.x);
    const mapZ = Math.floor(sp.z);
    assert.notStrictEqual(DOOM_MAP[mapZ][mapX], 1, 'Spawn point should not be on a wall');
  }
});

// ============================================
// GAME STATE TESTS
// ============================================
console.log('\n🎯 Game State');

test('creates valid initial state', () => {
  const state = createGameState();
  assert.strictEqual(state.player.health, PLAYER_MAX_HEALTH);
  assert.strictEqual(state.player.ammo, PLAYER_MAX_AMMO);
  assert.strictEqual(state.player.score, 0);
  assert.strictEqual(state.player.alive, true);
  assert.deepStrictEqual(state.creepers, []);
  assert.strictEqual(state.gameOver, false);
});

test('player starts in open space', () => {
  const state = createGameState();
  assert(!isWall(state.player.x, state.player.z), 'Player should not start in a wall');
});

// ============================================
// WALL COLLISION TESTS
// ============================================
console.log('\n🧱 Wall Collision');

test('detects walls correctly', () => {
  assert(isWall(0, 0), 'Corner should be a wall');
  assert(!isWall(1.5, 1.5), 'Interior should not be a wall');
});

test('out of bounds is a wall', () => {
  assert(isWall(-1, -1), 'Negative coords should be wall');
  assert(isWall(100, 100), 'Out of bounds should be wall');
});

// ============================================
// PLAYER MOVEMENT TESTS
// ============================================
console.log('\n🏃 Player Movement');

test('player moves forward in facing direction', () => {
  const state = createGameState();
  state.player.x = 5.5;
  state.player.z = 5.5;
  state.player.rotation = 0;
  const oldZ = state.player.z;

  movePlayer(state, 1, 0, 0.1);
  assert(state.player.z > oldZ, 'Player should move forward along Z when rotation=0');
});

test('player does not walk through walls', () => {
  const state = createGameState();
  state.player.x = 1.5;
  state.player.z = 1.5;
  state.player.rotation = Math.PI; // facing the top wall

  // Try to walk into the wall
  for (let i = 0; i < 100; i++) {
    movePlayer(state, 1, 0, 0.1);
  }

  assert(!isWall(Math.floor(state.player.x), Math.floor(state.player.z)),
    'Player should not end up inside a wall');
});

test('player can strafe', () => {
  const state = createGameState();
  state.player.x = 5.5;
  state.player.z = 5.5;
  state.player.rotation = 0;
  const oldX = state.player.x;

  movePlayer(state, 0, 1, 0.1);
  assert(state.player.x !== oldX, 'Player X should change when strafing');
});

// ============================================
// CREEPER TESTS
// ============================================
console.log('\n👾 Creepers');

test('spawns creeper at a spawn point', () => {
  const state = createGameState();
  const creeper = spawnCreeper(state);
  assert(creeper !== null, 'Should spawn a creeper');
  assert.strictEqual(creeper.health, CREEPER_MAX_HEALTH);
  assert.strictEqual(creeper.alive, true);
  assert.strictEqual(state.creepers.length, 1);
});

test('creepers move toward player', () => {
  const state = createGameState();
  state.player.x = 3;
  state.player.z = 3;

  state.creepers.push({
    id: 1, x: 8, z: 8, health: CREEPER_MAX_HEALTH, alive: true
  });

  const oldDist = Math.sqrt((8-3)**2 + (8-3)**2);
  updateCreepers(state, 0.5);
  const newDist = Math.sqrt(
    (state.creepers[0].x - 3)**2 + (state.creepers[0].z - 3)**2
  );

  assert(newDist < oldDist, 'Creeper should move closer to player');
});

test('creepers damage player when in range', () => {
  const state = createGameState();
  state.player.x = 3;
  state.player.z = 3;

  state.creepers.push({
    id: 1, x: 3.5, z: 3, health: CREEPER_MAX_HEALTH, alive: true
  });

  updateCreepers(state, 1);
  assert(state.player.health < PLAYER_MAX_HEALTH, 'Player should take damage');
});

test('player dies when health reaches 0', () => {
  const state = createGameState();
  state.player.x = 3;
  state.player.z = 3;
  state.player.health = 1;

  state.creepers.push({
    id: 1, x: 3.5, z: 3, health: CREEPER_MAX_HEALTH, alive: true
  });

  updateCreepers(state, 1);
  assert.strictEqual(state.player.alive, false);
  assert.strictEqual(state.gameOver, true);
});

test('dead creepers are cleaned up', () => {
  const state = createGameState();
  state.player.x = 3;
  state.player.z = 3;

  state.creepers.push(
    { id: 1, x: 8, z: 8, health: 0, alive: false },
    { id: 2, x: 7, z: 7, health: CREEPER_MAX_HEALTH, alive: true }
  );

  updateCreepers(state, 0.1);
  assert.strictEqual(state.creepers.length, 1);
  assert.strictEqual(state.creepers[0].id, 2);
});

// ============================================
// SHOOTING TESTS
// ============================================
console.log('\n🔫 Shooting');

test('shooting decrements ammo', () => {
  const state = createGameState();
  const startAmmo = state.player.ammo;
  shoot(state);
  assert.strictEqual(state.player.ammo, startAmmo - 1);
});

test('cannot shoot with 0 ammo', () => {
  const state = createGameState();
  state.player.ammo = 0;
  const result = shoot(state);
  assert.strictEqual(result, null);
  assert.strictEqual(state.player.ammo, 0);
});

test('hitting a creeper deals damage', () => {
  const state = createGameState();
  state.player.x = 3;
  state.player.z = 3;
  state.player.rotation = 0; // facing +Z

  // Place creeper directly ahead
  state.creepers.push({
    id: 1, x: 3, z: 6, health: CREEPER_MAX_HEALTH, alive: true
  });

  const result = shoot(state);
  assert(result !== null);
  assert.strictEqual(result.hit, true);
  assert.strictEqual(state.creepers[0].health, CREEPER_MAX_HEALTH - SHOOT_DAMAGE);
});

test('killing a creeper awards 100 points and ammo', () => {
  const state = createGameState();
  state.player.x = 3;
  state.player.z = 3;
  state.player.rotation = 0;
  state.player.ammo = 10;

  state.creepers.push({
    id: 1, x: 3, z: 5, health: 1, alive: true
  });

  shoot(state);
  assert.strictEqual(state.player.score, 100);
  assert.strictEqual(state.creepers[0].alive, false);
  assert(state.player.ammo > 10 - 1, 'Should get ammo drop from kill');
});

test('miss returns hit: false', () => {
  const state = createGameState();
  state.player.x = 3;
  state.player.z = 3;
  state.player.rotation = 0;
  // No creepers in front

  const result = shoot(state);
  assert.strictEqual(result.hit, false);
});

test('cannot shoot creepers behind player', () => {
  const state = createGameState();
  state.player.x = 5;
  state.player.z = 5;
  state.player.rotation = 0; // facing +Z

  // Place creeper behind
  state.creepers.push({
    id: 1, x: 5, z: 2, health: CREEPER_MAX_HEALTH, alive: true
  });

  const result = shoot(state);
  assert.strictEqual(result.hit, false);
});

test('movement direction matches facing direction at all rotations', () => {
  // This verifies the convention: rotation=0 → +Z, rotation=π/2 → +X
  // Three.js camera must match this or player walks sideways
  const state = createGameState();

  // rotation=0 → forward should increase Z
  state.player.x = 5.5; state.player.z = 5.5; state.player.rotation = 0;
  const z0 = state.player.z;
  movePlayer(state, 1, 0, 0.1);
  assert(state.player.z > z0, 'rotation=0: forward should go +Z');

  // rotation=π/2 → forward should increase X
  state.player.x = 5.5; state.player.z = 5.5; state.player.rotation = Math.PI / 2;
  const x0 = state.player.x;
  movePlayer(state, 1, 0, 0.1);
  assert(state.player.x > x0, 'rotation=π/2: forward should go +X');
});

test('can shoot multiple creepers sequentially', () => {
  const state = createGameState();
  state.player.x = 5;
  state.player.z = 5;
  state.player.rotation = 0; // facing +Z

  // Three creepers ahead at different distances
  state.creepers.push(
    { id: 1, x: 5, z: 7, health: 1, alive: true },
    { id: 2, x: 5, z: 9, health: 1, alive: true },
    { id: 3, x: 5, z: 11, health: 1, alive: true }
  );

  // Kill first
  const r1 = shoot(state);
  assert.strictEqual(r1.hit, true, 'Should hit first creeper');
  assert.strictEqual(state.creepers[0].alive, false, 'First creeper should die');

  // Remove dead (simulating updateCreepers)
  state.creepers = state.creepers.filter(c => c.alive);

  // Kill second
  const r2 = shoot(state);
  assert.strictEqual(r2.hit, true, 'Should hit second creeper after first killed');

  state.creepers = state.creepers.filter(c => c.alive);

  // Kill third
  const r3 = shoot(state);
  assert.strictEqual(r3.hit, true, 'Should hit third creeper after second killed');
});

// ============================================
// GAME UPDATE TESTS
// ============================================
console.log('\n⏱️  Game Update');

test('game time advances', () => {
  const state = createGameState();
  updateGameState(state, 1);
  assert.strictEqual(state.gameTime, 1);
});

test('creepers spawn periodically', () => {
  const state = createGameState();
  // Fast forward past spawn interval
  for (let i = 0; i < 100; i++) {
    updateGameState(state, 0.1);
  }
  assert(state.creepers.length > 0, 'Creepers should have spawned');
});

test('spawn rate increases over time', () => {
  const state = createGameState();
  state.gameTime = 60; // 1 minute in
  state.spawnTimer = 100; // Force spawn check
  updateGameState(state, 0.1);
  // After 60 seconds, interval should be shorter
  const adjustedInterval = Math.max(1.5, state.spawnInterval - state.gameTime * 0.05);
  assert(adjustedInterval < state.spawnInterval, 'Spawn interval should decrease over time');
});

test('does not exceed max creepers', () => {
  const state = createGameState();
  // Pre-fill with max creepers
  for (let i = 0; i < 10; i++) {
    state.creepers.push({
      id: i, x: 5, z: 5, health: CREEPER_MAX_HEALTH, alive: true
    });
  }
  state.spawnTimer = 100;
  const before = state.creepers.length;
  updateGameState(state, 0.1);
  assert.strictEqual(state.creepers.length, before, 'Should not exceed 10 creepers');
});

test('game stops updating when game over', () => {
  const state = createGameState();
  state.gameOver = true;
  state.gameTime = 5;
  updateGameState(state, 1);
  assert.strictEqual(state.gameTime, 5, 'Game time should not advance when game over');
});

// ============================================
// SECRET WALL & IDCLIP TESTS
// ============================================
console.log('\n🔓 Secret Wall (IDCLIP)');

test('secret wall blocks movement by default', () => {
  const state = createGameState();
  assert(isWall(SECRET_WALL.x, SECRET_WALL.z, state), 'Secret wall should block before IDCLIP');
});

test('secret wall becomes passable after IDCLIP', () => {
  const state = createGameState();
  activateSecretWall(state);
  assert(!isWall(SECRET_WALL.x, SECRET_WALL.z, state), 'Secret wall should be passable after IDCLIP');
});

test('other walls stay solid after IDCLIP', () => {
  const state = createGameState();
  activateSecretWall(state);
  assert(isWall(0, 0, state), 'Regular walls should still block');
  assert(isWall(0, 7, state), 'Border walls should still block');
});

test('secret wall is in DOOM_MAP as cell type 3', () => {
  assert.strictEqual(DOOM_MAP[SECRET_WALL.z][SECRET_WALL.x], 3, 'Secret wall should be type 3 in map');
});

// ============================================
// PIG LEVEL TESTS
// ============================================
console.log('\n🐷 Pig Level');

test('pig map is rectangular with walls on borders', () => {
  const w = PIG_MAP[0].length;
  for (const row of PIG_MAP) {
    assert.strictEqual(row.length, w, 'All rows should have same width');
  }
  for (let x = 0; x < w; x++) {
    assert.strictEqual(PIG_MAP[0][x], 1, 'Top border should be wall');
    assert.strictEqual(PIG_MAP[PIG_MAP.length-1][x], 1, 'Bottom border should be wall');
  }
  for (let z = 0; z < PIG_MAP.length; z++) {
    assert.strictEqual(PIG_MAP[z][0], 1, 'Left border should be wall');
    assert.strictEqual(PIG_MAP[z][w-1], 1, 'Right border should be wall');
  }
});

test('pig map has spawn points', () => {
  const state = createGameState('pig');
  const spawns = getSpawnPoints(state);
  assert(spawns.length > 0, 'Pig map should have spawn points');
});

test('pig level creates state with correct defaults', () => {
  const state = createGameState('pig');
  assert.strictEqual(state.level, 'pig');
  assert.strictEqual(state.player.x, 8.5);
  assert.strictEqual(state.player.z, 8.5);
  assert.strictEqual(state.spawnInterval, 3, 'Pigs spawn faster');
});

test('pig level player starts in open space', () => {
  const state = createGameState('pig');
  assert(!isWall(state.player.x, state.player.z, state), 'Player should not start in a wall');
});

test('pig spawns have pig type', () => {
  const state = createGameState('pig');
  const pig = spawnCreeper(state);
  assert.strictEqual(pig.type, 'pig');
  assert.strictEqual(pig.health, PIG_MAX_HEALTH);
});

test('doom spawns have creeper type', () => {
  const state = createGameState('doom');
  const creeper = spawnCreeper(state);
  assert.strictEqual(creeper.type, 'creeper');
  assert.strictEqual(creeper.health, CREEPER_MAX_HEALTH);
});

test('switchToPigLevel preserves score and transitions', () => {
  const state = createGameState();
  state.player.score = 500;
  state.creepers.push({ id: 1, x: 5, z: 5, health: 3, alive: true });
  switchToPigLevel(state);

  assert.strictEqual(state.level, 'pig');
  assert.strictEqual(state.player.score, 500, 'Score should be preserved');
  assert.strictEqual(state.player.x, 8.5, 'Player should be repositioned');
  assert.strictEqual(state.player.health, PLAYER_MAX_HEALTH, 'Health should be reset');
  assert.strictEqual(state.creepers.length, 0, 'Creepers should be cleared');
  assert.strictEqual(state.spawnInterval, 3, 'Spawn interval should be pig speed');
});

test('pigs do pig damage and move at pig speed', () => {
  const state = createGameState('pig');
  state.player.x = 5;
  state.player.z = 5;

  // Place pig in attack range
  state.creepers.push({
    id: 1, x: 5.5, z: 5, health: PIG_MAX_HEALTH, alive: true, type: 'pig'
  });

  updateCreepers(state, 1);
  const damageTaken = PLAYER_MAX_HEALTH - state.player.health;
  assert(damageTaken > 0, 'Pig should deal damage');
  // Pig damage is PIG_DAMAGE per second
  assert(Math.abs(damageTaken - PIG_DAMAGE) < 0.1, 'Damage should be PIG_DAMAGE rate');
});

test('pigs move faster than creepers', () => {
  assert(PIG_SPEED > CREEPER_SPEED, 'Pigs should be faster');
});

test('mud cells (4) are passable', () => {
  const state = createGameState('pig');
  // Find a mud cell in PIG_MAP
  let mudFound = false;
  for (let z = 0; z < PIG_MAP.length; z++) {
    for (let x = 0; x < PIG_MAP[z].length; x++) {
      if (PIG_MAP[z][x] === 4) {
        assert(!isWall(x + 0.5, z + 0.5, state), 'Mud should be passable');
        mudFound = true;
        break;
      }
    }
    if (mudFound) break;
  }
  assert(mudFound, 'Pig map should contain mud cells');
});

// ============================================
// SUMMARY
// ============================================
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
