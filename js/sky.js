// sky.js: the eclipse (Levels 3-4). A sun and a moon made of small cubes ride
// bezier arcs across the sky, slowly spinning; the slower moon lines up with the sun at midday.

// Cubic bezier with De Casteljau: lerp neighboring points until one is left
function cubicBezier(p0, p1, p2, p3, t) {
  // round 1: 4 points -> 3
  const q0 = lerp(p0, p1, t);
  const q1 = lerp(p1, p2, t);
  const q2 = lerp(p2, p3, t);
  // round 2: 3 -> 2
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  // round 3: 2 -> 1, the point on the curve
  return lerp(r0, r1, t);
}

// The arc is a semicircle from east (+x) to west (-x), leaned 66° toward the
// south (+z) like a low winter sun. h is "up" along that leaning plane.
const SKY_TILT = 66 * Math.PI / 180;
function arcPoint(x, h) {
  return [x, h * Math.cos(SKY_TILT), h * Math.sin(SKY_TILT)];
}

// sun's path: radius 250, ends kept above the horizon so the balls never sink into the ground
const SKY_RADIUS = 250;
const SUN_PATH = [
  arcPoint(SKY_RADIUS, 0.25 * SKY_RADIUS),     // P0: low in the east
  arcPoint(SKY_RADIUS, 1.25 * SKY_RADIUS),     // P1
  arcPoint(-SKY_RADIUS, 1.25 * SKY_RADIUS),    // P2
  arcPoint(-SKY_RADIUS, 0.25 * SKY_RADIUS),    // P3: low in the west
];

// moon's path: same curve at 95%, so it's a bit closer and passes in front
const MOON_DEPTH = 0.95;
const MOON_PATH = [];
for (const point of SUN_PATH) {
  MOON_PATH.push([point[0] * MOON_DEPTH, point[1] * MOON_DEPTH, point[2] * MOON_DEPTH]);
}

// moon moves at 80% of the sun's speed; both hit t = 0.5 together (the eclipse)
const MOON_SPEED = 0.8;

const SUN_RADIUS = 14;
const MOON_RADIUS = 16;    // a bit bigger so it fully covers the sun
const SKY_CUBE_SIZE = 2;

const SUN_COLOR = [1.0, 0.85, 0.3];
const MOON_COLOR = [0.08, 0.08, 0.1];

const CYCLE_SECONDS = 60;  // sunrise to sunset

// both balls slowly spin about their own centers (seconds per full turn, minus = other way).
// The spin axis leans a bit so the cube shading visibly rolls around.
const SUN_SPIN_SECONDS = 40;
const MOON_SPIN_SECONDS = -55;
const SPIN_TILT = 25 * Math.PI / 180;

// A ball of small cubes: keep grid cells inside the sphere but near its
// surface (the inside would never be seen). Returns offsets from the center.
function buildBall(radius) {
  const offsets = [];
  const n = Math.ceil(radius / SKY_CUBE_SIZE);
  for (let x = -n; x <= n; x++) {
    for (let y = -n; y <= n; y++) {
      for (let z = -n; z <= n; z++) {
        const p = [x * SKY_CUBE_SIZE, y * SKY_CUBE_SIZE, z * SKY_CUBE_SIZE];
        const distance = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        if (distance <= radius && distance > radius - 2 * SKY_CUBE_SIZE) {
          offsets.push(p);
        }
      }
    }
  }
  return offsets;
}

const SUN_CUBES = buildBall(SUN_RADIUS);
const MOON_CUBES = buildBall(MOON_RADIUS);

let skyT = 0.33;   // 0 = sunrise, 1 = sunset; start mid-morning
let sunPosition = [0, 0, 0];
let moonPosition = [0, 0, 0];
let sunSpin = 0;    // current spin angles
let moonSpin = 0;

function updateSky(seconds) {
  skyT += seconds / CYCLE_SECONDS;
  if (skyT > 1) skyT -= 1;   // pop back to sunrise

  sunSpin += (2 * Math.PI / SUN_SPIN_SECONDS) * seconds;
  moonSpin += (2 * Math.PI / MOON_SPIN_SECONDS) * seconds;

  const moonT = 0.5 + MOON_SPEED * (skyT - 0.5);
  sunPosition = cubicBezier(SUN_PATH[0], SUN_PATH[1], SUN_PATH[2], SUN_PATH[3], skyT);
  moonPosition = cubicBezier(MOON_PATH[0], MOON_PATH[1], MOON_PATH[2], MOON_PATH[3], moonT);
}
updateSky(0);

// each small cube: scale it down and move it out to its offset (local),
// then spin the whole ball and move it to its spot on the bezier (ball)
function drawBall(center, offsets, color, spin) {
  const half = SKY_CUBE_SIZE / 2;
  const rotation = multiply(rotationY(spin), rotationX(SPIN_TILT));   // lean the axis, then spin
  const ball = multiply(makeModelMatrix(center, [1, 1, 1]), rotation);   // translate * rotate
  gl.uniform3fv(u_color, color);
  for (const offset of offsets) {
    const local = makeModelMatrix(offset, [half, half, half]);
    gl.uniformMatrix4fv(u_model, false, multiply(ball, local));
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }
}

function drawSky() {
  drawBall(sunPosition, SUN_CUBES, SUN_COLOR, sunSpin);
  drawBall(moonPosition, MOON_CUBES, MOON_COLOR, moonSpin);
}

// How bright the day is: 1 normally, DARKEST when the moon fully covers the sun.
// Compares how far apart the two discs look from the camera with how big they look.
const DARKEST = 0.15;

function skyBrightness(eye) {
  const toSun = subtract(sunPosition, eye);
  const toMoon = subtract(moonPosition, eye);
  const sunDistance = Math.sqrt(dot(toSun, toSun));
  const moonDistance = Math.sqrt(dot(toMoon, toMoon));

  const cosAngle = dot(toSun, toMoon) / (sunDistance * moonDistance);
  const apart = Math.acos(Math.min(1, cosAngle));   // angle between them
  const sunSize = SUN_RADIUS / sunDistance;         // how big each disc looks
  const moonSize = MOON_RADIUS / moonDistance;

  // 0 when the discs just touch, 1 when the sun is fully inside the moon
  const covered = (sunSize + moonSize - apart) / (2 * sunSize);
  const amount = Math.max(0, Math.min(1, covered));
  return 1 - (1 - DARKEST) * amount * amount;   // squared so it stays bright until near totality
}
