// main.js: camera, drawing, controls and startup (Steps 7-9).
// Every column is the same cube from cube.js, placed by its own model matrix.
// Each vertex goes model -> view -> projection to reach the screen.

// 0: one cube, 1: wavy grid, 2: from images, 3: + sun and moon, 4: + sky gradient and eclipse dimming
const START_LEVEL = 4;
let level = START_LEVEL;

// cubes per side (the slider changes it); one draw call per cube, so bigger = slower
const START_GRID_SIZE = 120;
let gridSize = START_GRID_SIZE;

let land = [];   // filled once the images load


// Step 7. Camera and draw()

// camera orbits `target` at this radius and height; angle is where on the circle
const CAMERA_START = { radius: 135, height: 30, target: [0, 6, 0], angle: 3.76 };
const CAMERA_START_LEVEL_0 = { radius: 8, height: 4, target: [0, 0, 0], angle: 3.76 };   // close up on the one cube
const camera = { ...CAMERA_START };   // copy, so Reset view can go back
function cameraStart() {
  return level === 0 ? CAMERA_START_LEVEL_0 : CAMERA_START;
}
const UP = [0, 1, 0];

const PLAIN_SKY_COLOR = [0.55, 0.70, 0.88];    // Levels 0-3
const SKY_BOTTOM_COLOR = [0.80, 0.86, 0.92];   // Level 4 horizon haze
const SKY_TOP_COLOR = [0.18, 0.40, 0.78];      // Level 4 deep blue overhead
const SKY_BOX_SIZE = 1000;   // half-width of the sky cube, bigger than the sun's arc

gl.enable(gl.DEPTH_TEST);   // nearer pixels win
gl.enable(gl.CULL_FACE);    // skip back faces

// match the drawing buffer to the canvas's screen size (times pixel density, for sharpness)
function resizeCanvas() {
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

// brightness < 1 darkens the cube during the eclipse
function drawCube(cube, brightness) {
  gl.uniformMatrix4fv(u_model, false, makeModelMatrix(cube.position, cube.scale));
  gl.uniform3fv(u_color, [
    cube.color[0] * brightness,
    cube.color[1] * brightness,
    cube.color[2] * brightness,
  ]);
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}

// Level 4 sky gradient: one huge cube around the camera, pale at the bottom, blue at the top.
// Drawn first without depth writes so everything paints over it.
function drawSkyBox(eye, brightness) {
  const position = [eye[0], eye[1] + SKY_BOX_SIZE, eye[2]];   // bottom face at eye height
  gl.uniformMatrix4fv(u_model, false, makeModelMatrix(position, [SKY_BOX_SIZE, SKY_BOX_SIZE, SKY_BOX_SIZE]));
  gl.uniform3fv(u_color, SKY_TOP_COLOR.map((c) => c * brightness));
  gl.uniform3fv(u_skyBottom, SKY_BOTTOM_COLOR.map((c) => c * brightness));
  gl.uniform1i(u_isSky, 1);
  gl.depthMask(false);
  gl.cullFace(gl.FRONT);    // we're inside this cube, so keep the inside faces

  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);

  gl.cullFace(gl.BACK);
  gl.depthMask(true);
  gl.uniform1i(u_isSky, 0);
}

const header = document.getElementById('header');

// draws one frame (called every frame by animate)
function draw() {
  resizeCanvas();

  // camera on a circle around the target, aimed at it with lookAt
  const eye = [
    camera.target[0] + camera.radius * Math.sin(camera.angle),
    camera.height,
    camera.target[2] + camera.radius * Math.cos(camera.angle),
  ];
  const viewMatrix = lookAt(eye, camera.target, UP);

  // 60° field of view, near 0.5, far 5000
  const aspect = canvas.width / canvas.height;
  const projectionMatrix = perspective(Math.PI / 3, aspect, 0.5, 5000);

  gl.uniformMatrix4fv(u_view, false, viewMatrix);
  gl.uniformMatrix4fv(u_projection, false, projectionMatrix);

  // only Level 4 darkens during the eclipse (skyBrightness is in sky.js)
  const brightness = level >= 4 ? skyBrightness(eye) : 1;
  const base = level >= 4 ? SKY_BOTTOM_COLOR : PLAIN_SKY_COLOR;
  const background = [base[0] * brightness, base[1] * brightness, base[2] * brightness];

  header.classList.toggle('dark-sky', brightness < 0.7);   // pale header text on a dark sky

  gl.clearColor(background[0], background[1], background[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (level >= 4) {
    drawSkyBox(eye, brightness);
  }

  for (const cube of land) {
    drawCube(cube, brightness);
  }

  if (level >= 3) {
    drawSky();
  }
}


// Step 8. Mouse: drag to orbit and raise/lower, scroll to zoom
let dragging = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
});

window.addEventListener('pointerup', () => {
  dragging = false;
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  camera.angle -= (event.clientX - lastX) * 0.005;
  camera.height = Math.max(1, camera.height + (event.clientY - lastY) * 0.3);   // never below 1
  lastX = event.clientX;
  lastY = event.clientY;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();   // don't scroll the page
  camera.radius = Math.max(3, camera.radius * (1 + event.deltaY * 0.001));
}, { passive: false });


// Step 9. Header controls, animation loop, loading the images
const gridSlider = document.getElementById('grid-size');
const gridLabel = document.getElementById('grid-size-label');
const resolutionName = document.getElementById('resolution-name');
const resolutionControl = document.getElementById('resolution');
let colorPixels = null;    // kept so the grid can be rebuilt at a new size
let heightPixels = null;

// Level 0: a single 2x2x2 cube at the origin (scale 1, since the model is already 2 wide)
const SINGLE_CUBE = { position: [0, 0, 0], scale: [1, 1, 1], color: [0.86, 0.75, 0.50] };

function buildLand() {
  gridLabel.textContent = gridSize + ' \u00d7 ' + gridSize + ' cubes';
  resolutionName.textContent = level === 1 ? 'Grid size' : 'Image sampling';
  resolutionControl.hidden = level === 0;   // nothing to sample with one cube
  if (level === 0) {
    land = [SINGLE_CUBE];
  } else if (level === 1) {
    land = buildProceduralGrid(gridSize);
  } else if (colorPixels) {
    land = buildImageGrid(gridSize, colorPixels, heightPixels);
  }
}

// every frame: nudge the camera around its circle, move the sun and moon, draw
const ORBIT_SECONDS = 120;   // one full lap
let lastTime = 0;
function animate(now) {
  const seconds = lastTime ? (now - lastTime) / 1000 : 0;
  lastTime = now;
  if (!dragging) {
    camera.angle -= (2 * Math.PI / ORBIT_SECONDS) * seconds;   // orbit pauses while dragging
  }
  if (level >= 3) {
    updateSky(seconds);
  }
  draw();
  requestAnimationFrame(animate);
}

// the loop redraws every frame, so controls just change settings
gridSlider.value = gridSize;
gridSlider.addEventListener('input', () => {
  gridSize = Number(gridSlider.value);
  buildLand();
});

document.getElementById('reset-view').addEventListener('click', () => {
  Object.assign(camera, cameraStart());
});

const levelButtons = document.querySelectorAll('#levels button');
function setLevel(newLevel) {
  const wasLevel0 = level === 0;
  level = newLevel;
  if (wasLevel0 !== (level === 0)) {
    Object.assign(camera, cameraStart());   // jump close to the cube, or back out to the land
  }
  for (const button of levelButtons) {
    button.classList.toggle('active', Number(button.dataset.level) === level);
  }
  buildLand();
}
for (const button of levelButtons) {
  button.addEventListener('click', () => setLevel(Number(button.dataset.level)));
}

// resolves once the image has loaded
function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = src;
  });
}

// start: Levels 0-1 draw right away; Levels 2-4 show just sky until the images load
// (images need a local server, see README)
setLevel(START_LEVEL);
requestAnimationFrame(animate);
Promise.all([
  loadImage('assets/terrain_color.png'),
  loadImage('assets/terrain_height.png'),
]).then(([colorImage, heightImage]) => {
  colorPixels = readPixels(colorImage);
  heightPixels = readPixels(heightImage);
  buildLand();
});
