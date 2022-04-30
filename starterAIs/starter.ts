type Coord = [x: number, y: number];

const isInsideCircle = (
  [centerX, centerY]: Coord,
  radius: number,
  [targetX, targetY]: Coord
): boolean => {
  return (
    Math.pow(centerX - targetX, 2) + Math.pow(centerY - targetY, 2) <=
    Math.pow(radius, 2)
  );
};

const distanceBetween2Points = ([x1, y1]: Coord, [x2, y2]: Coord): number => {
  return Math.hypot(x1 - x2, y1 - y2);
};

const lineAndCircleIntersection = (
  [startX, startY]: Coord,
  [destX, destY]: Coord,
  [baseX, baseY]: Coord,
  radius: number,
  [closeX, closeY]: Coord
): Coord => {
  // Special case : vertical line
  if (startX === destX) {
    // 1st point of intersection
    const y1 = baseY + Math.sqrt(radius * radius - Math.pow(startX - baseX, 2));
    const distance1 = Math.abs(startY - y1);
    // 2nd point of intersection
    const y2 = baseY - Math.sqrt(radius * radius - Math.pow(startX - baseX, 2));
    const distance2 = Math.abs(startY - y2);
    return distance1 < distance2 ? [startX, y1] : [startX, y2];
  }

  // line current direction : y = da * x + db
  const da = (startY - destY) / (startX - destX);
  const db = startY - startX * da;

  // Does the line intersect the circle ? D = b2 - 4ac
  const a = 1 + da * da;
  const b = -2 * baseX + 2 * da * (db - baseY);
  const c = baseX * baseX + Math.pow(db - baseY, 2) - radius * radius;
  const delta = b * b - 4 * a * c;
  // Never intersect
  if (delta < 0) return [Infinity, Infinity];

  // 1st point of intersection
  const x1 = (-b - Math.sqrt(delta)) / 2 / a;
  const y1 = da * x1 + db;
  // If only 1 point of intersection
  if (delta === 0) return [x1, y1];
  const distance1 = distanceBetween2Points([closeX, closeY], [x1, y1]);

  // 2nd point of intersection
  const x2 = (-b + Math.sqrt(delta)) / 2 / a;
  const y2 = da * x2 + db;
  const distance2 = distanceBetween2Points([closeX, closeY], [x2, y2]);

  // return smaller distance
  return distance1 < distance2 ? [x1, y1] : [x2, y2];
};

const circleAndCircleIntersection = (
  [c1X, c1Y]: Coord,
  c1R: number,
  [c2X, c2Y]: Coord,
  c2R: number,
  [closeX, closeY]: Coord
): Coord => {
  // https://members.loria.fr/DRoegel/loc/note0001.pdf
  const a = 2 * (c2X - c1X);
  const b = 2 * (c2Y - c1Y);
  const c =
    Math.pow(c2X - c1X, 2) + Math.pow(c2Y - c1Y, 2) - c2R * c2R + c1R * c1R;
  const delta =
    Math.pow(2 * a * c, 2) - 4 * (a * a + b * b) * (c * c - b * b * c1R * c1R);
  if (delta < 0) return [Infinity, Infinity];
  const x1 = c1X + (2 * a * c - Math.sqrt(delta)) / 2 / (a * a + b * b);
  const y1 = c1Y + (c - a * (x1 - c1X)) / b;
  if (delta === 0) return [x1, y1];
  const x2 = c1X + (2 * a * c + Math.sqrt(delta)) / 2 / (a * a + b * b);
  const y2 = c1Y + (c - a * (x2 - c1X)) / b;
  const distance1 = distanceBetween2Points([closeX, closeY], [x1, y1]);
  const distance2 = distanceBetween2Points([closeX, closeY], [x2, y2]);
  return distance1 < distance2 ? [x1, y1] : [x2, y2];
};

class Entity {
  TYPE_MONSTER = 0;
  TYPE_MY_HERO = 1;
  TYPE_ENEMY_HERO = 2;
  MY_BASE = 1;
  ENEMY_BASE = 2;
  directDistanceFromMyBase: number;
  directDistanceFromEnemyBase: number;
  turnsBeforeHit: number | undefined;
  constructor(
    public id: number,
    public type: number,
    public position: Coord,
    public shieldLife: number,
    public isControlled: number,
    public health: number,
    public vector: Coord,
    public nearBase: number,
    public threatFor: number,
    public lastVisibleTurn: number,
    private game: Game
  ) {
    this.directDistanceFromMyBase = this.getDistanceFrom(this.game.me.base);
    this.directDistanceFromEnemyBase = this.getDistanceFrom(
      this.game.enemy.base
    );
  }
  isMonster = (): boolean => {
    return this.type === this.TYPE_MONSTER;
  };
  isMyHero = (): boolean => {
    return this.type === this.TYPE_MY_HERO;
  };
  isEnemyHero = (): boolean => {
    return this.type === this.TYPE_ENEMY_HERO;
  };
  isDangerousForMyBase = (): boolean => {
    return this.threatFor === this.MY_BASE;
  };
  isDangerousForEnemy = (): boolean => {
    return this.threatFor === this.ENEMY_BASE;
  };
  willHitMyBase = (): boolean => {
    return this.turnsBeforeHit === 0;
  };
  canHitMyBase = (): boolean => {
    if (this.willHitMyBase()) return true;

    // Can hit if an enemy wind the monster
    if (
      this.shieldLife === 0 &&
      this.directDistanceFromMyBase <= 2900 &&
      this.game.enemy.canCast()
    ) {
      const enemyAbleToCast = this.game.enemy.heros.find(
        (hero) => hero.getDistanceFrom(this.position) <= 1280
      );
      if (enemyAbleToCast) return true;
    }
    return false;
  };
  getDistanceFrom = (coord: Coord): number => {
    return distanceBetween2Points(this.position, coord);
  };
}

class Player {
  heros: Entity[];
  constructor(
    public base: Coord,
    public baseHealth: number,
    public mana: number
  ) {
    this.heros = [];
  }
  setHealth = (value: number) => {
    this.baseHealth = value;
  };
  setMana = (value: number) => {
    this.mana = value;
  };
  canCast = (): boolean => {
    return this.mana >= 10;
  };
  canSecureCast = (secureLevel: number): boolean => {
    return this.mana >= 10 * (secureLevel + 1);
  };
  coordToBase = ([x, y]: Coord): Coord => {
    return [Math.abs(this.base[0] - x), Math.abs(this.base[1] - y)];
  };
}

class Action {
  constructor(private game: Game) {}

  wait = (message = ""): string => {
    return `WAIT ${this.game.warn ? "DEBUG" : message}`;
  };
  move = ([x, y]: Coord, message = ""): string => {
    return `MOVE ${x} ${y} ${this.game.warn ? "DEBUG" : message}`;
  };
  castWind = ([x, y]: Coord, message = ""): string => {
    this.game.me.setMana(this.game.me.mana - 10);
    return `SPELL WIND ${x} ${y} ${this.game.warn ? "DEBUG" : message}`;
  };
  castShield = (entity: Entity, message = ""): string => {
    this.game.me.setMana(this.game.me.mana - 10);
    return `SPELL SHIELD ${entity.id} ${this.game.warn ? "DEBUG" : message}`;
  };
  castControl = (entity: Entity, [x, y]: Coord, message = ""): string => {
    this.game.me.setMana(this.game.me.mana - 10);
    return `SPELL CONTROL ${entity.id} ${x} ${y} ${
      this.game.warn ? "DEBUG" : message
    }`;
  };
}

class Game {
  me: Player;
  enemy: Player;
  monsters: Entity[];
  action: Action;
  turn: number;
  baseRadius = 5000;
  isDebugging = true;
  warn = false;

  constructor(base: Coord, private heroes: number) {
    this.me = new Player(base, 3, 0);
    this.enemy = new Player(
      [base[0] === 0 ? 17630 : 0, base[1] === 0 ? 9000 : 0],
      3,
      0
    );
    this.action = new Action(this);
    this.turn = 0;
    this.monsters = [];
  }

  newTurn = (
    health: number,
    mana: number,
    enemyHealth: number,
    enemyMana: number
  ) => {
    this.turn++;
    this.me.setHealth(health);
    this.me.setMana(mana);
    this.me.heros = [];
    this.enemy.setHealth(enemyHealth);
    this.enemy.setMana(enemyMana);
    this.enemy.heros = [];
    this.monsters = [];
    this.warn = false;
  };

  addEntity = (
    id: number,
    type: number,
    position: Coord,
    shieldLife: number,
    isControlled: number,
    health: number,
    vector: Coord,
    nearBase: number,
    threatFor: number
  ) => {
    const entity = new Entity(
      id,
      type,
      position,
      shieldLife,
      isControlled,
      health,
      vector,
      nearBase,
      threatFor,
      this.turn,
      this
    );
    if (entity.isMonster()) {
      this.monsters.push(entity);
    } else if (entity.isMyHero()) {
      this.me.heros.push(entity);
    } else if (entity.isEnemyHero()) {
      this.enemy.heros.push(entity);
    } else {
      this.warnDebug("UNKNOWN ENTITY:", entity);
    }
  };

  printNextActions = (): void => {
    for (let i = 0; i < this.heroes; i++) {
      // Write your hero logic here
      console.log(this.action.wait("TODO"));
    }
  };
  debug = (message: string, ...rest) => {
    if (this.isDebugging) console.error(message, ...rest);
  };
  warnDebug = (message: string, ...rest) => {
    this.debug(message, ...rest);
    this.warn = true;
  };
}

const base = readline().split(" ").map(Number); // The corner of the map representing your base
const heroesPerPlayer: number = Number(readline()); // Always 3
const game = new Game(base, heroesPerPlayer);

// game loop
while (true) {
  const myBaseInput: number[] = readline().split(" ").map(Number);
  const enemyBaseInput: number[] = readline().split(" ").map(Number);
  game.newTurn(
    myBaseInput[0],
    myBaseInput[1],
    enemyBaseInput[0],
    enemyBaseInput[1]
  );

  const entityCount: number = Number(readline()); // Amount of heros and monsters you can see
  for (let i = 0; i < entityCount; i++) {
    var inputs: number[] = readline().split(" ").map(Number);
    game.addEntity(
      inputs[0], // Unique identifier
      inputs[1], // 0=monster, 1=your hero, 2=opponent hero
      [inputs[2], inputs[3]], // Position of this entity
      inputs[4], // Ignore for this league; Count down until shield spell fades
      inputs[5], // Ignore for this league; Equals 1 when this entity is under a control spell
      inputs[6], // Remaining health of this monster
      [inputs[7], inputs[8]], // Trajectory of this monster
      inputs[9], // 0=monster with no target yet, 1=monster targeting a base
      inputs[10] // Given this monster's trajectory, is it a threat to 1=your base, 2=your opponent's base, 0=neither
    );
  }

  game.printNextActions();
}
