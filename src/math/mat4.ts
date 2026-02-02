import { Vec4 } from "./vec4";

// We use column-major layout (OpenGL-style):
// | m0  m4  m8  m12 |
// | m1  m5  m9  m13 |
// | m2  m6  m10 m14 |
// | m3  m7  m11 m15 |
//
// Vectors are treated as column vectors and multiplied as: out = M * v.

export class Mat4 {
  readonly m: Float32Array;

  constructor(
    m0 = 1, m1 = 0, m2 = 0, m3 = 0,
    m4 = 0, m5 = 1, m6 = 0, m7 = 0,
    m8 = 0, m9 = 0, m10 = 1, m11 = 0,
    m12 = 0, m13 = 0, m14 = 0, m15 = 1
  ) {
    this.m = new Float32Array([
      m0, m1, m2, m3,
      m4, m5, m6, m7,
      m8, m9, m10, m11,
      m12, m13, m14, m15,
    ]);
  }

  static identity(): Mat4 {
    return new Mat4();
  }

  clone(): Mat4 {
    const a = this.m;
    return new Mat4(
      a[0], a[1], a[2], a[3],
      a[4], a[5], a[6], a[7],
      a[8], a[9], a[10], a[11],
      a[12], a[13], a[14], a[15]
    );
  }

  // Matrix multiplication: out = this * other
  multiply(other: Mat4): Mat4 {
    const a = this.m;
    const b = other.m;

    const m0  = a[0] * b[0]  + a[4] * b[1]  + a[8]  * b[2]  + a[12] * b[3];
    const m1  = a[1] * b[0]  + a[5] * b[1]  + a[9]  * b[2]  + a[13] * b[3];
    const m2  = a[2] * b[0]  + a[6] * b[1]  + a[10] * b[2]  + a[14] * b[3];
    const m3  = a[3] * b[0]  + a[7] * b[1]  + a[11] * b[2]  + a[15] * b[3];

    const m4  = a[0] * b[4]  + a[4] * b[5]  + a[8]  * b[6]  + a[12] * b[7];
    const m5  = a[1] * b[4]  + a[5] * b[5]  + a[9]  * b[6]  + a[13] * b[7];
    const m6  = a[2] * b[4]  + a[6] * b[5]  + a[10] * b[6]  + a[14] * b[7];
    const m7  = a[3] * b[4]  + a[7] * b[5]  + a[11] * b[6]  + a[15] * b[7];

    const m8  = a[0] * b[8]  + a[4] * b[9]  + a[8]  * b[10] + a[12] * b[11];
    const m9  = a[1] * b[8]  + a[5] * b[9]  + a[9]  * b[10] + a[13] * b[11];
    const m10 = a[2] * b[8]  + a[6] * b[9]  + a[10] * b[10] + a[14] * b[11];
    const m11 = a[3] * b[8]  + a[7] * b[9]  + a[11] * b[10] + a[15] * b[11];

    const m12 = a[0] * b[12] + a[4] * b[13] + a[8]  * b[14] + a[12] * b[15];
    const m13 = a[1] * b[12] + a[5] * b[13] + a[9]  * b[14] + a[13] * b[15];
    const m14 = a[2] * b[12] + a[6] * b[13] + a[10] * b[14] + a[14] * b[15];
    const m15 = a[3] * b[12] + a[7] * b[13] + a[11] * b[14] + a[15] * b[15];

    return new Mat4(
      m0, m1, m2, m3,
      m4, m5, m6, m7,
      m8, m9, m10, m11,
      m12, m13, m14, m15
    );
  }

  // Transform a Vec4 (column vector): out = this * v
  transformVec4(v: Vec4): Vec4 {
    const a = this.m;
    const x = v.x, y = v.y, z = v.z, w = v.w;
    return new Vec4(
      a[0] * x + a[4] * y + a[8]  * z + a[12] * w,
      a[1] * x + a[5] * y + a[9]  * z + a[13] * w,
      a[2] * x + a[6] * y + a[10] * z + a[14] * w,
      a[3] * x + a[7] * y + a[11] * z + a[15] * w
    );
  }

  static translation(tx: number, ty: number, tz: number): Mat4 {
    return new Mat4(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1
    );
  }

  static scaling(sx: number, sy: number, sz: number): Mat4 {
    return new Mat4(
      sx, 0,  0,  0,
      0,  sy, 0,  0,
      0,  0,  sz, 0,
      0,  0,  0,  1
    );
  }

  static rotationX(rad: number): Mat4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Mat4(
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    );
  }

  static rotationY(rad: number): Mat4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Mat4(
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    );
  }

  static rotationZ(rad: number): Mat4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Mat4(
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    );
  }

  /** Transpose (swap rows and columns). */
  transpose(): Mat4 {
    const a = this.m;
    return new Mat4(
      a[0], a[4], a[8], a[12],
      a[1], a[5], a[9], a[13],
      a[2], a[6], a[10], a[14],
      a[3], a[7], a[11], a[15]
    );
  }

  /** Inverse of the matrix. Returns null if singular. */
  inverse(): Mat4 | null {
    const a = this.m;
    const m0 = a[0], m1 = a[1], m2 = a[2], m3 = a[3];
    const m4 = a[4], m5 = a[5], m6 = a[6], m7 = a[7];
    const m8 = a[8], m9 = a[9], m10 = a[10], m11 = a[11];
    const m12 = a[12], m13 = a[13], m14 = a[14], m15 = a[15];

    const s0 = m0 * m5 - m1 * m4, s1 = m0 * m6 - m2 * m4, s2 = m0 * m7 - m3 * m4;
    const s3 = m1 * m6 - m2 * m5, s4 = m1 * m7 - m3 * m5, s5 = m2 * m7 - m3 * m6;
    const c5 = m10 * m15 - m11 * m14, c4 = m9 * m15 - m11 * m13, c3 = m9 * m14 - m10 * m13;
    const c2 = m8 * m15 - m11 * m12, c1 = m8 * m14 - m10 * m12, c0 = m8 * m13 - m9 * m12;

    const det = s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0;
    if (Math.abs(det) < 1e-10) return null;
    const invDet = 1 / det;

    return new Mat4(
      (m5 * c5 - m6 * c4 + m7 * c3) * invDet,
      (-m1 * c5 + m2 * c4 - m3 * c3) * invDet,
      (m13 * s5 - m14 * s4 + m15 * s3) * invDet,
      (-m9 * s5 + m10 * s4 - m11 * s3) * invDet,
      (-m4 * c5 + m6 * c2 - m7 * c1) * invDet,
      (m0 * c5 - m2 * c2 + m3 * c1) * invDet,
      (-m12 * s5 + m14 * s2 - m15 * s1) * invDet,
      (m8 * s5 - m10 * s2 + m11 * s1) * invDet,
      (m4 * c4 - m5 * c2 + m7 * c0) * invDet,
      (-m0 * c4 + m1 * c2 - m3 * c0) * invDet,
      (m12 * s4 - m13 * s2 + m15 * s0) * invDet,
      (-m8 * s4 + m9 * s2 - m11 * s0) * invDet,
      (-m4 * c3 + m5 * c1 - m6 * c0) * invDet,
      (m0 * c3 - m1 * c1 + m2 * c0) * invDet,
      (-m12 * s3 + m13 * s1 - m14 * s0) * invDet,
      (m8 * s3 - m9 * s1 + m10 * s0) * invDet
    );
  }

  /** Normal matrix for transforming normals: (viewModel)^-T (inverse transpose of upper 3x3). */
  normalMatrix(): Mat4 | null {
    const inv = this.inverse();
    return inv ? inv.transpose() : null;
  }

  // Perspective projection matrix (right-handed, looking down -Z)
  static perspective(fovYRad: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1.0 / Math.tan(fovYRad / 2);
    const rangeInv = 1.0 / (near - far);

    return new Mat4(
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * rangeInv, -1,
      0, 0, (2 * far * near) * rangeInv, 0
    );
  }
}

