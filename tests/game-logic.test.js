const assert = require('assert');
const {
  createCheatDetector,
  DOOM_E1M1_NOTES,
  DOOM_MAP,
  CREEPER_MAX_HEALTH,
  PLAYER_MAX_HEALTH,
  PLAYER_MAX_AMMO,
  SHOOT_DAMAGE,
  CREEPER_DAMAGE,
  CREEPER_ATTACK_RANGE,
  createGameState,
  getSpawnPoints,
  spawnCreeper,
  isWall,
  movePlayer,
  shoot,
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
  const spawns = getSpawnPoints();
  assert(spawns.length > 0, 'Map should have at least one spawn point');
});

test('spawn points are not on walls', () => {
  const spawns = getSpawnPoints();
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
// SUMMARY
// ============================================
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
