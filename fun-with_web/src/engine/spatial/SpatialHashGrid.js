/**
 * SpatialHashGrid.js
 * Implements a sliding window spatial partitioning grid for an infinite 2D graph space.
 * Efficiently culls building nodes and connection edges outside the camera viewport bounding box.
 */

// Simple deterministic hash for procedural chunk generation
function hash2D(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export class SpatialHashGrid {
  constructor(chunkSize = 800, nodesPerChunk = 12) {
    this.chunkSize = chunkSize;
    this.nodesPerChunk = nodesPerChunk;
    this.chunks = new Map(); // Key: `${cx},${cy}` -> Array<Node>
    this.edges = new Map();  // Key: `${cx},${cy}` -> Array<Edge>
    
    // Pre-allocated flat buffers for WebGL instancing
    this.maxVisibleNodes = 2048;
    this.instancePositionBuffer = new Float32Array(this.maxVisibleNodes * 2); // [x, y]
    this.instanceAttribBuffer = new Float32Array(this.maxVisibleNodes * 4);   // [radius, type, energy, pulse]
    this.visibleNodeCount = 0;

    // Graph statistics
    this.totalGeneratedNodes = 0;
    this.activeChunkCount = 0;
  }

  /**
   * Get or procedurally generate building nodes within chunk (cx, cy)
   */
  getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (this.chunks.has(key)) {
      return this.chunks.get(key);
    }

    const nodes = [];
    const originX = cx * this.chunkSize;
    const originY = cy * this.chunkSize;

    // Deterministic procedural generation per chunk
    const count = Math.floor(8 + hash2D(cx, cy) * (this.nodesPerChunk - 8));
    for (let i = 0; i < count; i++) {
      const seed1 = hash2D(cx * 100 + i, cy * 100 + i);
      const seed2 = hash2D(cx * 200 + i, cy * 200 + i);
      const seed3 = hash2D(cx * 300 + i, cy * 300 + i);
      const seed4 = hash2D(cx * 400 + i, cy * 400 + i);

      // Padding within chunk to avoid edge clustering
      const padding = 60;
      const x = originX + padding + seed1 * (this.chunkSize - padding * 2);
      const y = originY + padding + seed2 * (this.chunkSize - padding * 2);

      // Building node attributes
      const type = seed3 > 0.85 ? 0 : (seed3 > 0.4 ? 1 : 2); // 0: Tactical Hub, 1: Spire, 2: Anchor Pillar
      const radius = type === 0 ? 22 + seed4 * 10 : (type === 1 ? 14 + seed4 * 8 : 10 + seed4 * 6);
      const pulsePhase = seed4 * Math.PI * 2;
      const baseEnergy = 0.4 + seed3 * 0.5;

      nodes.push({
        id: `${cx}_${cy}_${i}`,
        x,
        y,
        radius,
        type,
        pulsePhase,
        energy: baseEnergy,
        cx,
        cy
      });
    }

    this.chunks.set(key, nodes);
    this.totalGeneratedNodes += nodes.length;
    return nodes;
  }

  /**
   * Sliding Window Query: Returns all nodes inside the viewport bounding box + margin
   * @param {Object} bounds - { minX, minY, maxX, maxY }
   * @param {number} margin - Safety margin in world units
   */
  querySlidingWindow(bounds, margin = 200) {
    const minX = bounds.minX - margin;
    const maxX = bounds.maxX + margin;
    const minY = bounds.minY - margin;
    const maxY = bounds.maxY + margin;

    const minChunkX = Math.floor(minX / this.chunkSize);
    const maxChunkX = Math.floor(maxX / this.chunkSize);
    const minChunkY = Math.floor(minY / this.chunkSize);
    const maxChunkY = Math.floor(maxY / this.chunkSize);

    let count = 0;
    let chunksVisited = 0;

    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        chunksVisited++;
        const chunkNodes = this.getChunk(cx, cy);
        for (let i = 0; i < chunkNodes.length; i++) {
          const node = chunkNodes[i];
          // Sliding window AABB intersection check
          if (node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY) {
            if (count < this.maxVisibleNodes) {
              const posIdx = count * 2;
              const attrIdx = count * 4;

              this.instancePositionBuffer[posIdx] = node.x;
              this.instancePositionBuffer[posIdx + 1] = node.y;

              this.instanceAttribBuffer[attrIdx] = node.radius;
              this.instanceAttribBuffer[attrIdx + 1] = node.type;
              this.instanceAttribBuffer[attrIdx + 2] = node.energy;
              this.instanceAttribBuffer[attrIdx + 3] = node.pulsePhase;

              count++;
            }
          }
        }
      }
    }

    this.visibleNodeCount = count;
    this.activeChunkCount = chunksVisited;

    return {
      nodeCount: count,
      activeChunks: chunksVisited,
      positionBuffer: this.instancePositionBuffer,
      attribBuffer: this.instanceAttribBuffer,
      bounds: { minX, minY, maxX, maxY }
    };
  }

  /**
   * Finds the closest node to a given world coordinate (within maxDistance)
   */
  findNearestNode(worldX, worldY, maxDist = 300) {
    const cx = Math.floor(worldX / this.chunkSize);
    const cy = Math.floor(worldY / this.chunkSize);

    let nearest = null;
    let minDistSq = maxDist * maxDist;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nodes = this.getChunk(cx + dx, cy + dy);
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const distSq = (n.x - worldX) * (n.x - worldX) + (n.y - worldY) * (n.y - worldY);
          if (distSq < minDistSq) {
            minDistSq = distSq;
            nearest = n;
          }
        }
      }
    }
    return nearest;
  }
}
