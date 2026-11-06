// landscape.js: builds the list of land cubes (Step 6). Just data, main.js draws it.

// Step 6. Describe the scene: each cube is { position, scale, color }.

// LAND_SIZE, MIN_HEIGHT and MAX_HEIGHT must match tools/make_terrain.py
const LAND_SIZE = 200;      // world units across, no matter how many cubes
const MIN_HEIGHT = 0.5;     // so even black pixels get a thin cube
const MAX_HEIGHT = 32;      // extra height of a white pixel
const PLATFORM_DEPTH = 12;  // columns reach down to y = -12 (the floating platform)
const RIM_HEIGHT = MIN_HEIGHT;
const RIM_COLOR = [0.82, 0.62, 0.38];
const EDGE_FADE = 0.08;     // outer 8% eases down to a flat rim

// smooth 0 -> 1 ramp, same as GLSL smoothstep
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// one column for grid cell (i, j), from y = bottom up to y = height
function makeColumn(i, j, n, height, color, bottom = 0) {
  const cell = LAND_SIZE / n;
  const x = -LAND_SIZE / 2 + (i + 0.5) * cell;
  const z = -LAND_SIZE / 2 + (j + 0.5) * cell;
  const tall = height - bottom;
  return {
    position: [x, bottom + tall / 2, z],   // centered in its cell, base on y = bottom
    scale: [cell / 2, tall / 2, cell / 2],  // half sizes, since the cube is 2 wide
    color: color,
  };
}

// Level 1: height -> color by blending between stops
function colorRamp(t) {
  const stops = [
    [0.0,  [0.86, 0.75, 0.50]],  // sand
    [0.35, [0.78, 0.62, 0.38]],  // darker sand
    [0.65, [0.62, 0.50, 0.36]],  // rock
    [1.0,  [0.95, 0.92, 0.85]],  // pale peaks
  ];
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) {
      const [t0, c0] = stops[k - 1];
      const [t1, c1] = stops[k];
      return lerp(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return stops[stops.length - 1][1];
}

// Level 1: made-up heights from sine waves plus a little randomness
function buildProceduralGrid(n) {
  const cubes = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 12;
      const z = (j / n) * 12;
      let t = 0.5 + 0.25 * Math.sin(x * 0.9) * Math.cos(z * 0.7) + 0.15 * Math.sin(x * 2.1 + z * 1.7);
      t += (Math.random() - 0.5) * 0.12;
      t = Math.min(1, Math.max(0, t));
      const height = MIN_HEIGHT + t * 10;
      cubes.push(makeColumn(i, j, n, height, colorRamp(t)));
    }
  }
  return cubes;
}

// Levels 2-4: get an image's raw RGBA pixels by drawing it into an offscreen canvas
function readPixels(image) {
  const offscreen = document.createElement('canvas');
  offscreen.width = image.width;
  offscreen.height = image.height;
  const context = offscreen.getContext('2d');
  context.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: context.getImageData(0, 0, image.width, image.height).data,
  };
}

// average color of the block of pixels under cell (i, j) (box filter, avoids aliasing)
function sampleCell(pixels, i, j, n) {
  const x0 = Math.floor((i / n) * pixels.width);
  const x1 = Math.floor(((i + 1) / n) * pixels.width);
  const y0 = Math.floor((j / n) * pixels.height);
  const y1 = Math.floor(((j + 1) / n) * pixels.height);

  let r = 0, g = 0, b = 0, count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = (y * pixels.width + x) * 4;   // 4 numbers (RGBA) per pixel
      r += pixels.data[k];
      g += pixels.data[k + 1];
      b += pixels.data[k + 2];
      count++;
    }
  }
  return [r / count, g / count, b / count];
}

// Levels 2-4: heights and colors from the images (pyramids are already baked in)
function buildImageGrid(n, colorPixels, heightPixels) {
  const cubes = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const gray = sampleCell(heightPixels, i, j, n)[0];          // grayscale, so red is enough
      const height = MIN_HEIGHT + (gray / 255) * MAX_HEIGHT;      // gray 0..255 -> world height
      const rgb = sampleCell(colorPixels, i, j, n);

      // ease down to the flat rim near the edges
      const edge = Math.min(i, j, n - 1 - i, n - 1 - j) / (n * EDGE_FADE);
      const blend = smoothstep(0, 1, edge);
      const h = RIM_HEIGHT + (height - RIM_HEIGHT) * blend;
      const color = lerp(RIM_COLOR, [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255], blend);

      cubes.push(makeColumn(i, j, n, h, color, -PLATFORM_DEPTH));
    }
  }
  return cubes;
}
