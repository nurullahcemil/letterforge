import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import type { DragInfo, Part } from './geometry';

// three-mesh-bvh: raycasts walk a bounding-volume tree instead of every triangle (big models stay
// smooth to hover and drag). Trees are built lazily, the first time a mesh is raycast.
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/** Print check colours. */
const CHECK_OK = new THREE.Color(0xc9ccc6);
const CHECK_OVERHANG = new THREE.Color(0xd6453d);
const CHECK_THIN = new THREE.Color(0xe7a531);
export const CHECK_OVERHANG_DEG = 45;
/** Straight down, then 45° down in 8 directions. */
const CONE = [new THREE.Vector3(0, 0, -1), ...Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4), -1).normalize())];
export const CHECK_THIN_MM = 0.8;
/** Thin-wall rays are only cast on meshes up to this many triangles (keeps the check quick). */
const CHECK_THIN_MAX_TRIS = 400_000;

export interface CheckResult {
  overhang: number; // share of the surface area, 0–1
  thin: number;
  thinChecked: boolean;
}

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
    this.ensureBVH();
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
      (m.geometry as any).disposeBoundsTree?.();
      m.geometry.dispose();
      (m.userData.indexed as THREE.BufferGeometry | undefined)?.dispose();
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
    if (this.checking) this.onCheck?.(this.applyCheck());
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

  private ensureBVH() {
    for (const c of this.model.children) {
      const g = (c as THREE.Mesh).geometry as any;
      if (g && !g.boundsTree && g.index) g.computeBoundsTree();
    }
  }

  // ---------- print check ----------
  private checking = false;
  /** Called with the result each time the check is (re)applied. */
  onCheck: ((r: CheckResult | null) => void) | null = null;

  /** Turn the print check view on or off. */
  setCheck(on: boolean): CheckResult | null {
    this.checking = on;
    const r = this.applyCheck();
    this.onCheck?.(r);
    return r;
  }

  /**
   * Colour every printed part: red = faces that point down more than 45° from upright (they need
   * support; the bottom resting on the bed is fine), amber = walls thinner than 0.8 mm (a ray from
   * each face, straight in, hits the other side that soon). Preview-only parts are hidden.
   */
  private applyCheck(): CheckResult | null {
    let area = 0, over = 0, thin = 0;
    let thinChecked = true;
    const cosLimit = Math.cos((CHECK_OVERHANG_DEG * Math.PI) / 180);
    const ray = new THREE.Raycaster();
    ray.firstHitOnly = true as any;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const n = new THREE.Vector3(), mid = new THREE.Vector3(), back = new THREE.Vector3();
    const down = new THREE.Vector3(0, 0, -1);
    // everything printed, for "is there something right under this face?" (stacked parts, bands)
    const below: THREE.Mesh[] = [];
    if (this.checking) {
      for (const child of this.model.children) {
        if (child.userData.previewOnly) continue;
        const src = ((child.userData.indexed as THREE.BufferGeometry | undefined) ?? (child as THREE.Mesh).geometry) as any;
        if (!src.index) continue;
        if (!src.boundsTree) src.computeBoundsTree();
        const pm = new THREE.Mesh(src, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        pm.position.copy(child.position); // dragged parts
        pm.updateMatrixWorld();
        below.push(pm);
      }
    }
    for (const child of this.model.children) {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mesh.userData.baseColor ??= mat.color.getHex();
      if (mesh.userData.previewOnly) {
        mesh.visible = !this.checking;
        continue;
      }
      const g = mesh.geometry;
      if (!this.checking) {
        if (g.getAttribute('color')) g.deleteAttribute('color');
        mat.vertexColors = false;
        mat.color.setHex(mesh.userData.baseColor);
        mat.needsUpdate = true;
        continue;
      }
      // per-face colours need unshared corners: work on a non-indexed copy kept on the mesh
      if (g.index) {
        const flat = g.toNonIndexed();
        flat.computeVertexNormals();
        mesh.userData.indexed = g;
        mesh.geometry = flat;
      }
      const fg = mesh.geometry;
      const pos = fg.getAttribute('position') as THREE.BufferAttribute;
      const tris = pos.count / 3;
      const colors = new Float32Array(pos.count * 3);
      const src = mesh.userData.indexed as THREE.BufferGeometry | undefined;
      const doThin = tris <= CHECK_THIN_MAX_TRIS && !!src;
      if (!doThin) thinChecked = false;
      if (doThin && !(src as any).boundsTree) (src as any).computeBoundsTree();
      // the far side of a wall is seen from behind: the probe must hit back faces too
      const probe = doThin ? new THREE.Mesh(src, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })) : null;
      let zMin = Infinity;
      for (let i = 0; i < pos.count; i++) zMin = Math.min(zMin, pos.getZ(i));
      for (let t = 0; t < tris; t++) {
        a.fromBufferAttribute(pos, 3 * t);
        b.fromBufferAttribute(pos, 3 * t + 1);
        c.fromBufferAttribute(pos, 3 * t + 2);
        n.subVectors(c, b).cross(back.subVectors(a, b));
        const ar = n.length() / 2;
        if (ar < 1e-9) continue;
        n.normalize();
        area += ar;
        let col = CHECK_OK;
        const onBed = Math.max(a.z, b.z, c.z) < zMin + 0.05;
        let overhang = n.z < -cosLimit && !onBed;
        if (overhang) {
          // resting on another part (or the band below) is not an overhang
          // like a slicer: material within a 45° cone below (a short ledge next to it) holds it up
          mid.addVectors(a, b).add(c).divideScalar(3).add(mesh.position);
          for (const d of CONE) {
            ray.set(back.copy(mid).addScaledVector(down, 0.001), d);
            ray.far = 1.2;
            if (ray.intersectObjects(below, false).length) {
              overhang = false;
              break;
            }
          }
        }
        if (overhang) {
          col = CHECK_OVERHANG;
          over += ar;
        } else if (probe) {
          mid.addVectors(a, b).add(c).divideScalar(3);
          ray.set(back.copy(mid).addScaledVector(n, -0.005), n.clone().negate());
          ray.far = CHECK_THIN_MM;
          const hit = ray.intersectObject(probe, false)[0];
          if (hit && hit.distance < CHECK_THIN_MM) {
            col = CHECK_THIN;
            thin += ar;
          }
        }
        for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], (3 * t + k) * 3);
      }
      fg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      mat.vertexColors = true;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    }
    if (!this.checking) {
      // back to the shared-corner meshes (smaller, and what dragging uses)
      for (const child of this.model.children) {
        const mesh = child as THREE.Mesh;
        const src = mesh.userData.indexed as THREE.BufferGeometry | undefined;
        if (src) {
          mesh.geometry.dispose();
          mesh.geometry = src;
          delete mesh.userData.indexed;
        }
      }
    }
    this.needsRender = true;
    return this.checking && area > 0 ? { overhang: over / area, thin: thin / area, thinChecked } : null;
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
