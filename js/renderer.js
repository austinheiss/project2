// renderer.js: WebGL setup and shaders (Steps 1-3). Loaded first, everything else uses `gl`.

// Step 1. Get a WebGL context from the canvas
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  alert('Sorry, your browser does not support WebGL.');
}


// Step 2. Shaders
// vertex shader = runs per corner, fragment shader = runs per pixel
const vertexShaderSource = `
  attribute vec3 a_position;  // cube corner, -1..1 (from cube.js)

  uniform mat4 u_model;       // object -> world
  uniform mat4 u_view;        // world -> camera
  uniform mat4 u_projection;  // camera -> clip (perspective)
  uniform vec3 u_color;       // the cube's color
  uniform bool u_isSky;       // true only for the big sky cube
  uniform vec3 u_skyBottom;   // sky cube's horizon color

  varying vec3 v_color;

  void main() {
    vec4 world = u_model * vec4(a_position, 1.0);

    // bottom corners at 55%, top at 100%, so column sides fade dark -> light
    float shade = mix(0.55, 1.0, (a_position.y + 1.0) * 0.5);
    v_color = u_color * shade;

    // sky cube: horizon color at the bottom, u_color at the top
    if (u_isSky) {
      v_color = mix(u_skyBottom, u_color, (a_position.y + 1.0) * 0.5);
    }

    gl_Position = u_projection * u_view * world;
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying vec3 v_color;

  void main() {
    gl_FragColor = vec4(v_color, 1.0);  // no lighting, just the blended vertex color
  }
`;


// Step 3. Compile and link the shaders
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));  // GLSL typos show up in the console
  }
  return shader;
}

const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  console.error(gl.getProgramInfoLog(program));
}

gl.useProgram(program);

// look up where each shader variable lives
const a_position   = gl.getAttribLocation(program, 'a_position');
const u_model      = gl.getUniformLocation(program, 'u_model');
const u_view       = gl.getUniformLocation(program, 'u_view');
const u_projection = gl.getUniformLocation(program, 'u_projection');
const u_color      = gl.getUniformLocation(program, 'u_color');
const u_isSky      = gl.getUniformLocation(program, 'u_isSky');
const u_skyBottom  = gl.getUniformLocation(program, 'u_skyBottom');
