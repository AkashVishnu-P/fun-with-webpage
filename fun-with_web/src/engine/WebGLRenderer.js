/**
 * WebGLRenderer.js
 * Core WebGL2 render pipeline for Project Symbiote Prime.
 * Manages shaders, GPU buffers, instanced draw calls, sliding-window culling,
 * and The Apex Symbiote Avatar rendering.
 */

import { Camera2D } from './camera/Camera2D.js';
import { SpatialHashGrid } from './spatial/SpatialHashGrid.js';
import { SymbioteAvatar } from './avatar/SymbioteAvatar.js';
import { gridVertexShader, gridFragmentShader } from './shaders/gridShaders.js';
import { nodeVertexShader, nodeFragmentShader } from './shaders/nodeShaders.js';
import {
  avatarLegVertexShader,
  avatarLegFragmentShader,
  avatarBodyVertexShader,
  avatarBodyFragmentShader
} from './shaders/avatarShaders.js';

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failure: ${info}`);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failure: ${info}`);
  }
  return program;
}

export class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      desynchronized: true
    });

    if (!this.gl) {
      throw new Error('WebGL 2.0 is required for Project Symbiote Prime.');
    }

    const gl = this.gl;
    this.camera = new Camera2D(canvas.clientWidth, canvas.clientHeight);
    this.spatialGrid = new SpatialHashGrid(800, 14);
    this.avatar = new SymbioteAvatar();

    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTime = performance.now();
    this.elapsedTime = 0;

    // Telemetry tracking
    this.frameCount = 0;
    this.fpsTimer = performance.now();
    this.currentFps = 60;
    this.onTelemetry = null;

    // Initialize Shaders and Buffers
    this.initGridPipeline();
    this.initNodePipeline();
    this.initAvatarPipelines();

    // Enable Blending for glow, iridescence and chitin edges
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  initGridPipeline() {
    const gl = this.gl;
    this.gridProgram = createProgram(gl, gridVertexShader, gridFragmentShader);
    this.gridUniforms = {
      resolution: gl.getUniformLocation(this.gridProgram, 'u_resolution'),
      cameraPos: gl.getUniformLocation(this.gridProgram, 'u_cameraPos'),
      zoom: gl.getUniformLocation(this.gridProgram, 'u_zoom'),
      time: gl.getUniformLocation(this.gridProgram, 'u_time')
    };

    // Full-screen quad spanning [-1, -1] to [1, 1]
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    this.gridVAO = gl.createVertexArray();
    gl.bindVertexArray(this.gridVAO);

    const quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.gridProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  initNodePipeline() {
    const gl = this.gl;
    this.nodeProgram = createProgram(gl, nodeVertexShader, nodeFragmentShader);
    this.nodeUniforms = {
      matrix: gl.getUniformLocation(this.nodeProgram, 'u_matrix'),
      time: gl.getUniformLocation(this.nodeProgram, 'u_time'),
      zoom: gl.getUniformLocation(this.nodeProgram, 'u_zoom')
    };

    // Unit Quad [-1, 1]
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    this.nodeVAO = gl.createVertexArray();
    gl.bindVertexArray(this.nodeVAO);

    // Quad Geometry Buffer
    const quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Dynamic Instance Positions Buffer [x, y]
    this.nodePosVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodePosVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.spatialGrid.instancePositionBuffer.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    // Dynamic Instance Attributes Buffer [radius, type, energy, pulsePhase]
    this.nodeAttrVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeAttrVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.spatialGrid.instanceAttribBuffer.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);

    gl.bindVertexArray(null);
  }

  initAvatarPipelines() {
    const gl = this.gl;

    // Unit Quad [-1, 1]
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    // 1. Instanced Leg Segments Pipeline
    this.avatarLegProgram = createProgram(gl, avatarLegVertexShader, avatarLegFragmentShader);
    this.avatarLegUniforms = {
      matrix: gl.getUniformLocation(this.avatarLegProgram, 'u_matrix'),
      time: gl.getUniformLocation(this.avatarLegProgram, 'u_time'),
      zoom: gl.getUniformLocation(this.avatarLegProgram, 'u_zoom')
    };

    this.avatarLegVAO = gl.createVertexArray();
    gl.bindVertexArray(this.avatarLegVAO);

    // Quad VBO
    const legQuadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, legQuadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Dynamic Leg Instances VBO (stride = 8 floats = 32 bytes)
    this.avatarLegVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.avatarLegVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.avatar.legInstanceBuffer.byteLength, gl.DYNAMIC_DRAW);

    const strideLeg = 8 * 4;
    // Location 1: a_legStart (vec2, offset 0)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, strideLeg, 0);
    gl.vertexAttribDivisor(1, 1);

    // Location 2: a_legEnd (vec2, offset 8)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, strideLeg, 8);
    gl.vertexAttribDivisor(2, 1);

    // Location 3: a_radii (vec2, offset 16)
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, strideLeg, 16);
    gl.vertexAttribDivisor(3, 1);

    // Location 4: a_meta (vec2, offset 24)
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, strideLeg, 24);
    gl.vertexAttribDivisor(4, 1);

    gl.bindVertexArray(null);

    // 2. Body Parts Pipeline (Cephalothorax, Abdomen, Mandibles)
    this.avatarBodyProgram = createProgram(gl, avatarBodyVertexShader, avatarBodyFragmentShader);
    this.avatarBodyUniforms = {
      matrix: gl.getUniformLocation(this.avatarBodyProgram, 'u_matrix'),
      time: gl.getUniformLocation(this.avatarBodyProgram, 'u_time'),
      zoom: gl.getUniformLocation(this.avatarBodyProgram, 'u_zoom')
    };

    this.avatarBodyVAO = gl.createVertexArray();
    gl.bindVertexArray(this.avatarBodyVAO);

    // Quad VBO
    const bodyQuadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bodyQuadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Dynamic Body Instances VBO (stride = 8 floats = 32 bytes)
    this.avatarBodyVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.avatarBodyVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.avatar.bodyInstanceBuffer.byteLength, gl.DYNAMIC_DRAW);

    const strideBody = 8 * 4;
    // Location 1: a_bodyPos (vec2, offset 0)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, strideBody, 0);
    gl.vertexAttribDivisor(1, 1);

    // Location 2: a_bodyRadius (vec2, offset 8)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, strideBody, 8);
    gl.vertexAttribDivisor(2, 1);

    // Location 3: a_bodyRot (float, offset 16)
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, strideBody, 16);
    gl.vertexAttribDivisor(3, 1);

    // Location 4: a_bodyMeta (vec3, offset 20)
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, strideBody, 20);
    gl.vertexAttribDivisor(4, 1);

    gl.bindVertexArray(null);
  }

  resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for max performance
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.camera.resize(width, height, dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.renderLoop = (now) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.elapsedTime += dt;

      this.update(dt);
      this.render();
      this.calculateTelemetry(now);

      if (this.isRunning) {
        this.animationFrameId = requestAnimationFrame(this.renderLoop);
      }
    };
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  update(dt) {
    this.camera.update(dt);
    this.avatar.update(dt, this.camera);
  }

  render() {
    const gl = this.gl;

    // Clear Screen
    gl.clearColor(0.012, 0.027, 0.071, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 1. Render Infinite Tactical Grid
    gl.useProgram(this.gridProgram);
    gl.uniform2f(this.gridUniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.gridUniforms.cameraPos, this.camera.x, this.camera.y);
    gl.uniform1f(this.gridUniforms.zoom, this.camera.zoom * this.camera.dpr);
    gl.uniform1f(this.gridUniforms.time, this.elapsedTime);

    gl.bindVertexArray(this.gridVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2. Query Sliding Window Spatial Hash Grid
    const bounds = this.camera.getViewportBounds();
    const query = this.spatialGrid.querySlidingWindow(bounds, 250);

    // 3. Render Culled Instanced Glowing Nodes (Additive Glow)
    if (query.nodeCount > 0) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for neon nodes
      gl.useProgram(this.nodeProgram);
      gl.uniformMatrix3fv(this.nodeUniforms.matrix, false, this.camera.matrix);
      gl.uniform1f(this.nodeUniforms.time, this.elapsedTime);
      gl.uniform1f(this.nodeUniforms.zoom, this.camera.zoom);

      gl.bindVertexArray(this.nodeVAO);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodePosVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, query.positionBuffer.subarray(0, query.nodeCount * 2));

      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeAttrVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, query.attribBuffer.subarray(0, query.nodeCount * 4));

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, query.nodeCount);
      gl.bindVertexArray(null);
    }

    // 4. Render The Apex Symbiote Avatar (Alpha Blend)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 4a. Draw 24 Instanced Leg Segments
    gl.useProgram(this.avatarLegProgram);
    gl.uniformMatrix3fv(this.avatarLegUniforms.matrix, false, this.camera.matrix);
    gl.uniform1f(this.avatarLegUniforms.time, this.elapsedTime);
    gl.uniform1f(this.avatarLegUniforms.zoom, this.camera.zoom);

    gl.bindVertexArray(this.avatarLegVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.avatarLegVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.avatar.legInstanceBuffer);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.avatar.numSegments);
    gl.bindVertexArray(null);

    // 4b. Draw Central Body Parts (Abdomen, Cephalothorax, Mandibles)
    gl.useProgram(this.avatarBodyProgram);
    gl.uniformMatrix3fv(this.avatarBodyUniforms.matrix, false, this.camera.matrix);
    gl.uniform1f(this.avatarBodyUniforms.time, this.elapsedTime);
    gl.uniform1f(this.avatarBodyUniforms.zoom, this.camera.zoom);

    gl.bindVertexArray(this.avatarBodyVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.avatarBodyVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.avatar.bodyInstanceBuffer);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 4);
    gl.bindVertexArray(null);
  }

  calculateTelemetry(now) {
    this.frameCount++;
    if (now - this.fpsTimer >= 200) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = now;

      if (this.onTelemetry) {
        this.onTelemetry({
          fps: this.currentFps,
          cameraX: this.camera.x.toFixed(1),
          cameraY: this.camera.y.toFixed(1),
          cameraZoom: this.camera.zoom.toFixed(2),
          cameraVx: this.camera.vx.toFixed(2),
          cameraVy: this.camera.vy.toFixed(2),
          visibleNodes: this.spatialGrid.visibleNodeCount,
          activeChunks: this.spatialGrid.activeChunkCount,
          totalCachedNodes: this.spatialGrid.totalGeneratedNodes,
          avatarSegments: this.avatar.numSegments,
          avatarBreath: this.avatar.breathScale.toFixed(2)
        });
      }
    }
  }

  destroy() {
    this.stop();
    const gl = this.gl;
    if (this.gridProgram) gl.deleteProgram(this.gridProgram);
    if (this.nodeProgram) gl.deleteProgram(this.nodeProgram);
    if (this.avatarLegProgram) gl.deleteProgram(this.avatarLegProgram);
    if (this.avatarBodyProgram) gl.deleteProgram(this.avatarBodyProgram);
    if (this.gridVAO) gl.deleteVertexArray(this.gridVAO);
    if (this.nodeVAO) gl.deleteVertexArray(this.nodeVAO);
    if (this.avatarLegVAO) gl.deleteVertexArray(this.avatarLegVAO);
    if (this.avatarBodyVAO) gl.deleteVertexArray(this.avatarBodyVAO);
  }
}
