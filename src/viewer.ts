import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Part } from './geometry';

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private model = new THREE.Group();
  private bed = new THREE.Group();
  private lastRadius = 0;
  private bedSize = 0;
  private needsRender = true;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    host.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
    this.camera.position.set(180, 260, 340);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.addEventListener('change', () => (this.needsRender = true));

    const sun = new THREE.DirectionalLight(0xfff6ea, 2.4);
    sun.position.set(-250, 500, 300);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    this.sun = sun;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0xeef2ff, 0x8a8172, 0.55));

    // Model coordinates are print coordinates (Z up). Rotate into three's Y-up world.
    this.model.rotation.x = -Math.PI / 2;
    this.scene.add(this.model, this.bed);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      const moved = this.controls.update();
      if (moved || this.needsRender) {
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
      }
    };
    loop();
  }

  private sun: THREE.DirectionalLight;

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  setBed(size: number) {
    if (size === this.bedSize) return;
    this.bedSize = size;
    this.bed.clear();
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(size, 2, size),
      new THREE.MeshStandardMaterial({ color: 0x9a9d97, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.3 }),
    );
    plate.position.y = -1.01;
    plate.receiveShadow = true;
    const grid = new THREE.GridHelper(size, Math.max(2, Math.round(size / 20)), 0x7f837d, 0x8e918b);
    grid.position.y = 0.02;
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 8, size * 8),
      new THREE.ShadowMaterial({ opacity: 0.12 }),
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -2.05;
    shadowCatcher.receiveShadow = true;
    this.bed.add(plate, grid, shadowCatcher);
    this.needsRender = true;
  }

  setParts(parts: Part[], refit: boolean) {
    for (const child of [...this.model.children]) {
      const m = child as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.model.remove(m);
    }
    const box = new THREE.Box3();
    for (const p of parts) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
      g.setIndex(new THREE.BufferAttribute(p.indices, 1));
      g.computeVertexNormals();
      g.computeBoundingBox();
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: p.previewOnly ? 1 : 0.62,
        metalness: 0,
        flatShading: true,
        envMapIntensity: 0.3,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (p.previewOnly) {
        // fuzzy moss look
        mat.flatShading = false;
      }
      this.model.add(mesh);
      if (!p.previewOnly) box.union(g.boundingBox!);
    }
    if (box.isEmpty()) {
      this.needsRender = true;
      return;
    }
    // Centre on the bed (in model XY), resting on Z=0.
    const c = box.getCenter(new THREE.Vector3());
    this.model.position.set(-c.x, -box.min.z, c.y);
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    this.sun.shadow.camera.left = -radius * 2;
    this.sun.shadow.camera.right = radius * 2;
    this.sun.shadow.camera.top = radius * 2;
    this.sun.shadow.camera.bottom = -radius * 2;
    this.sun.shadow.camera.far = 3000;
    this.sun.position.set(-radius * 1.2, radius * 3 + 200, radius * 1.5 + 100);
    this.sun.shadow.camera.updateProjectionMatrix();
    if (refit || this.lastRadius === 0 || radius > this.lastRadius * 1.6 || radius < this.lastRadius * 0.5) {
      this.fit(radius, size.z);
    }
    this.lastRadius = radius;
    this.needsRender = true;
  }

  fit(radius = this.lastRadius, height = 0) {
    const dist = (radius / Math.tan((this.camera.fov * Math.PI) / 360)) * 1.25 + 10;
    const dir = new THREE.Vector3(0.15, 0.85, 1).normalize();
    this.controls.target.set(0, height * 0.35, 0);
    this.camera.position.copy(dir.multiplyScalar(dist)).add(this.controls.target);
    this.camera.near = Math.max(0.5, dist / 200);
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.needsRender = true;
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
