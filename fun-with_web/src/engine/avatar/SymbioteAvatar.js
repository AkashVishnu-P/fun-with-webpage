/**
 * SymbioteAvatar.js
 * Represents the Apex Symbiote entity fixed to the viewport center.
 * Manages body morphology, 8 multi-jointed limbs (24 articulated segments),
 * organic micro-movements (breathing, mandible twitches), and instanced GPU buffers.
 */

export class SymbioteAvatar {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.heading = -Math.PI / 2; // Facing "up" initially
    this.targetHeading = -Math.PI / 2;

    // Morphological dimensions (in screen/world pixels)
    this.bodyScale = 1.0;
    this.thoraxRadiusX = 18;
    this.thoraxRadiusY = 24;
    this.abdomenRadiusX = 22;
    this.abdomenRadiusY = 32;
    this.abdomenDistance = 34;

    // Organic micro-movement oscillators
    this.breathPhase = 0;
    this.breathScale = 1.0;
    this.twitchTimer = 0;
    this.leftMandibleAngle = 0;
    this.rightMandibleAngle = 0;

    // 8 Limbs setup (4 on Left side, 4 on Right side)
    // Each limb has 3 segments: [Coxa/Femur, Tibia, Tarsus]
    this.legs = this.initLegs();

    // Pre-allocated typed arrays for WebGL Instanced Leg rendering
    // 24 segments total = 8 legs * 3 segments
    // Per instance: [startX, startY, endX, endY, radiusStart, radiusEnd, legIndex, segmentIndex] (8 floats)
    this.numSegments = 8 * 3;
    this.legInstanceBuffer = new Float32Array(this.numSegments * 8);

    // Body parts buffer: [x, y, radiusX, radiusY, rotation, type, pulse, extra] (8 floats per part)
    // Parts: 0: Cephalothorax, 1: Abdomen, 2: Left Mandible, 3: Right Mandible
    this.bodyInstanceBuffer = new Float32Array(4 * 8);
  }

  initLegs() {
    const legs = [];
    // Leg attachment angles along the thorax perimeter (relative to heading)
    // L1: front-left, L2: mid-front-left, L3: mid-back-left, L4: back-left
    // R1: front-right, R2: mid-front-right, R3: mid-back-right, R4: back-right
    const legConfigs = [
      // Left Side (indices 0..3)
      { side: -1, socketAngle: -0.45, restAngle: -0.75, lengths: [32, 42, 48], radii: [4.2, 3.2, 2.0, 0.8] },
      { side: -1, socketAngle: -0.95, restAngle: -1.25, lengths: [34, 46, 52], radii: [4.4, 3.4, 2.2, 0.8] },
      { side: -1, socketAngle: -1.70, restAngle: -1.95, lengths: [32, 44, 50], radii: [4.2, 3.2, 2.0, 0.8] },
      { side: -1, socketAngle: -2.35, restAngle: -2.55, lengths: [36, 50, 60], radii: [4.6, 3.6, 2.2, 0.8] },
      // Right Side (indices 4..7)
      { side: 1, socketAngle: 0.45, restAngle: 0.75, lengths: [32, 42, 48], radii: [4.2, 3.2, 2.0, 0.8] },
      { side: 1, socketAngle: 0.95, restAngle: 1.25, lengths: [34, 46, 52], radii: [4.4, 3.4, 2.2, 0.8] },
      { side: 1, socketAngle: 1.70, restAngle: 1.95, lengths: [32, 44, 50], radii: [4.2, 3.2, 2.0, 0.8] },
      { side: 1, socketAngle: 2.35, restAngle: 2.55, lengths: [36, 50, 60], radii: [4.6, 3.6, 2.2, 0.8] },
    ];

    for (let i = 0; i < 8; i++) {
      const cfg = legConfigs[i];
      legs.push({
        index: i,
        side: cfg.side,
        socketAngle: cfg.socketAngle,
        restAngle: cfg.restAngle,
        lengths: cfg.lengths,
        radii: cfg.radii,
        // Joint world positions: [Socket, Joint1, Joint2, Foot/Tip]
        joints: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ],
        currentFoot: { x: 0, y: 0 },
        targetFoot: { x: 0, y: 0 },
        isStepping: false,
        stepProgress: 1.0,
        twitchOffset: 0
      });
    }

    return legs;
  }

  update(dt, camera) {
    // 1. Fix avatar anchor to the exact physical center of the camera viewport
    this.x = camera.x;
    this.y = camera.y;

    // 2. Micro-movement & organic breathing calculations
    this.breathPhase += dt * 3.2;
    this.breathScale = 1.0 + Math.sin(this.breathPhase) * 0.05;

    // Mandible twitching
    this.twitchTimer += dt;
    if (this.twitchTimer > 1.2) {
      this.twitchTimer = 0;
      this.leftMandibleAngle = (Math.random() - 0.5) * 0.25;
      this.rightMandibleAngle = (Math.random() - 0.5) * 0.25;
    } else {
      this.leftMandibleAngle *= Math.pow(0.1, dt);
      this.rightMandibleAngle *= Math.pow(0.1, dt);
    }

    // 3. Compute joint positions and resting articulation for all 8 limbs
    let segIdx = 0;
    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);

    for (let i = 0; i < 8; i++) {
      const leg = this.legs[i];

      // Socket attachment point along thorax rim
      const socketWorldAngle = this.heading + leg.socketAngle;
      const socketX = this.x + Math.cos(socketWorldAngle) * (this.thoraxRadiusX * 0.9);
      const socketY = this.y + Math.sin(socketWorldAngle) * (this.thoraxRadiusY * 0.9);
      leg.joints[0].x = socketX;
      leg.joints[0].y = socketY;

      // Rest pose articulation for Phase 1 (smooth natural arachnid limb stance)
      const restWorldAngle = this.heading + leg.restAngle;
      const limbTwitch = Math.sin(this.breathPhase * 1.5 + i * 1.1) * 0.06;
      const totalAngle = restWorldAngle + limbTwitch;

      // Segment 1 (Coxa / Femur): Reaches outward and slightly up
      const a1 = totalAngle + (leg.side * 0.2);
      const j1X = socketX + Math.cos(a1) * leg.lengths[0];
      const j1Y = socketY + Math.sin(a1) * leg.lengths[0];
      leg.joints[1].x = j1X;
      leg.joints[1].y = j1Y;

      // Segment 2 (Tibia): Reaches outward and descends
      const a2 = totalAngle - (leg.side * 0.35);
      const j2X = j1X + Math.cos(a2) * leg.lengths[1];
      const j2Y = j1Y + Math.sin(a2) * leg.lengths[1];
      leg.joints[2].x = j2X;
      leg.joints[2].y = j2Y;

      // Segment 3 (Metatarsus / Tarsus / Foot claw): Reaches to ground contact
      const a3 = totalAngle - (leg.side * 0.85);
      const j3X = j2X + Math.cos(a3) * leg.lengths[2];
      const j3Y = j2Y + Math.sin(a3) * leg.lengths[2];
      leg.joints[3].x = j3X;
      leg.joints[3].y = j3Y;

      // Pack 3 segments into flat GPU instance buffer
      for (let s = 0; s < 3; s++) {
        const pStart = leg.joints[s];
        const pEnd = leg.joints[s + 1];
        const rStart = leg.radii[s];
        const rEnd = leg.radii[s + 1];

        const offset = segIdx * 8;
        this.legInstanceBuffer[offset] = pStart.x;
        this.legInstanceBuffer[offset + 1] = pStart.y;
        this.legInstanceBuffer[offset + 2] = pEnd.x;
        this.legInstanceBuffer[offset + 3] = pEnd.y;
        this.legInstanceBuffer[offset + 4] = rStart;
        this.legInstanceBuffer[offset + 5] = rEnd;
        this.legInstanceBuffer[offset + 6] = i; // legIndex (0..7)
        this.legInstanceBuffer[offset + 7] = s; // segmentIndex (0..2)
        segIdx++;
      }
    }

    // 4. Pack Body parts instance buffer
    // Part 0: Cephalothorax (Head)
    this.packBodyPart(0, this.x, this.y, this.thoraxRadiusX, this.thoraxRadiusY, this.heading, 0, 1.0);

    // Part 1: Abdomen (Opisthosoma) - positioned behind the thorax along negative heading
    const abdX = this.x - cosH * this.abdomenDistance;
    const abdY = this.y - sinH * this.abdomenDistance;
    this.packBodyPart(
      1,
      abdX,
      abdY,
      this.abdomenRadiusX * this.breathScale,
      this.abdomenRadiusY * this.breathScale,
      this.heading,
      1,
      this.breathScale
    );

    // Part 2: Left Mandible / Chelicera
    const leftManAngle = this.heading - 0.25 + this.leftMandibleAngle;
    const leftManX = this.x + Math.cos(this.heading - 0.15) * (this.thoraxRadiusY * 0.95);
    const leftManY = this.y + Math.sin(this.heading - 0.15) * (this.thoraxRadiusY * 0.95);
    this.packBodyPart(2, leftManX, leftManY, 4.0, 10.0, leftManAngle, 2, 1.0);

    // Part 3: Right Mandible / Chelicera
    const rightManAngle = this.heading + 0.25 + this.rightMandibleAngle;
    const rightManX = this.x + Math.cos(this.heading + 0.15) * (this.thoraxRadiusY * 0.95);
    const rightManY = this.y + Math.sin(this.heading + 0.15) * (this.thoraxRadiusY * 0.95);
    this.packBodyPart(3, rightManX, rightManY, 4.0, 10.0, rightManAngle, 2, 1.0);
  }

  packBodyPart(index, x, y, rx, ry, rotation, type, pulse) {
    const off = index * 8;
    this.bodyInstanceBuffer[off] = x;
    this.bodyInstanceBuffer[off + 1] = y;
    this.bodyInstanceBuffer[off + 2] = rx;
    this.bodyInstanceBuffer[off + 3] = ry;
    this.bodyInstanceBuffer[off + 4] = rotation;
    this.bodyInstanceBuffer[off + 5] = type;  // 0: Thorax, 1: Abdomen, 2: Mandibles
    this.bodyInstanceBuffer[off + 6] = pulse;
    this.bodyInstanceBuffer[off + 7] = index;
  }
}
