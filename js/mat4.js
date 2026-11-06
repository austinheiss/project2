// mat4.js: hand-written vector and matrix helpers (Step 5).
// Matrices are 16 numbers in column-major order, the way WebGL wants them.

// Step 5. Vector helpers
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b)      { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(v) {
  const length = Math.sqrt(dot(v, v));
  return [v[0] / length, v[1] / length, v[2] / length];
}
// blend from a (t = 0) to b (t = 1), for points or colors
function lerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// model matrix: scale, then move to position
function makeModelMatrix(position, scale) {
  const [tx, ty, tz] = position;
  const [sx, sy, sz] = scale;
  return new Float32Array([
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    tx, ty, tz, 1,    // translation goes in the last column
  ]);
}

// rotation about the y axis (angle in radians)
function rotationY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1,  0, 0,
    s, 0,  c, 0,
    0, 0,  0, 1,
  ]);
}

// rotation about the x axis (angle in radians)
function rotationX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    1,  0, 0, 0,
    0,  c, s, 0,
    0, -s, c, 0,
    0,  0, 0, 1,
  ]);
}

// a * b: the combined matrix does b first, then a
function multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

// view matrix: moves the world so the camera sits at the origin looking down -Z
function lookAt(eye, target, up) {
  const zAxis = normalize(subtract(eye, target));  // camera's backward
  const xAxis = normalize(cross(up, zAxis));       // camera's right
  const yAxis = cross(zAxis, xAxis);               // camera's up

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ]);
}

// projection matrix: squeezes the view frustum into the -1..1 cube (far things look smaller)
function perspective(fieldOfView, aspect, near, far) {
  const f = 1.0 / Math.tan(fieldOfView / 2);
  const rangeInv = 1.0 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0,                          0,
    0,          f, 0,                          0,
    0,          0, (near + far) * rangeInv,   -1,
    0,          0, 2 * near * far * rangeInv,  0,
  ]);
}
