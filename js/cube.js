// cube.js: the one model, a 2x2x2 cube (Step 4). Every column, sun and moon piece is this cube.

// Step 4. The cube's 36 vertices (6 faces x 2 triangles x 3 corners), -1..1 on each axis.
// Corners are counter-clockwise from outside, so back faces can be culled.
const cubePositions = new Float32Array([
  // front (z = +1)
  -1, -1,  1,   1, -1,  1,   1,  1,  1,
  -1, -1,  1,   1,  1,  1,  -1,  1,  1,
  // back (z = -1)
   1, -1, -1,  -1, -1, -1,  -1,  1, -1,
   1, -1, -1,  -1,  1, -1,   1,  1, -1,
  // right (x = +1)
   1, -1,  1,   1, -1, -1,   1,  1, -1,
   1, -1,  1,   1,  1, -1,   1,  1,  1,
  // left (x = -1)
  -1, -1, -1,  -1, -1,  1,  -1,  1,  1,
  -1, -1, -1,  -1,  1,  1,  -1,  1, -1,
  // top (y = +1)
  -1,  1,  1,   1,  1,  1,   1,  1, -1,
  -1,  1,  1,   1,  1, -1,  -1,  1, -1,
  // bottom (y = -1)
  -1, -1, -1,   1, -1, -1,   1, -1,  1,
  -1, -1, -1,   1, -1,  1,  -1, -1,  1,
]);

const VERTEX_COUNT = 36;

// upload once, draw many times
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW);

// 3 floats (x, y, z) per vertex, tightly packed
gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_position);
