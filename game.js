// ============================================================
// THE GREAT ESCAPE - ZX Spectrum 1986 Replica
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('minimap');
const miniCtx = miniCanvas.getContext('2d');

// Responsive canvas sizing
const BASE_W = 640, BASE_H = 480;
canvas.width = BASE_W;
canvas.height = BASE_H;

// ---- ISOMETRIC CONFIG ----
const TILE_W = 32, TILE_H = 16, TILE_DEPTH = 8;
const ISO_ORIGIN_X = BASE_W / 2;
const ISO_ORIGIN_Y = 80;

// ---- TILE TYPES ----
const T = {
  GRASS: 0, FLOOR: 1, WALL_N: 2, WALL_E: 3, FENCE: 4,
  PATH: 5, DOOR: 6, BED: 7, TABLE: 8, GATE: 9,
  BUSH: 10, TREE: 11, ROAD: 12, WIRE: 13, TUNNEL_ENTRANCE: 14,
  EMPTY: 15, WALL_CORNER: 16, ROOF: 17, STEPS: 18
};

// ---- COLOURS ----
const PALETTE = {
  grass:     '#3a7d44', grassDark: '#2d6235', grassLight: '#4a9d56',
  floor:     '#c8b87a', floorDark: '#a89660', floorLight: '#d8c88a',
  wall:      '#8b7355', wallDark:  '#6b5535', wallLight:  '#ab9375',
  fence:     '#a0a0a0', fenceDark: '#606060',
  path:      '#b0956a', pathDark:  '#907545',
  door:      '#5a3a1a', doorLight: '#8a5a2a',
  bed:       '#4444aa', bedLight:  '#6666cc',
  table:     '#7a5a3a', tableLight:'#9a7a5a',
  gate:      '#888', gateLight:  '#aaa',
  bush:      '#2a6a2a', bushLight: '#3a8a3a',
  tree:      '#1a5a1a', treeTop:   '#2a8a2a',
  road:      '#555', roadLight:  '#777',
  wire:      '#cc0', wireLight:  '#ff0',
  sky:       '#001a33',
  player:    '#00ffff',
  guard:     '#ff4444',
  prisoner:  '#aaaaff',
  shadow:    'rgba(0,0,0,0.3)',
  highlight: 'rgba(255,255,255,0.15)'
};

// ============================================================
// WORLD MAP  (40 x 40 tiles)
// Each cell: { type, walkable, item, elevation }
// ============================================================

const MAP_W = 40, MAP_H = 40;
let world = [];
const buildingEntrances = {};

// Interior areas that load as dedicated screens when entered.
const INTERIORS = {
  barracks: {
    name: 'BARRACKS',
    width: 16,
    height: 10,
    exit: { x: 8, y: 9 },
    beds: [[3,2],[6,2],[10,2],[13,2],[3,6],[6,6],[10,6],[13,6]],
    tables: [[8,4]]
  },
  messHall: {
    name: 'MESS HALL',
    width: 16,
    height: 10,
    exit: { x: 8, y: 9 },
    beds: [],
    tables: [[4,3],[8,3],[12,3],[4,6],[8,6],[12,6]]
  },
  solitude: {
    name: 'SOLITUDE BLOCK',
    width: 12,
    height: 10,
    exit: { x: 6, y: 9 },
    beds: [[3,3],[8,3]],
    tables: [[6,6]]
  }
};

function createWorld() {
  world = [];
  // Rebuild entrance lookup whenever world is regenerated.
  Object.keys(buildingEntrances).forEach(k => delete buildingEntrances[k]);
  for (let y = 0; y < MAP_H; y++) {
    world[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      world[y][x] = { type: T.GRASS, walkable: true, item: null, elev: 0, solid: false };
    }
  }

  // Outer perimeter fence
  for (let x = 1; x < MAP_W-1; x++) {
    setTile(x, 1, T.FENCE, false);
    setTile(x, MAP_H-2, T.FENCE, false);
  }
  for (let y = 1; y < MAP_H-1; y++) {
    setTile(1, y, T.FENCE, false);
    setTile(MAP_W-2, y, T.FENCE, false);
  }

  // Inner fence (inner compound)
  for (let x = 6; x < 34; x++) {
    setTile(x, 6, T.FENCE, false);
    setTile(x, 33, T.FENCE, false);
  }
  for (let y = 6; y < 34; y++) {
    setTile(6, y, T.FENCE, false);
    setTile(33, y, T.FENCE, false);
  }

  // Main gate (south inner fence)
  setTile(19, 33, T.GATE, true); setTile(20, 33, T.GATE, true);

  // Outer gate (south outer fence)
  setTile(19, MAP_H-2, T.GATE, true); setTile(20, MAP_H-2, T.GATE, true);

  // Paths inside compound
  for (let x = 7; x < 33; x++) setTile(x, 20, T.PATH, true);
  for (let y = 7; y < 33; y++) setTile(19, y, T.PATH, true);

  // --- BARRACKS BUILDING (west) ---
  buildRoom(8, 8, 8, 6, 'barracks');    // Room 1
  buildRoom(8, 16, 8, 6, 'barracks');   // Room 2
  placeItem(9, 9, 'BED'); placeItem(11, 9, 'BED'); placeItem(13, 9, 'BED');
  placeItem(9, 17, 'BED'); placeItem(11, 17, 'BED'); placeItem(13, 17, 'BED');

  // --- GUARD HQ (east) ---
  buildRoom(24, 8, 7, 5);
  placeItem(25, 9, 'TABLE'); placeItem(27, 9, 'TABLE');

  // --- MESS HALL (center-south) ---
  buildRoom(15, 24, 9, 5, 'messHall');
  placeItem(16, 25, 'TABLE'); placeItem(18, 25, 'TABLE'); placeItem(20, 25, 'TABLE');

  // --- SOLITARY BLOCK ---
  buildRoom(26, 23, 5, 4, 'solitude');

  // --- TREES & BUSHES (outside perimeter) ---
  const treePos = [[3,3],[4,5],[36,3],[35,5],[3,36],[5,35],[36,36],[35,34]];
  treePos.forEach(([x,y]) => setTile(x, y, T.TREE, false));

  const bushPos = [[3,10],[3,18],[3,26],[36,10],[36,18],[36,26],[12,3],[25,3]];
  bushPos.forEach(([x,y]) => setTile(x, y, T.BUSH, false));

  // --- ROAD (outside, south) ---
  for (let x = 2; x < MAP_W-2; x++) {
    setTile(x, MAP_H-3, T.ROAD, true);
  }

  // --- TUNNEL ENTRANCE (hidden in barracks corner) ---
  setTile(9, 21, T.TUNNEL_ENTRANCE, true);

  // Place collectible items
  placeItem(14, 13, 'WIRECUTTERS');
  placeItem(29, 11, 'UNIFORM');
  placeItem(17, 28, 'MAP');
  placeItem(21, 14, 'COMPASS');
  placeItem(10, 22, 'ROPE');
  placeItem(28, 26, 'FOOD');
  placeItem(11, 13, 'KEY');
  placeItem(30, 16, 'CROWBAR');
}

function setTile(x, y, type, walkable, solid=true) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return;
  world[y][x].type = type;
  world[y][x].walkable = walkable;
  world[y][x].solid = solid || !walkable;
}

function placeItem(x, y, name) {
  if (world[y] && world[y][x]) world[y][x].item = name;
}

function buildRoom(rx, ry, rw, rh, interiorName = null) {
  for (let y = ry; y < ry+rh; y++) {
    for (let x = rx; x < rx+rw; x++) {
      if (y === ry || y === ry+rh-1 || x === rx || x === rx+rw-1) {
        setTile(x, y, T.WALL_N, false);
      } else {
        setTile(x, y, T.FLOOR, true);
        world[y][x].solid = false;
      }
    }
  }
  // Door on south wall center. If this room has an interior map, register the entrance.
  const doorX = rx + Math.floor(rw/2);
  const doorY = ry + rh - 1;
  setTile(doorX, doorY, T.DOOR, true);
  world[doorY][doorX].solid = false;
  if (interiorName) {
    buildingEntrances[`${doorX},${doorY}`] = interiorName;
  }
}

// ============================================================
// ISOMETRIC RENDERING
// ============================================================

function isoToScreen(tx, ty) {
  return {
    x: ISO_ORIGIN_X + (tx - ty) * (TILE_W / 2),
    y: ISO_ORIGIN_Y + (tx + ty) * (TILE_H / 2)
  };
}

function screenToIso(sx, sy) {
  const relX = sx - ISO_ORIGIN_X;
  const relY = sy - ISO_ORIGIN_Y;
  return {
    x: (relX / (TILE_W/2) + relY / (TILE_H/2)) / 2,
    y: (relY / (TILE_H/2) - relX / (TILE_W/2)) / 2
  };
}

function drawTileTop(sx, sy, color, highlight, dark) {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + TILE_W/2, sy + TILE_H/2);
  ctx.lineTo(sx + TILE_W, sy);
  ctx.lineTo(sx + TILE_W/2, sy - TILE_H/2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (highlight) {
    ctx.fillStyle = PALETTE.highlight;
    ctx.fill();
  }
}

function drawTileLeft(sx, sy, h, color) {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx, sy + h);
  ctx.lineTo(sx + TILE_W/2, sy + h + TILE_H/2);
  ctx.lineTo(sx + TILE_W/2, sy + TILE_H/2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTileRight(sx, sy, h, color) {
  ctx.beginPath();
  ctx.moveTo(sx + TILE_W/2, sy + TILE_H/2);
  ctx.lineTo(sx + TILE_W/2, sy + h + TILE_H/2);
  ctx.lineTo(sx + TILE_W, sy + h);
  ctx.lineTo(sx + TILE_W, sy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawIsoTile(tx, ty, tile) {
  const { x: sx, y: sy } = isoToScreen(tx, ty);
  const scrX = sx - TILE_W/2;
  const scrY = sy - TILE_H/2;

  // Cull off-screen
  if (scrX + TILE_W < 0 || scrX > BASE_W || scrY + 60 < 0 || scrY > BASE_H) return;

  const t = tile.type;

  // Ground layer
  let topColor = PALETTE.grass;
  let leftColor = PALETTE.grassDark;
  let rightColor = PALETTE.grassDark;
  let wallH = 0;

  if (t === T.FLOOR) { topColor = PALETTE.floor; leftColor = PALETTE.floorDark; rightColor = PALETTE.floorDark; }
  else if (t === T.PATH || t === T.ROAD) { topColor = PALETTE.path; leftColor = PALETTE.pathDark; rightColor = PALETTE.pathDark; }
  else if (t === T.FENCE || t === T.WIRE) {
    // Draw ground first then fence post
    drawTileTop(scrX, scrY, PALETTE.grass, false, false);
    drawFence(scrX, scrY, t === T.WIRE);
    return;
  }
  else if (t === T.WALL_N || t === T.WALL_E || t === T.WALL_CORNER) {
    topColor = PALETTE.wall; leftColor = PALETTE.wallDark; rightColor = PALETTE.wallDark;
    wallH = TILE_DEPTH * 3;
  }
  else if (t === T.DOOR) {
    topColor = PALETTE.floor;
    drawTileTop(scrX, scrY, topColor, false, false);
    drawDoor(scrX, scrY);
    return;
  }
  else if (t === T.GATE) {
    topColor = PALETTE.grass;
    drawTileTop(scrX, scrY, topColor, false, false);
    drawGate(scrX, scrY);
    return;
  }
  else if (t === T.TREE) { drawTree(scrX, scrY); return; }
  else if (t === T.BUSH) { drawBush(scrX, scrY); return; }
  else if (t === T.BED) {
    drawTileTop(scrX, scrY, PALETTE.floor, false, false);
    drawBed(scrX, scrY);
    return;
  }
  else if (t === T.TABLE) {
    drawTileTop(scrX, scrY, PALETTE.floor, false, false);
    drawTable(scrX, scrY);
    return;
  }
  else if (t === T.TUNNEL_ENTRANCE) {
    topColor = PALETTE.floor;
    drawTileTop(scrX, scrY, topColor, false, false);
    drawTunnelEntrance(scrX, scrY);
    return;
  }

  if (wallH > 0) {
    drawTileLeft(scrX, scrY - wallH, wallH, leftColor);
    drawTileRight(scrX, scrY - wallH, wallH, rightColor);
    drawTileTop(scrX, scrY - wallH, topColor, true, false);
  } else {
    drawTileTop(scrX, scrY, topColor, false, false);
  }

  // Tile outline
  ctx.beginPath();
  ctx.moveTo(scrX + TILE_W/2, scrY - TILE_H/2);
  ctx.lineTo(scrX + TILE_W, scrY);
  ctx.lineTo(scrX + TILE_W/2, scrY + TILE_H/2);
  ctx.lineTo(scrX, scrY);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Draw item on tile
  if (tile.item) drawItemSprite(scrX, scrY, tile.item);
}

function drawFence(sx, sy, isWire) {
  const color = isWire ? PALETTE.wire : PALETTE.fence;
  // Post
  ctx.fillStyle = color;
  ctx.fillRect(sx + TILE_W/2 - 2, sy - 12, 4, 12);
  // Wire lines
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx + 2, sy - 8); ctx.lineTo(sx + TILE_W - 2, sy - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx + 2, sy - 4); ctx.lineTo(sx + TILE_W - 2, sy - 4); ctx.stroke();
}

function drawDoor(sx, sy) {
  ctx.fillStyle = PALETTE.door;
  ctx.fillRect(sx + TILE_W/2 - 5, sy - 14, 10, 14);
  ctx.fillStyle = PALETTE.doorLight;
  ctx.fillRect(sx + TILE_W/2 - 1, sy - 10, 2, 4);
}

function drawGate(sx, sy) {
  ctx.strokeStyle = PALETTE.gate;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(sx + 6 + i*6, sy - 14);
    ctx.lineTo(sx + 6 + i*6, sy);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(sx + 4, sy - 10); ctx.lineTo(sx + TILE_W - 4, sy - 10); ctx.stroke();
}

function drawTree(sx, sy) {
  // Trunk
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(sx + TILE_W/2 - 3, sy - 10, 6, 10);
  // Canopy layers
  const layers = [
    { r: 12, y: -22, color: '#1a6a1a' },
    { r: 10, y: -30, color: '#2a8a2a' },
    { r: 7, y: -36, color: '#3aaa3a' }
  ];
  layers.forEach(l => {
    ctx.beginPath();
    ctx.ellipse(sx + TILE_W/2, sy + l.y, l.r, l.r * 0.6, 0, 0, Math.PI*2);
    ctx.fillStyle = l.color;
    ctx.fill();
  });
}

function drawBush(sx, sy) {
  ctx.beginPath();
  ctx.ellipse(sx + TILE_W/2, sy - 4, 10, 6, 0, 0, Math.PI*2);
  ctx.fillStyle = PALETTE.bush;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(sx + TILE_W/2 - 4, sy - 6, 6, 5, 0, 0, Math.PI*2);
  ctx.fillStyle = PALETTE.bushLight;
  ctx.fill();
}

function drawBed(sx, sy) {
  ctx.fillStyle = PALETTE.bed;
  ctx.fillRect(sx + 4, sy - 8, TILE_W - 8, 6);
  ctx.fillStyle = PALETTE.bedLight;
  ctx.fillRect(sx + 4, sy - 8, TILE_W - 8, 2);
  // Pillow
  ctx.fillStyle = '#fff';
  ctx.fillRect(sx + 5, sy - 8, 8, 4);
}

function drawTable(sx, sy) {
  ctx.fillStyle = PALETTE.table;
  ctx.fillRect(sx + 6, sy - 10, TILE_W - 12, 8);
  ctx.fillStyle = PALETTE.tableLight;
  ctx.fillRect(sx + 6, sy - 10, TILE_W - 12, 2);
  // Legs
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(sx + 7, sy - 2, 3, 4);
  ctx.fillRect(sx + TILE_W - 10, sy - 2, 3, 4);
}

function drawTunnelEntrance(sx, sy) {
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(sx + TILE_W/2, sy - 2, 6, 4, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawItemSprite(sx, sy, item) {
  const colors = {
    WIRECUTTERS: '#ff0', UNIFORM: '#44f', MAP: '#fff',
    COMPASS: '#0ff', ROPE: '#a85', FOOD: '#f80',
    KEY: '#ff0', CROWBAR: '#aaa'
  };
  ctx.fillStyle = colors[item] || '#f0f';
  ctx.beginPath();
  ctx.arc(sx + TILE_W/2, sy - 6, 4, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Pulsing glow effect
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);
  ctx.beginPath();
  ctx.arc(sx + TILE_W/2, sy - 6, 4 + pulse*3, 0, Math.PI*2);
  ctx.strokeStyle = (colors[item] || '#f0f');
  ctx.globalAlpha = 0.4 * pulse;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ============================================================
// ENTITIES
// ============================================================

class Entity {
  constructor(x, y, color, name) {
    this.x = x; this.y = y;
    this.color = color; this.name = name;
    this.dx = 0; this.dy = 0;
    this.facing = 'S'; // N S E W
    this.animFrame = 0; this.animTimer = 0;
  }

  draw(camX, camY) {
    const wx = this.x - camX;
    const wy = this.y - camY;
    const { x: sx, y: sy } = isoToScreen(wx, wy);
    this.drawSprite(sx - TILE_W/2, sy - TILE_H/2);
  }

  drawSprite(sx, sy) {
    const legOffset = [0, 2, 0, -2][Math.floor(this.animFrame) % 4];
    // Shadow
    ctx.beginPath();
    ctx.ellipse(sx + TILE_W/2, sy + 2, 7, 3, 0, 0, Math.PI*2);
    ctx.fillStyle = PALETTE.shadow;
    ctx.fill();
    // Body
    ctx.fillStyle = this.color;
    ctx.fillRect(sx + TILE_W/2 - 5, sy - 18, 10, 10);
    // Head
    ctx.fillRect(sx + TILE_W/2 - 4, sy - 28, 8, 8);
    // Legs
    ctx.fillStyle = darken(this.color, 0.5);
    ctx.fillRect(sx + TILE_W/2 - 5, sy - 8, 4, 8 + legOffset);
    ctx.fillRect(sx + TILE_W/2 + 1, sy - 8, 4, 8 - legOffset);
    // Eyes
    ctx.fillStyle = '#000';
    if (this.facing === 'S' || this.facing === 'E') {
      ctx.fillRect(sx + TILE_W/2 - 2, sy - 25, 2, 2);
      ctx.fillRect(sx + TILE_W/2 + 1, sy - 25, 2, 2);
    }
  }
}

function darken(hex, factor) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.floor(r*factor)},${Math.floor(g*factor)},${Math.floor(b*factor)})`;
}

class Player extends Entity {
  constructor(x, y) {
    super(x, y, PALETTE.player, 'PLAYER');
    this.energy = 100;
    this.suspicion = 0;
    this.items = [];
    // Lower movement speed to make navigation and NPC motion feel grounded.
    this.speed = 0.03;
    this.disguised = false;
    this.caught = false;
    this.escaped = false;
    this.hasTunneled = false;
  }

  update(dt, keys) {
    if (this.caught || this.escaped) return;
    let mx = 0, my = 0;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) my -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) my += 1;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) mx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;

    if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }

    const nx = this.x + mx * this.speed * dt;
    const ny = this.y + my * this.speed * dt;

    if (canMove(nx, this.y)) this.x = nx;
    if (canMove(this.x, ny)) this.y = ny;

    // Clamp to world
    this.x = Math.max(0.5, Math.min(MAP_W - 1.5, this.x));
    this.y = Math.max(0.5, Math.min(MAP_H - 1.5, this.y));

    if (mx !== 0 || my !== 0) {
      this.animTimer += dt;
      if (this.animTimer > 8) { this.animFrame++; this.animTimer = 0; }
      this.facing = my > 0 ? 'S' : my < 0 ? 'N' : mx > 0 ? 'E' : 'W';
    }

    // Energy drain
    if (mx !== 0 || my !== 0) {
      this.energy = Math.max(0, this.energy - 0.005 * dt);
    }
    // Suspicion decay
    this.suspicion = Math.max(0, this.suspicion - 0.02 * dt);
  }

  drawSprite(sx, sy) {
    const legOffset = [0, 2, 0, -2][Math.floor(this.animFrame) % 4];
    // Shadow
    ctx.beginPath();
    ctx.ellipse(sx + TILE_W/2, sy + 2, 7, 3, 0, 0, Math.PI*2);
    ctx.fillStyle = PALETTE.shadow;
    ctx.fill();
    // Body (different if disguised)
    const bodyColor = this.disguised ? '#cc6622' : PALETTE.player;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(sx + TILE_W/2 - 5, sy - 18, 10, 10);
    // Head
    ctx.fillStyle = '#f5c58a';
    ctx.fillRect(sx + TILE_W/2 - 4, sy - 28, 8, 8);
    // Hat
    ctx.fillStyle = this.disguised ? '#444' : '#003366';
    ctx.fillRect(sx + TILE_W/2 - 5, sy - 30, 10, 3);
    // Legs
    ctx.fillStyle = this.disguised ? '#556' : '#003388';
    ctx.fillRect(sx + TILE_W/2 - 5, sy - 8, 4, 8 + legOffset);
    ctx.fillRect(sx + TILE_W/2 + 1, sy - 8, 4, 8 - legOffset);
    // Player indicator arrow
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.moveTo(sx + TILE_W/2, sy - 36);
    ctx.lineTo(sx + TILE_W/2 - 4, sy - 30);
    ctx.lineTo(sx + TILE_W/2 + 4, sy - 30);
    ctx.closePath();
    ctx.fill();
  }
}

class Guard extends Entity {
  constructor(x, y, patrolPoints) {
    super(x, y, PALETTE.guard, 'GUARD');
    this.patrol = patrolPoints;
    this.patrolIdx = 0;
    this.state = 'PATROL'; // PATROL, CHASE, ALERT, SEARCH
    this.alertTimer = 0;
    this.searchTimer = 0;
    this.lastSeenX = x; this.lastSeenY = y;
    // Guards move more deliberately to avoid "flying" behavior.
    this.speed = 0.022;
    this.visionRange = 6;
    this.visionAngle = Math.PI / 2;
  }

  update(dt, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    const canSee = dist < this.visionRange && hasLineOfSight(this.x, this.y, player.x, player.y);

    switch (this.state) {
      case 'PATROL':
        this.doPatrol(dt);
        if (canSee && !player.disguised) {
          this.state = 'CHASE';
          showMessage('GUARD SPOTTED YOU!', '#f00');
          addSuspicion(30);
        } else if (canSee && player.disguised) {
          addSuspicion(1 * dt / 16);
        }
        break;

      case 'CHASE':
        this.moveTo(player.x, player.y, dt, this.speed * 1.4);
        if (dist < 1) {
          player.caught = true;
          showMessage('CAUGHT! YOU ARE IN SOLITARY!', '#f00');
          gameState.phase = 'CAUGHT';
        }
        if (!canSee) {
          this.state = 'SEARCH';
          this.lastSeenX = player.x;
          this.lastSeenY = player.y;
          this.searchTimer = 300;
        }
        addSuspicion(2 * dt / 16);
        break;

      case 'SEARCH':
        this.moveTo(this.lastSeenX, this.lastSeenY, dt, this.speed);
        this.searchTimer -= dt;
        if (this.searchTimer <= 0) {
          this.state = 'PATROL';
          showMessage('Guard gave up searching', '#ff0');
        }
        if (canSee && !player.disguised) {
          this.state = 'CHASE';
          addSuspicion(20);
        }
        break;

      case 'ALERT':
        this.alertTimer -= dt;
        if (this.alertTimer <= 0) this.state = 'PATROL';
        break;
    }
  }

  doPatrol(dt) {
    if (this.patrol.length === 0) return;
    const target = this.patrol[this.patrolIdx];
    const moved = this.moveTo(target[0], target[1], dt, this.speed);
    if (moved < 0.5) {
      this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
    }
  }

  moveTo(tx, ty, dt, spd) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.1) return dist;
    const nx = this.x + (dx/dist) * spd * dt;
    const ny = this.y + (dy/dist) * spd * dt;
    if (canMove(nx, this.y)) this.x = nx;
    if (canMove(this.x, ny)) this.y = ny;
    if (dx !== 0 || dy !== 0) {
      this.animTimer += dt;
      if (this.animTimer > 10) { this.animFrame++; this.animTimer = 0; }
    }
    return dist;
  }

  drawSprite(sx, sy) {
    const legOffset = [0, 2, 0, -2][Math.floor(this.animFrame) % 4];
    // Shadow
    ctx.beginPath();
    ctx.ellipse(sx + TILE_W/2, sy + 2, 7, 3, 0, 0, Math.PI*2);
    ctx.fillStyle = PALETTE.shadow;
    ctx.fill();
    // Body - grey uniform
    ctx.fillStyle = '#888';
    ctx.fillRect(sx + TILE_W/2 - 5, sy - 18, 10, 10);
    // Head
    ctx.fillStyle = '#d4a06a';
    ctx.fillRect(sx + TILE_W/2 - 4, sy - 28, 8, 8);
    // Helmet
    ctx.fillStyle = '#446644';
    ctx.fillRect(sx + TILE_W/2 - 5, sy - 30, 10, 4);
    ctx.fillRect(sx + TILE_W/2 - 6, sy - 28, 12, 2);
    // Legs
    ctx.fillStyle = '#555';
    ctx.fillRect(sx + TILE_W/2 - 5, sy - 8, 4, 8 + legOffset);
    ctx.fillRect(sx + TILE_W/2 + 1, sy - 8, 4, 8 - legOffset);
    // Alert indicator
    if (this.state === 'CHASE') {
      ctx.fillStyle = '#f00';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('!', sx + TILE_W/2 - 3, sy - 32);
    } else if (this.state === 'SEARCH') {
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('?', sx + TILE_W/2 - 3, sy - 32);
    }
    // Vision cone
    if (this.state === 'PATROL' || this.state === 'SEARCH') {
      drawVisionCone(sx + TILE_W/2, sy - 12, this);
    }
  }
}

function drawVisionCone(sx, sy, guard) {
  // Simplified direction based on patrol movement
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  const angleRad = Math.atan2(guard.y - (guard.patrol[guard.patrolIdx] ? guard.patrol[guard.patrolIdx][1] : guard.y),
                               guard.x - (guard.patrol[guard.patrolIdx] ? guard.patrol[guard.patrolIdx][0] : guard.x));
  const spread = 0.6;
  ctx.arc(sx, sy, guard.visionRange * 14, angleRad - spread, angleRad + spread);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

class Prisoner extends Entity {
  constructor(x, y) {
    super(x, y, PALETTE.prisoner, 'PRISONER');
    // Time in milliseconds; longer windows prevent jittery path changes.
    this.roamTimer = 1500 + Math.random() * 2000;
    this.roamTarget = { x, y };
    // Prisoners should roam slowly to keep scenes readable.
    this.speed = 0.014;
  }

  update(dt) {
    this.roamTimer -= dt;
    if (this.roamTimer <= 0) {
      this.roamTimer = 2000 + Math.random() * 2500;
      this.roamTarget = {
        x: 7 + Math.random() * 25,
        y: 7 + Math.random() * 25
      };
    }
    this.moveTo(this.roamTarget.x, this.roamTarget.y, dt);
    this.animTimer += dt * 0.5;
    if (this.animTimer > 10) { this.animFrame++; this.animTimer = 0; }
  }

  moveTo(tx, ty, dt) {
    const dx = tx - this.x; const dy = ty - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.3) return;
    const nx = this.x + (dx/dist) * this.speed * dt;
    const ny = this.y + (dy/dist) * this.speed * dt;
    if (canMove(nx, this.y)) this.x = nx;
    if (canMove(this.x, ny)) this.y = ny;
  }
}

// ============================================================
// COLLISION DETECTION
// ============================================================

function isInteriorObstacle(interior, tx, ty) {
  return interior.beds.some(([bx, by]) => bx === tx && by === ty)
    || interior.tables.some(([tx2, ty2]) => tx2 === tx && ty2 === ty);
}

function canMove(x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);

  // Interior movement has different bounds and collision rules.
  if (gameState.activeInterior) {
    const interior = INTERIORS[gameState.activeInterior];
    if (!interior) return false;
    if (tx < 1 || tx >= interior.width - 1 || ty < 1 || ty >= interior.height - 1) {
      return false;
    }
    return !isInteriorObstacle(interior, tx, ty);
  }

  if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return false;
  const tile = world[ty][tx];
  return tile.walkable;
}

function hasLineOfSight(x1, y1, x2, y2) {
  if (gameState.activeInterior) return true;
  const steps = 20;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = x1 + (x2-x1)*t;
    const cy = y1 + (y2-y1)*t;
    const tile = world[Math.floor(cy)] && world[Math.floor(cy)][Math.floor(cx)];
    if (tile && !tile.walkable && tile.type !== T.FENCE && tile.type !== T.WIRE) return false;
  }
  return true;
}

// ============================================================
// GAME STATE & SCHEDULE
// ============================================================

const SCHEDULE = [
  { time:  6*60, name: 'WAKE UP',    activity: 'wakeup'  },
  { time:  7*60, name: 'ROLL CALL',  activity: 'rollcall', rollCallX: 19, rollCallY: 15 },
  { time:  8*60, name: 'BREAKFAST',  activity: 'mess',     messX: 19, messY: 27 },
  { time: 10*60, name: 'FREE TIME',  activity: 'free'    },
  { time: 12*60, name: 'LUNCH',      activity: 'mess'    },
  { time: 13*60, name: 'FREE TIME',  activity: 'free'    },
  { time: 18*60, name: 'DINNER',     activity: 'mess'    },
  { time: 19*60, name: 'ROLL CALL',  activity: 'rollcall' },
  { time: 20*60, name: 'FREE TIME',  activity: 'free'    },
  { time: 22*60, name: 'LIGHTS OUT', activity: 'sleep'   }
];

let gameState = {
  phase: 'TITLE',
  time: 6*60,       // minutes since midnight
  // Slower clock so schedule transitions do not feel rushed.
  timeScale: 0.35,     // 0.35 game-min per second
  suspicion: 0,
  scheduleIdx: 0,
  rollCallMissed: 0,
  keys: {},
  messages: [],
  frameCount: 0,
  camera: { x: 14, y: 14 },
  dayCount: 1,
  currentActivity: 'wakeup',
  tunnelProgress: 0,
  escapePhase: 'none',
  activeInterior: null,
  lastExteriorDoor: null
};

let player, guards, prisoners;

function initGame() {
  createWorld();
  player = new Player(19, 18);
  player.energy = 100;
  player.suspicion = 0;
  player.items = [];
  player.disguised = false;
  player.caught = false;
  player.escaped = false;

  // Guards with patrol routes
  guards = [
    new Guard(10, 8,  [[10,8],[20,8],[20,15],[10,15]]),
    new Guard(25, 10, [[25,10],[30,10],[30,20],[25,20]]),
    new Guard(15, 30, [[15,30],[25,30],[25,25],[15,25]]),
    new Guard(19, 7,  [[19,7],[30,7],[30,12],[19,12]]),
    new Guard(8,  25, [[8,25],[16,25],[16,28],[8,28]]),
    new Guard(28, 15, [[28,15],[32,15],[32,28],[28,28]]),
  ];

  prisoners = [
    new Prisoner(12, 18), new Prisoner(16, 22),
    new Prisoner(22, 18), new Prisoner(18, 12),
    new Prisoner(24, 24)
  ];

  gameState.time = 6*60;
  gameState.scheduleIdx = 0;
  gameState.rollCallMissed = 0;
  gameState.phase = 'PLAYING';
  gameState.suspicion = 0;
  gameState.dayCount = 1;
  gameState.tunnelProgress = 0;
  gameState.escapePhase = 'none';
  gameState.activeInterior = null;
  gameState.lastExteriorDoor = null;
}

function getCurrentSchedule() {
  let current = SCHEDULE[0];
  for (let i = 0; i < SCHEDULE.length; i++) {
    if (gameState.time >= SCHEDULE[i].time) current = SCHEDULE[i];
    else break;
  }
  return current;
}

function formatTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function addSuspicion(amount) {
  player.suspicion = Math.min(100, player.suspicion + amount);
  gameState.suspicion = player.suspicion;
  if (player.suspicion >= 100) {
    gameState.phase = 'CAUGHT';
    player.caught = true;
    showMessage('SUSPICION TOO HIGH! CAUGHT!', '#f00');
  }
}

// ============================================================
// MESSAGES
// ============================================================

function showMessage(text, color = '#ff0') {
  gameState.messages.push({ text, color, timer: 180 });
  if (gameState.messages.length > 4) gameState.messages.shift();
  renderMessages();
}

function renderMessages() {
  const div = document.getElementById('messages');
  div.innerHTML = gameState.messages
    .filter(m => m.timer > 0)
    .map(m => `<div class="message" style="color:${m.color}">${m.text}</div>`)
    .join('');
}

// ============================================================
// PICK UP ITEMS
// ============================================================


function tryPickup() {
  if (gameState.activeInterior) {
    showMessage('No useful items here. Press F to exit building.', '#aaa');
    return;
  }

  const tx = Math.floor(player.x);
  const ty = Math.floor(player.y);
  // Check surrounding tiles
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
      const tile = world[ny][nx];
      if (tile.item) {
        const item = tile.item;
        tile.item = null;
        player.items.push(item);
        showMessage(`Picked up: ${item}`, '#0ff');
        if (item === 'UNIFORM') {
          player.disguised = true;
          showMessage('You are now disguised!', '#0f0');
        }
        updateItemList();
        checkEscapeReady();
        return;
      }
    }
  }
  // Try tunnel
  const cur = world[ty][tx];
  if (cur.type === T.TUNNEL_ENTRANCE) {
    tryUseTunnel();
  }
}

function tryInteract() {
  if (gameState.activeInterior) {
    tryExitBuilding();
    return;
  }

  const tx = Math.floor(player.x);
  const ty = Math.floor(player.y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const key = `${tx + dx},${ty + dy}`;
      if (buildingEntrances[key]) {
        enterBuilding(buildingEntrances[key], key);
        return;
      }
    }
  }
  showMessage('No doorway nearby. Move to a building door to enter.', '#aaa');
}

function enterBuilding(interiorName, doorKey) {
  const interior = INTERIORS[interiorName];
  if (!interior) return;
  gameState.activeInterior = interiorName;
  gameState.lastExteriorDoor = doorKey;
  player.x = interior.exit.x;
  player.y = interior.exit.y - 1;
  player.suspicion = Math.max(0, player.suspicion - 2);
  showMessage(`Entered ${interior.name}. Press F to exit.`, '#0ff');
}

function tryExitBuilding() {
  const interior = INTERIORS[gameState.activeInterior];
  if (!interior) return;
  const tx = Math.floor(player.x);
  const ty = Math.floor(player.y);
  const nearExit = Math.abs(tx - interior.exit.x) <= 1 && Math.abs(ty - interior.exit.y) <= 1;
  if (!nearExit) {
    showMessage('Find the exit door tile to leave this building.', '#ff0');
    return;
  }
  const [doorX, doorY] = (gameState.lastExteriorDoor || '19,20').split(',').map(Number);
  player.x = doorX + 0.5;
  player.y = doorY + 1.1;
  gameState.activeInterior = null;
  showMessage('Back outside. Guards can see you again.', '#0ff');
}

function checkEscapeReady() {
  const has = (i) => player.items.includes(i);
  if (has('WIRECUTTERS') && has('MAP') && has('COMPASS') && has('UNIFORM')) {
    showMessage('You have everything to escape via wire!', '#0f0');
  }
  if (has('MAP') && has('COMPASS') && has('FOOD')) {
    showMessage('Ready to escape via tunnel if opened!', '#0f0');
  }
}

function tryUseTunnel() {
  const has = (i) => player.items.includes(i);
  if (!has('CROWBAR')) {
    showMessage('You need a CROWBAR to open the tunnel!', '#f80');
    return;
  }
  gameState.tunnelProgress++;
  if (gameState.tunnelProgress >= 3) {
    if (!has('MAP') || !has('COMPASS')) {
      showMessage('You need a MAP and COMPASS to escape!', '#f80');
      return;
    }
    triggerEscape('tunnel');
  } else {
    showMessage(`Digging tunnel... (${gameState.tunnelProgress}/3)`, '#ff0');
  }
}

function tryEscapeViaWire() {
  const has = (i) => player.items.includes(i);
  if (!has('WIRECUTTERS')) { showMessage('Need WIRECUTTERS!', '#f80'); return false; }
  if (!has('MAP'))          { showMessage('Need MAP!', '#f80'); return false; }
  if (!has('COMPASS'))      { showMessage('Need COMPASS!', '#f80'); return false; }
  if (!has('UNIFORM'))      { showMessage('Need UNIFORM (disguise)!', '#f80'); return false; }
  return true;
}

function triggerEscape(method) {
  player.escaped = true;
  gameState.phase = 'WIN';
  showMessage(`ESCAPE SUCCESSFUL via ${method.toUpperCase()}!`, '#0f0');
  setTimeout(() => showWinScreen(method), 500);
}

// ============================================================
// CHECK ESCAPE VIA GATE
// ============================================================

function checkGateEscape() {
  const tx = Math.floor(player.x);
  const ty = Math.floor(player.y);
  const tile = world[ty] && world[ty][tx];
  if (!tile) return;
  // South outer gate
  if ((tx === 19 || tx === 20) && ty >= MAP_H-3) {
    if (tryEscapeViaWire()) {
      triggerEscape('wire cutting');
    }
  }
}

// ============================================================
// ROLL CALL CHECK
// ============================================================

function checkRollCall() {
  const schedule = getCurrentSchedule();
  if (schedule.activity !== 'rollcall') return;
  const dx = Math.abs(player.x - 19);
  const dy = Math.abs(player.y - 15);
  if (dx < 3 && dy < 3) {
    showMessage('Present at roll call!', '#0f0');
    player.suspicion = Math.max(0, player.suspicion - 15);
  } else {
    gameState.rollCallMissed++;
    addSuspicion(25);
    showMessage(`MISSED ROLL CALL (${gameState.rollCallMissed}x)!`, '#f00');
    if (gameState.rollCallMissed >= 3) {
      gameState.phase = 'CAUGHT';
      player.caught = true;
      showMessage('TOO MANY MISSED ROLL CALLS!', '#f00');
    }
  }
}

// ============================================================
// CAMERA
// ============================================================

const CAM_TILES_X = 18;
const CAM_TILES_Y = 18;

function updateCamera() {
  const targetX = player.x - CAM_TILES_X / 2;
  const targetY = player.y - CAM_TILES_Y / 2;
  gameState.camera.x += (targetX - gameState.camera.x) * 0.1;
  gameState.camera.y += (targetY - gameState.camera.y) * 0.1;
  gameState.camera.x = Math.max(0, Math.min(MAP_W - CAM_TILES_X, gameState.camera.x));
  gameState.camera.y = Math.max(0, Math.min(MAP_H - CAM_TILES_Y, gameState.camera.y));
}

// ============================================================
// RENDER
// ============================================================

function renderWorld() {
  const camX = gameState.camera.x;
  const camY = gameState.camera.y;

  // Draw tiles in isometric order (painter's algorithm)
  const startX = Math.floor(camX) - 2;
  const endX   = Math.ceil(camX + CAM_TILES_X) + 2;
  const startY = Math.floor(camY) - 2;
  const endY   = Math.ceil(camY + CAM_TILES_Y) + 2;

  for (let ty = startY; ty < endY; ty++) {
    for (let tx = startX; tx < endX; tx++) {
      if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) continue;
      const drawX = tx - camX;
      const drawY = ty - camY;
      const tile = world[ty][tx];
      drawIsoTile(drawX, drawY, tile);
    }
  }
}

function renderInterior() {
  const interior = INTERIORS[gameState.activeInterior];
  if (!interior) return;

  // Dedicated interior area screen with clear room framing.
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  const tileSize = 36;
  const roomW = interior.width * tileSize;
  const roomH = interior.height * tileSize;
  const startX = Math.floor((BASE_W - roomW) / 2);
  const startY = Math.floor((BASE_H - roomH) / 2);

  for (let y = 0; y < interior.height; y++) {
    for (let x = 0; x < interior.width; x++) {
      const px = startX + x * tileSize;
      const py = startY + y * tileSize;
      const isWall = (x === 0 || y === 0 || x === interior.width - 1 || y === interior.height - 1);
      ctx.fillStyle = isWall ? '#2f2f2f' : '#5f513a';
      ctx.fillRect(px, py, tileSize - 1, tileSize - 1);
    }
  }

  interior.beds.forEach(([bx, by]) => {
    const px = startX + bx * tileSize;
    const py = startY + by * tileSize;
    ctx.fillStyle = PALETTE.bed;
    ctx.fillRect(px + 4, py + 8, tileSize - 8, tileSize - 14);
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + 6, py + 10, 12, 8);
  });

  interior.tables.forEach(([tx, ty]) => {
    const px = startX + tx * tileSize;
    const py = startY + ty * tileSize;
    ctx.fillStyle = PALETTE.table;
    ctx.fillRect(px + 5, py + 8, tileSize - 10, tileSize - 16);
    ctx.fillStyle = PALETTE.tableLight;
    ctx.fillRect(px + 5, py + 8, tileSize - 10, 6);
  });

  const ex = startX + interior.exit.x * tileSize;
  const ey = startY + interior.exit.y * tileSize;
  ctx.fillStyle = '#2a7';
  ctx.fillRect(ex + 8, ey + 10, tileSize - 16, tileSize - 12);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('EXIT', ex + 7, ey + 24);

  const px = startX + Math.floor(player.x) * tileSize;
  const py = startY + Math.floor(player.y) * tileSize;
  ctx.fillStyle = '#0ff';
  ctx.beginPath();
  ctx.arc(px + tileSize / 2, py + tileSize / 2, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`${interior.name} - EXPLORE (WASD) / EXIT (F)`, 12, BASE_H - 14);
}

function renderEntities() {
  const camX = gameState.camera.x;
  const camY = gameState.camera.y;

  // Collect all entities to sort by depth
  const entities = [...prisoners, ...guards, player];
  entities.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  entities.forEach(e => e.draw(camX, camY));
}

function renderNightOverlay() {
  const h = gameState.time / 60;
  let alpha = 0;
  if (h >= 22 || h < 5) alpha = 0.6;
  else if (h >= 20) alpha = (h - 20) / 2 * 0.6;
  else if (h < 7) alpha = (7 - h) / 2 * 0.6;
  if (alpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 30, ${alpha})`;
    ctx.fillRect(0, 0, BASE_W, BASE_H);
  }
}

function renderMinimap() {
  miniCtx.fillStyle = '#111';
  miniCtx.fillRect(0, 0, 80, 80);
  const scale = 80 / MAP_W;

  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const t = world[ty][tx].type;
      let c = '#2a5a2a';
      if (t === T.WALL_N || t === T.WALL_E) c = '#888';
      else if (t === T.FENCE || t === T.WIRE) c = '#aa0';
      else if (t === T.FLOOR) c = '#c8a';
      else if (t === T.PATH || t === T.ROAD) c = '#876';
      else if (t === T.GATE) c = '#0f0';
      else if (t === T.TREE || t === T.BUSH) c = '#165';
      miniCtx.fillStyle = c;
      miniCtx.fillRect(tx * scale, ty * scale, scale, scale);
    }
  }

  // Player
  miniCtx.fillStyle = '#0ff';
  miniCtx.fillRect(player.x * scale - 1.5, player.y * scale - 1.5, 3, 3);

  // Guards
  miniCtx.fillStyle = '#f44';
  guards.forEach(g => {
    miniCtx.fillRect(g.x * scale - 1, g.y * scale - 1, 2, 2);
  });
}

function updateHUD() {
  document.getElementById('suspicionBar').style.width = player.suspicion + '%';
  document.getElementById('energyBar').style.width = player.energy + '%';
  document.getElementById('suspicionBar').style.background =
    player.suspicion > 70 ? '#f00' : player.suspicion > 40 ? '#f80' : '#f00';
  document.getElementById('clock').textContent =
    `DAY ${gameState.dayCount}  ${formatTime(gameState.time)}`;

  const sched = getCurrentSchedule();
  const interiorLabel = gameState.activeInterior ? ` | INSIDE: ${INTERIORS[gameState.activeInterior].name}` : '';
  document.getElementById('scheduleInfo').textContent = `SCHEDULE: ${sched.name}${interiorLabel}`;

  // Messages timer
  gameState.messages.forEach(m => m.timer--);
  gameState.messages = gameState.messages.filter(m => m.timer > 0);
  renderMessages();
}

function updateItemList() {
  const div = document.getElementById('itemList');
  if (player.items.length === 0) {
    div.textContent = '';
    return;
  }
  div.innerHTML = '<b>ITEMS:</b><br>' + player.items.map(i => `• ${i}`).join('<br>');
}

// ============================================================
// OVERLAY SCREENS
// ============================================================

function showCaughtScreen() {
  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('overlay').innerHTML = `
    <h1 style="color:#f00">CAUGHT!</h1>
    <h2 style="color:#f80">30 DAYS IN SOLITARY</h2>
    <p>The guards discovered your escape attempt.</p>
    <p>Your items have been confiscated.</p>
    <p>&nbsp;</p>
    <p>Suspicion Level: ${Math.round(player.suspicion)}%</p>
    <p>Items collected: ${player.items.length}</p>
    <button id="restartBtn">TRY AGAIN</button>
  `;
  document.getElementById('restartBtn').onclick = () => {
    document.getElementById('overlay').style.display = 'none';
    initGame();
  };
}

function showWinScreen(method) {
  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('overlay').innerHTML = `
    <h1 style="color:#0f0">ESCAPED!</h1>
    <h2 style="color:#0ff">MISSION COMPLETE</h2>
    <p>You successfully escaped the camp via ${method}!</p>
    <p>&nbsp;</p>
    <p style="color:#ff0">Day ${gameState.dayCount} — ${formatTime(gameState.time)}</p>
    <p>Items used: ${player.items.join(', ')}</p>
    <p>&nbsp;</p>
    <p style="color:#0f0">FOR KING AND COUNTRY!</p>
    <button id="restartBtn">PLAY AGAIN</button>
  `;
  document.getElementById('restartBtn').onclick = () => {
    document.getElementById('overlay').style.display = 'none';
    initGame();
  };
}

// ============================================================
// MAIN GAME LOOP
// ============================================================

let lastTime = 0;
let timeAccum = 0;

function gameLoop(timestamp) {
  const dt = Math.min(timestamp - lastTime, 50);
  lastTime = timestamp;

  if (gameState.phase === 'PLAYING') {
    // Update time
    timeAccum += dt;
    if (timeAccum >= 1000 / gameState.timeScale) {
      timeAccum = 0;
      gameState.time++;
      if (gameState.time >= 24*60) {
        gameState.time = 6*60;
        gameState.dayCount++;
        showMessage(`Day ${gameState.dayCount} begins`, '#0ff');
      }

      // Check schedule transitions
      const prev = getCurrentSchedule();
      const prevIdx = SCHEDULE.indexOf(prev);
      if (SCHEDULE[prevIdx] && gameState.time === SCHEDULE[prevIdx].time + 1) {
        showMessage(`SCHEDULE: ${SCHEDULE[prevIdx].name}`, '#ff0');
        if (SCHEDULE[prevIdx].activity === 'rollcall') {
          checkRollCall();
        }
      }
    }

    // Update entities. Interior mode pauses outside NPC simulation.
    player.update(dt, gameState.keys);
    if (!gameState.activeInterior) {
      guards.forEach(g => g.update(dt, player));
      prisoners.forEach(p => p.update(dt));
      updateCamera();
      checkGateEscape();
    }

    if (gameState.phase === 'CAUGHT') { showCaughtScreen(); }
    if (gameState.phase === 'WIN') { /* handled in trigger */ }
  }

  // RENDER
  // Background sky gradient
  const timeOfDay = gameState.time / (24*60);
  const r = Math.floor(20 + 30 * Math.sin(timeOfDay * Math.PI));
  const g2 = Math.floor(30 + 50 * Math.sin(timeOfDay * Math.PI));
  const b = Math.floor(60 + 80 * Math.sin(timeOfDay * Math.PI));
  ctx.fillStyle = `rgb(${r},${g2},${b})`;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  if (gameState.phase === 'PLAYING' || gameState.phase === 'CAUGHT' || gameState.phase === 'WIN') {
    if (gameState.activeInterior) {
      renderInterior();
    } else {
      renderWorld();
      renderEntities();
      renderNightOverlay();
    }
    updateHUD();
    if (!gameState.activeInterior) renderMinimap();
  }

  gameState.frameCount++;
  requestAnimationFrame(gameLoop);
}

// ============================================================
// INPUT
// ============================================================

document.addEventListener('keydown', (e) => {
  gameState.keys[e.key] = true;
  if (gameState.phase === 'PLAYING') {
    if (e.key === 'e' || e.key === 'E') tryPickup();
    if (e.key === ' ') tryPickup();
    if (e.key === 'f' || e.key === 'F') tryInteract();
    // Hint on H key
    if (e.key === 'h' || e.key === 'H') {
      showHint();
    }
  }
  // Prevent scrolling
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => {
  gameState.keys[e.key] = false;
});

function showHint() {
  const has = (i) => player.items.includes(i);
  const needed = ['WIRECUTTERS','MAP','COMPASS','UNIFORM'].filter(i => !has(i));
  if (needed.length > 0) {
    showMessage(`Still need: ${needed.join(', ')}`, '#0ff');
  } else {
    showMessage('Head to the south gate to escape! Use F for building doors.', '#0f0');
  }
}

// ============================================================
// START
// ============================================================

document.getElementById('startBtn').onclick = () => {
  document.getElementById('overlay').style.display = 'none';
  initGame();
  requestAnimationFrame(gameLoop);
};

// Pre-render world to show on title
createWorld();
requestAnimationFrame(function titleLoop(ts) {
  if (gameState.phase !== 'TITLE') return;
  ctx.fillStyle = '#001a33';
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  // Animate title screen camera pan
  const t = ts / 1000;
  gameState.camera.x = 10 + 5 * Math.sin(t * 0.1);
  gameState.camera.y = 10 + 5 * Math.cos(t * 0.13);
  renderWorld();
  requestAnimationFrame(titleLoop);
});
