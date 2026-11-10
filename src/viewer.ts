import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { DragInfo, Part } from './geometry';

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
  private raycaster = new THREE.Raycaster();
  private dragState: {
    info: DragInfo;
    meshes: THREE.Mesh[];
    plane: THREE.Plane;
    start: THREE.Vector3;
    local: THREE.Vector3;
  } | null = null;
  onDragEnd: (key: DragInfo['key'], a: number, b: number) => void = () => {};
  /** A click (no drag) on the canvas: the model point that was hit (model coordinates), or null. */
  onPick: (point: THREE.Vector3 | null, clientX: number, clientY: number) => void = () => {};
  private downAt: { x: number; y: number } | null = null;
  /** Letter keys to highlight (e.g. the selected letter). */
  private highlightKey: string | null = null;

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

    this.setupDrag();
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

  private ray(e: PointerEvent): THREE.Raycaster {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster;
  }

  private pickDraggable(e: PointerEvent) {
    const hits = this.ray(e).intersectObjects(this.model.children, false);
    const hit = hits[0];
    if (!hit) return null;
    const info = hit.object.userData.drag as DragInfo | undefined;
    return info ? { info, point: hit.point } : null;
  }

  /** World-space direction of a model axis (0 = x, 1 = y, 2 = z). */
  private axisWorld(i: number): THREE.Vector3 {
    const v = new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
    return v.applyQuaternion(this.model.quaternion).normalize();
  }

  private setupDrag() {
    const el = this.renderer.domElement;
    // Capture phase so we can switch off orbiting before OrbitControls sees the event.
    el.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return;
        this.downAt = { x: e.clientX, y: e.clientY };
        const pick = this.pickDraggable(e);
        if (!pick) return;
        const [a, b] = pick.info.axes;
        const normal = new THREE.Vector3().crossVectors(this.axisWorld(a), this.axisWorld(b)).normalize();
        const meshes = this.model.children.filter((c) => (c.userData.drag as DragInfo | undefined)?.key === pick.info.key) as THREE.Mesh[];
        this.dragState = {
          info: pick.info,
          meshes,
          plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, pick.point),
          start: pick.point.clone(),
          local: new THREE.Vector3(),
        };
        this.controls.enabled = false;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';
      },
      { capture: true },
    );
    el.addEventListener('pointermove', (e) => {
      const d = this.dragState;
      if (!d) {
        el.style.cursor = this.pickDraggable(e) ? 'grab' : '';
        return;
      }
      const hit = new THREE.Vector3();
      if (!this.ray(e).ray.intersectPlane(d.plane, hit)) return;
      // world delta -> model-local delta, keeping only the two drag axes
      const delta = hit.sub(d.start).applyQuaternion(this.model.quaternion.clone().invert());
      const [a, b] = d.info.axes;
      d.local.set(0, 0, 0);
      d.local.setComponent(a, delta.getComponent(a));
      d.local.setComponent(b, delta.getComponent(b));
      for (const m of d.meshes) m.position.copy(d.local);
      this.needsRender = true;
    });
    const end = (e: PointerEvent) => {
      const down = this.downAt;
      this.downAt = null;
      if (e.type === 'pointerup' && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const hit = this.ray(e)
          .intersectObjects(this.model.children, false)
          .find((h) => !h.object.userData.previewOnly);
        this.onPick(hit ? this.model.worldToLocal(hit.point.clone()) : null, e.clientX, e.clientY);
      }
      const d = this.dragState;
      if (!d) return;
      this.dragState = null;
      this.controls.enabled = true;
      el.style.cursor = '';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const [a, b] = d.info.axes;
      const da = d.local.getComponent(a);
      const db = d.local.getComponent(b);
      if (Math.abs(da) + Math.abs(db) > 0.2) this.onDragEnd(d.info.key, da, db);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

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
      if (p.drag) mesh.userData.drag = p.drag;
      if (p.previewOnly) mesh.userData.previewOnly = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (p.previewOnly) {
        // fuzzy moss look
        mat.flatShading = false;
      }
      this.model.add(mesh);
      if (!p.previewOnly) box.union(g.boundingBox!);
    }
    if (this.highlightKey) this.highlight(this.highlightKey);
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

  /** Tint the parts with this drag key (null clears). */
  highlight(key: string | null) {
    this.highlightKey = key;
    for (const c of this.model.children) {
      const m = c as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial;
      const on = key !== null && (m.userData.drag as DragInfo | undefined)?.key === key;
      mat.emissive.setHex(on ? 0x2a6cff : 0x000000);
      mat.emissiveIntensity = on ? 0.35 : 0;
    }
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

  /** Screen position (CSS px, relative to the canvas) of the centre of the first part with this drag key. */
  screenPointOf(key: DragInfo['key']): { x: number; y: number } | null {
    const m = this.model.children.find((c) => (c.userData.drag as DragInfo | undefined)?.key === key) as THREE.Mesh | undefined;
    if (!m) return null;
    this.model.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(m);
    const p = box.getCenter(new THREE.Vector3()).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** Picture of the whole model from the default angle, leaving the user's camera as it was. */
  snapshotFitted(): string {
    const pos = this.camera.position.clone();
    const target = this.controls.target.clone();
    const near = this.camera.near;
    const far = this.camera.far;
    this.fit();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.needsRender = true;
    return url;
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
