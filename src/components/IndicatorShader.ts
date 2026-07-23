import { GlProgram, Shader, Geometry, Mesh } from 'pixi.js';

// Native GLSL Vertex Shader for drawing indicator arrays
const vertexSrc = `
  precision mediump float;
  in vec2 aPosition;
  uniform mat3 uProjectionMatrix;
  uniform mat3 uTranslationMatrix;
  
  void main() {
    gl_Position = vec4((uProjectionMatrix * uTranslationMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  }
`;

// Native GLSL Fragment Shader for coloring the indicator
const fragmentSrc = `
  precision mediump float;
  uniform vec4 uColor;
  
  void main() {
    gl_FragColor = uColor;
  }
`;

export function createIndicatorMesh(points, colorHex) {
  // Convert color to vec4
  const r = ((colorHex >> 16) & 0xFF) / 255.0;
  const g = ((colorHex >> 8) & 0xFF) / 255.0;
  const b = (colorHex & 0xFF) / 255.0;

  const geometry = new Geometry({
    attributes: {
      aPosition: points // Float32Array [x1, y1, x2, y2...]
    },
    topology: 'line-strip'
  });

  const program = GlProgram.from({ vertex: vertexSrc, fragment: fragmentSrc });
  const shader = new Shader({
    glProgram: program,
    resources: {
      uniforms: {
        uColor: { value: [r, g, b, 1.0], type: 'vec4<f32>' }
      }
    }
  });

  return new Mesh({ geometry, shader });
}
