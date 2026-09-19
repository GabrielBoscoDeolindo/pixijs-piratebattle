export interface GameConfig {
  arena: { width: number; height: number };
  match: { durationSeconds: number };
  player: {
    radius: number;
    moveSpeed: number;
    rotationSpeed: number;
    maxHealth: number;
  };
  projectile: {
    radius: number;
    speed: number;
    lifetime: number;
    damage: number;
  };
  weapons: {
    frontCooldown: number;
    broadsideCooldown: number;
    broadsideSpacing: number;
  };
  chaser: {
    maxHealth: number;
    radius: number;
    moveSpeed: number;
    rotationSpeed: number;
    collisionDamage: number;
    spawn: { x: number; y: number; rotation: number };
  };
  shooter: {
    maxHealth: number;
    radius: number;
    moveSpeed: number;
    rotationSpeed: number;
    preferredDistance: number;
    attackRange: number;
    aimTolerance: number;
    fireCooldown: number;
    projectile: {
      radius: number;
      speed: number;
      lifetime: number;
      damage: number;
    };
    spawn: { x: number; y: number; rotation: number };
  };
  spawn: {
    intervalSeconds: number;
    minimumPlayerDistance: number;
    maximumEnemies: number;
    chaserWeight: number;
    randomSeed: number;
    points: readonly { x: number; y: number }[];
  };
  effects: {
    explosionDuration: number;
    muzzleDuration: number;
    impactDuration: number;
  };
  islands: readonly {
    id: string;
    x: number;
    y: number;
    spriteSize: number;
    collisionPoints: readonly { x: number; y: number }[];
  }[];
}

const BASE_ISLAND_SIZE = 288;
const BASE_ISLAND_COLLISION_POINTS = [
  { x: -88, y: -142 },
  { x: 88, y: -142 },
  { x: 116, y: -134 },
  { x: 136, y: -112 },
  { x: 144, y: -82 },
  { x: 144, y: 82 },
  { x: 136, y: 110 },
  { x: 114, y: 132 },
  { x: 82, y: 142 },
  { x: -84, y: 142 },
  { x: -116, y: 132 },
  { x: -136, y: 110 },
  { x: -144, y: 80 },
  { x: -144, y: -82 },
  { x: -134, y: -114 },
  { x: -112, y: -134 },
] as const;

function createIslandCollisionPoints(spriteSize: number) {
  const scale = spriteSize / BASE_ISLAND_SIZE;
  return BASE_ISLAND_COLLISION_POINTS.map(({ x, y }) => ({
    x: x * scale,
    y: y * scale,
  }));
}

export const GAME_CONFIG = {
  arena: {
    width: 1600,
    height: 900,
  },
  match: {
    durationSeconds: 90,
  },
  player: {
    radius: 28,
    moveSpeed: 260,
    rotationSpeed: Math.PI * 0.95,
    maxHealth: 100,
  },
  projectile: {
    radius: 7,
    speed: 620,
    lifetime: 1.65,
    damage: 25,
  },
  weapons: {
    frontCooldown: 0.42,
    broadsideCooldown: 1.1,
    broadsideSpacing: 22,
  },
  chaser: {
    maxHealth: 75,
    radius: 30,
    moveSpeed: 112,
    rotationSpeed: Math.PI * 0.72,
    collisionDamage: 30,
    spawn: {
      x: 1260,
      y: 190,
      rotation: Math.PI / 2,
    },
  },
  shooter: {
    maxHealth: 100,
    radius: 30,
    moveSpeed: 82,
    rotationSpeed: Math.PI * 0.58,
    preferredDistance: 360,
    attackRange: 440,
    aimTolerance: 0.16,
    fireCooldown: 1.45,
    projectile: {
      radius: 7,
      speed: 390,
      lifetime: 2.4,
      damage: 12,
    },
    spawn: {
      x: 1220,
      y: 735,
      rotation: Math.PI / 2,
    },
  },
  spawn: {
    intervalSeconds: 6,
    minimumPlayerDistance: 480,
    maximumEnemies: 12,
    chaserWeight: 0.58,
    randomSeed: 73931,
    points: [
      { x: 100, y: 100 },
      { x: 800, y: 90 },
      { x: 1500, y: 100 },
      { x: 1500, y: 450 },
      { x: 1500, y: 800 },
      { x: 800, y: 810 },
      { x: 100, y: 800 },
      { x: 100, y: 450 },
    ],
  },
  effects: {
    explosionDuration: 0.42,
    muzzleDuration: 0.14,
    impactDuration: 0.18,
  },
  islands: [
    {
      id: 'central-island',
      x: 800,
      y: 450,
      spriteSize: 288,
      collisionPoints: createIslandCollisionPoints(288),
    },
    {
      id: 'south-west-reef',
      x: 235,
      y: 700,
      spriteSize: 154,
      collisionPoints: createIslandCollisionPoints(154),
    },
    {
      id: 'east-reef',
      x: 1390,
      y: 650,
      spriteSize: 174,
      collisionPoints: createIslandCollisionPoints(174),
    },
  ],
} satisfies GameConfig;
