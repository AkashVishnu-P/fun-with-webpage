/**
 * Camera2D.js
 * Represents a physical camera mass suspended in infinite 2D world space.
 * Provides projection matrices, screen/world conversions, and viewport bounding box computation.
 */

export class Camera2D {
  constructor(width = window.innerWidth, height = window.innerHeight) {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.width = width;
    this.height = height;
    this.dpr = window.devicePixelRatio || 1;
    this.friction = 0.94;
    this.mass = 1.0;

    // Transformation Matrix (3x3 column-major for 2D GLSL shaders)
    this.matrix = new Float32Array(9);
    this.updateMatrix();
  }

  resize(width, height, dpr = window.devicePixelRatio || 1) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.updateMatrix();
  }

  update(dt = 1 / 60) {
    // Physical velocity integration & smooth deceleration
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    this.vx *= Math.pow(this.friction, dt * 60);
    this.vy *= Math.pow(this.friction, dt * 60);

    // Stop micro-drifts
    if (Math.abs(this.vx) < 0.001) this.vx = 0;
    if (Math.abs(this.vy) < 0.001) this.vy = 0;

    // Smooth zoom interpolation
    this.zoom += (this.targetZoom - this.zoom) * 0.1;

    this.updateMatrix();
  }

  applyImpulse(fx, fy) {
    this.vx += fx / this.mass;
    this.vy += fy / this.mass;
  }

  updateMatrix() {
    // Computes orthographic 2D projection matrix mapping world coords to WebGL clip space [-1, 1]
    const sx = (2 * this.zoom) / this.width;
    const sy = -(2 * this.zoom) / this.height; // Invert Y for top-down coordinate system

    const tx = -this.x * sx;
    const ty = -this.y * sy;

    // 3x3 Orthographic Matrix (Column-Major)
    // [ sx,  0, tx ]
    // [  0, sy, ty ]
    // [  0,  0,  1 ]
    this.matrix[0] = sx;
    this.matrix[1] = 0;
    this.matrix[2] = 0;

    this.matrix[3] = 0;
    this.matrix[4] = sy;
    this.matrix[5] = 0;

    this.matrix[6] = tx;
    this.matrix[7] = ty;
    this.matrix[8] = 1;
  }

  screenToWorld(screenX, screenY) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const worldX = this.x + (screenX - halfW) / this.zoom;
    const worldY = this.y + (screenY - halfH) / this.zoom;
    return { x: worldX, y: worldY };
  }

  worldToScreen(worldX, worldY) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const screenX = (worldX - this.x) * this.zoom + halfW;
    const screenY = (worldY - this.y) * this.zoom + halfH;
    return { x: screenX, y: screenY };
  }

  getViewportBounds() {
    const halfW = (this.width / 2) / this.zoom;
    const halfH = (this.height / 2) / this.zoom;
    return {
      minX: this.x - halfW,
      minY: this.y - halfH,
      maxX: this.x + halfW,
      maxY: this.y + halfH
    };
  }
}
