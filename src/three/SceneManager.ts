import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type ViewPreset = "front" | "back" | "left" | "right" | "top" | "bottom" | "perspective";
export type DisplayMode = "solid" | "wireframe" | "normals";
export type BgColor = "dark" | "light" | "gray" | "transparent";
export type MapChannel = "map" | "normalMap" | "roughnessMap" | "metalnessMap" | "aoMap" | "emissiveMap" | "alphaMap";

const BG_COLORS: Record<BgColor, string> = {
  dark: "#1a1a1a",
  light: "#ffffff",
  gray: "#808080",
  transparent: "#000000",
};

export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private gridHelper: THREE.GridHelper;
  private axesHelper: THREE.AxesHelper;
  private clock = new THREE.Clock();
  private container: HTMLElement;
  private animFrameId = 0;
  private currentModel: THREE.Object3D | null = null;

  private initialCamPos = new THREE.Vector3(5, 5, 5);
  private initialTarget = new THREE.Vector3(0, 2, 0);
  private modelCenter = new THREE.Vector3(0, 0, 0);
  private modelRadius = 4;
  private currentDisplayMode: DisplayMode = "solid";
  private animMixer: THREE.AnimationMixer | null = null;
  private animClips: THREE.AnimationClip[] = [];
  private currentAction: THREE.AnimationAction | null = null;
  private animSpeed = 1.0;

  // 选中高亮
  private selectedMesh: THREE.Mesh | null = null;
  private selectionOutline: THREE.LineSegments | null = null;
  // 材质映射: uuid -> Material（去重引用）
  private materialMap = new Map<string, THREE.MeshStandardMaterial>();
  // 环境光照
  private envMap: THREE.Texture | null = null;
  private dirLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private envRotY = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x1a1a1a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    );
    this.camera.position.copy(this.initialCamPos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(this.initialTarget);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.dirLight.position.set(10, 10, 10);
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    this.scene.add(this.ambientLight, this.dirLight, this.hemiLight);

    // 环境贴图（RoomEnvironment 作为 HDR 替代，提供 PBR 反射）
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 1.0;
    this.scene.environmentRotation = new THREE.Euler(0, 0, 0);

    this.gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x555555);
    this.scene.add(this.gridHelper);
    this.axesHelper = new THREE.AxesHelper(3);
    this.axesHelper.visible = false;
    this.scene.add(this.axesHelper);

    this.onResize = this.onResize.bind(this);
    window.addEventListener("resize", this.onResize);
    this.animate();
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    this.controls.update();
    if (this.animMixer) {
      this.animMixer.update(delta);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setModel(model: THREE.Object3D, animations?: THREE.AnimationClip[]) {
    this.clearModel();
    this.currentModel = model;
    this.scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4 / maxDim;
    model.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    const scaledSize = scaledBox.getSize(new THREE.Vector3());
    model.position.x -= scaledCenter.x;
    model.position.z -= scaledCenter.z;
    model.position.y -= scaledBox.min.y;

    this.modelCenter.set(0, scaledSize.y / 2, 0);
    this.modelRadius = Math.max(scaledSize.x, scaledSize.y, scaledSize.z) * 0.9;

    // 收集材质映射
    this.materialMap.clear();
    model.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m: any) => {
          if (m && m.isMeshStandardMaterial) this.materialMap.set(m.uuid, m);
        });
      }
    });

    // 保存动画片段，由 UI 控制播放
    this.animClips = animations && animations.length > 0 ? animations : [];
    this.currentAction = null;
    if (this.animClips.length > 0) {
      this.animMixer = new THREE.AnimationMixer(model);
    } else {
      this.animMixer = null;
    }

    this.setView("perspective");
  }

  /** 获取所有动画片段信息 */
  getAnimations(): { name: string; duration: number; index: number }[] {
    return this.animClips.map((clip, i) => ({
      name: clip.name || `动作 ${i + 1}`,
      duration: clip.duration,
      index: i,
    }));
  }

  /** 播放指定索引的动画 */
  playAnimation(index: number) {
    if (!this.animMixer || index < 0 || index >= this.animClips.length) return;
    // 停止当前动作
    if (this.currentAction) {
      this.currentAction.fadeOut(0.2);
    }
    const action = this.animMixer.clipAction(this.animClips[index]);
    action.reset();
    action.setEffectiveTimeScale(this.animSpeed);
    action.setEffectiveWeight(1);
    action.fadeIn(0.2);
    action.play();
    this.currentAction = action;
  }

  /** 暂停/恢复 */
  setAnimationPaused(paused: boolean) {
    if (this.currentAction) {
      if (paused) this.currentAction.paused = true;
      else this.currentAction.paused = false;
    }
  }

  /** 设置播放速度（0~3） */
  setAnimationSpeed(speed: number) {
    this.animSpeed = speed;
    if (this.currentAction) {
      this.currentAction.setEffectiveTimeScale(speed);
    }
  }

  /** 停止所有动画 */
  stopAnimation() {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  clearModel() {
    this.clearSelection();
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.disposeObject(this.currentModel);
      this.currentModel = null;
    }
    this.materialMap.clear();
    this.animMixer = null;
    this.animClips = [];
    this.currentAction = null;
    this.animSpeed = 1.0;
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((child: any) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m: any) => {
            Object.values(m).forEach((v: any) => {
              if (v && v.isTexture) v.dispose();
            });
            m.dispose?.();
          });
        }
      }
    });
  }

  // ===== 视角 =====
  setView(preset: ViewPreset) {
    const r = this.modelRadius * 2.2;
    const c = this.modelCenter;
    let pos: THREE.Vector3;
    let target = c.clone();

    switch (preset) {
      case "front": pos = new THREE.Vector3(c.x, c.y, c.z + r); break;
      case "back": pos = new THREE.Vector3(c.x, c.y, c.z - r); break;
      case "left": pos = new THREE.Vector3(c.x - r, c.y, c.z); break;
      case "right": pos = new THREE.Vector3(c.x + r, c.y, c.z); break;
      case "top": pos = new THREE.Vector3(c.x, c.y + r, c.z); break;
      case "bottom": pos = new THREE.Vector3(c.x, c.y - r, c.z); break;
      case "perspective":
      default: pos = new THREE.Vector3(c.x + r * 0.7, c.y + r * 0.5, c.z + r * 0.7); break;
    }
    this.animateCamera(pos, target);
  }

  resetView() {
    if (this.currentModel) {
      this.setView("perspective");
    } else {
      this.animateCamera(this.initialCamPos.clone(), this.initialTarget.clone());
    }
  }

  private animateCamera(toPos: THREE.Vector3, toTarget: THREE.Vector3) {
    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const duration = 400;
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.camera.position.lerpVectors(fromPos, toPos, ease);
      this.controls.target.lerpVectors(fromTarget, toTarget, ease);
      this.controls.update();
      if (t < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  // ===== 显示模式 =====
  setDisplayMode(mode: DisplayMode) {
    this.currentDisplayMode = mode;
    if (!this.currentModel) return;
    // 简单实现：wireframe 切换所有材质的 wireframe 属性
    this.materialMap.forEach((m: any) => {
      if (m.wireframe !== undefined) m.wireframe = (mode === "wireframe");
    });
    // normals 模式需要替换材质，暂时用 emissive 近似（简化）
    if (mode === "normals") {
      this.materialMap.forEach((m: any) => {
        if (m.isMeshStandardMaterial) {
          m.color.set(0xaaaaaa);
          m.roughness = 0.8;
          m.metalness = 0;
          m.flatShading = true;
          m.needsUpdate = true;
        }
      });
    }
  }

  setGridVisible(visible: boolean) {
    this.gridHelper.visible = visible;
  }
  setAxesVisible(visible: boolean) {
    this.axesHelper.visible = visible;
  }
  setBackground(bg: BgColor) {
    if (bg === "transparent") {
      this.renderer.setClearColor(0x000000, 0);
    } else {
      this.renderer.setClearColor(new THREE.Color(BG_COLORS[bg]), 1);
    }
  }

  // ===== Mesh 选中/高亮 =====
  selectMesh(uuid: string | null) {
    this.clearSelection();
    if (!uuid || !this.currentModel) return;
    let found: THREE.Mesh | null = null;
    this.currentModel.traverse((child: any) => {
      if (child.isMesh && child.uuid === uuid) found = child;
    });
    if (!found) return;
    this.selectedMesh = found;

    // 创建线框高亮
    const edges = new THREE.EdgesGeometry((found as THREE.Mesh).geometry, 1);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x165dff, linewidth: 2, transparent: true, opacity: 0.9 });
    this.selectionOutline = new THREE.LineSegments(edges, lineMat);
    (found as THREE.Mesh).add(this.selectionOutline);
  }

  clearSelection() {
    if (this.selectedMesh && this.selectionOutline) {
      this.selectedMesh.remove(this.selectionOutline);
      this.selectionOutline.geometry.dispose();
      (this.selectionOutline.material as THREE.Material).dispose();
    }
    this.selectedMesh = null;
    this.selectionOutline = null;
  }

  // ===== 材质编辑 =====
  getMaterial(uuid: string): THREE.MeshStandardMaterial | null {
    return this.materialMap.get(uuid) ?? null;
  }

  setMaterialColor(uuid: string, hex: string) {
    const m = this.getMaterial(uuid) as any;
    if (m && m.color) m.color.set(hex);
  }
  setMaterialRoughness(uuid: string, v: number) {
    const m = this.getMaterial(uuid) as any;
    if (m && m.roughness !== undefined) m.roughness = v;
  }
  setMaterialMetalness(uuid: string, v: number) {
    const m = this.getMaterial(uuid) as any;
    if (m && m.metalness !== undefined) m.metalness = v;
  }
  setMaterialOpacity(uuid: string, v: number) {
    const m = this.getMaterial(uuid) as any;
    if (!m) return;
    m.opacity = v;
    m.transparent = v < 1;
  }
  setMaterialEmissive(uuid: string, hex: string) {
    const m = this.getMaterial(uuid) as any;
    if (m && m.emissive) m.emissive.set(hex);
  }
  setMaterialEmissiveIntensity(uuid: string, v: number) {
    const m = this.getMaterial(uuid) as any;
    if (m && m.emissiveIntensity !== undefined) m.emissiveIntensity = v;
  }
  setMaterialNormalScale(uuid: string, v: number) {
    const m = this.getMaterial(uuid) as any;
    if (m && m.normalScale) m.normalScale.set(v, v);
  }
  setMaterialAOIntensity(uuid: string, v: number) {
    const m = this.getMaterial(uuid) as any;
    if (m && m.aoMapIntensity !== undefined) m.aoMapIntensity = v;
  }

  /** 替换指定材质通道的贴图 */
  async setMaterialMap(uuid: string, channel: MapChannel, imageBuffer: ArrayBuffer, fileName: string) {
    const m = this.getMaterial(uuid) as any;
    if (!m) return;
    const blob = new Blob([imageBuffer]);
    const url = URL.createObjectURL(blob);
    const loader = new THREE.TextureLoader();
    const texture = await loader.loadAsync(url);
    texture.colorSpace = channel === "map" || channel === "emissiveMap" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    // 释放旧贴图
    if (m[channel]) {
      m[channel].dispose();
    }
    m[channel] = texture;
    // 根据通道自动配置材质标志
    if (channel === "map") {
      // 颜色贴图：检测是否带透明通道（png/webp），自动开启 alphaTest
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const hasAlpha = ["png", "webp", "gif", "tga", "bmp"].includes(ext);
      if (hasAlpha) {
        m.alphaTest = 0.3;
        m.side = THREE.DoubleSide;
        m.transparent = false;
        m.needsUpdate = true;
      }
    } else if (channel === "alphaMap") {
      m.transparent = true;
      m.alphaTest = 0;
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    }
    m.needsUpdate = true;
    URL.revokeObjectURL(url);
  }

  /** 清除指定材质通道的贴图 */
  clearMaterialMap(uuid: string, channel: MapChannel) {
    const m = this.getMaterial(uuid) as any;
    if (!m || !m[channel]) return;
    m[channel].dispose();
    m[channel] = null;
    m.needsUpdate = true;
  }

  /** 导出指定材质的贴图为 DataURL */
  exportTexture(uuid: string, channel: MapChannel, format: "png" | "jpg" | "webp" = "png"): string | null {
    const m = this.getMaterial(uuid) as any;
    if (!m || !m[channel] || !m[channel].image) return null;
    const img = m[channel].image;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL(`image/${format}`, format === "jpg" ? 0.92 : undefined);
  }

  /** 获取指定贴图通道的缩略图 DataURL（用于 UI 预览，尺寸小） */
  getTextureThumbnail(uuid: string, channel: MapChannel, size = 40): string | null {
    const m = this.getMaterial(uuid) as any;
    if (!m || !m[channel] || !m[channel].image) return null;
    const img = m[channel].image;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // 保持长宽比居中裁剪成方形
    const s = Math.min(img.width, img.height);
    const sx = (img.width - s) / 2;
    const sy = (img.height - s) / 2;
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  }

  /** 重新收集当前模型所有材质的信息（贴图导入/删除后刷新 UI 用） */
  refreshMaterialList(): void {
    if (!this.currentModel) return;
    const matMap = new Map<string, THREE.MeshStandardMaterial>();
    this.currentModel.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (mat && !matMap.has(mat.uuid)) {
          // 确保所有材质都是 MeshStandardMaterial（phong/fbx 材质已在 ModelLoader 转换）
          if ((mat as any).isMeshStandardMaterial) {
            matMap.set(mat.uuid, mat as THREE.MeshStandardMaterial);
          } else {
            // 动态转换遗留材质
            const std = new THREE.MeshStandardMaterial({
              color: (mat as any).color?.getHex?.() ?? 0xcccccc,
              map: (mat as any).map ?? null,
              normalMap: (mat as any).normalMap ?? null,
              roughnessMap: (mat as any).roughnessMap ?? null,
              metalnessMap: (mat as any).metalnessMap ?? null,
              aoMap: (mat as any).aoMap ?? null,
              alphaMap: (mat as any).alphaMap ?? null,
              emissiveMap: (mat as any).emissiveMap ?? null,
              transparent: (mat as any).transparent ?? false,
              opacity: (mat as any).opacity ?? 1,
              roughness: (mat as any).roughness ?? 0.5,
              metalness: (mat as any).metalness ?? 0,
              emissive: (mat as any).emissive ?? new THREE.Color(0x000000),
              emissiveIntensity: (mat as any).emissiveIntensity ?? 1,
              name: mat.name,
            });
            mesh.material = std;
            matMap.set(std.uuid, std);
          }
        }
      });
    });
    this.materialMap = matMap;
  }

  /** 获取所有材质的 MaterialInfo 列表 */
  getMaterialInfos() {
    const infos: {
      uuid: string; name: string; type: string; color: string; opacity: number;
      roughness: number; metalness: number; emissive: string; emissiveIntensity: number;
      hasMap: boolean; hasNormalMap: boolean; hasRoughnessMap: boolean; hasMetalnessMap: boolean;
      hasAOMap: boolean; hasEmissiveMap: boolean; hasAlphaMap: boolean;
      mapName?: string; normalMapName?: string; normalScale: number; aoIntensity: number;
    }[] = [];
    this.materialMap.forEach((m) => {
      infos.push({
        uuid: m.uuid,
        name: m.name || "材质",
        type: m.type,
        color: "#" + m.color.getHexString(),
        opacity: +m.opacity.toFixed(2),
        roughness: +m.roughness.toFixed(2),
        metalness: +m.metalness.toFixed(2),
        emissive: "#" + m.emissive.getHexString(),
        emissiveIntensity: +m.emissiveIntensity.toFixed(2),
        hasMap: !!m.map,
        hasNormalMap: !!m.normalMap,
        hasRoughnessMap: !!m.roughnessMap,
        hasMetalnessMap: !!m.metalnessMap,
        hasAOMap: !!m.aoMap,
        hasEmissiveMap: !!m.emissiveMap,
        hasAlphaMap: !!m.alphaMap,
        mapName: (m.map as any)?.name,
        normalMapName: (m.normalMap as any)?.name,
        normalScale: +(m.normalScale?.x ?? 1).toFixed(2),
        aoIntensity: +(m.aoMapIntensity ?? 1).toFixed(2),
      });
    });
    return infos;
  }

  // ===== 相机信息 =====
  getCameraAngle(): number {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const angle = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
    return Math.round(angle);
  }
  getZoomLevel(): number {
    const dist = this.camera.position.distanceTo(this.controls.target);
    const base = this.currentModel ? this.modelRadius * 2.2 : 8;
    return +(base / dist).toFixed(1);
  }
  setZoomLevel(factor: number) {
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    const base = this.currentModel ? this.modelRadius * 2.2 : 8;
    const dist = base / Math.max(0.1, factor);
    this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(dist));
    this.controls.update();
  }

  /** 设置 HDR 环境光强度 (0~3) */
  setLightIntensity(v: number) {
    this.scene.environmentIntensity = v;
    this.ambientLight.intensity = v * 0.6;
    this.dirLight.intensity = v;
    this.hemiLight.intensity = v * 0.4;
  }

  /** 设置 HDR 环境贴图水平旋转角度 (0~360°) */
  setEnvironmentRotation(degrees: number) {
    this.envRotY = degrees;
    const rad = (degrees * Math.PI) / 180;
    // 旋转环境贴图（PBR 反射方向）
    if ((this.scene as any).environmentRotation) {
      (this.scene as any).environmentRotation.y = rad;
    }
    // 同步旋转方向光（模拟太阳绕模型旋转，让阴影/高光响应明显）
    const baseRadius = 10;
    const baseHeight = 10;
    this.dirLight.position.set(
      Math.cos(rad) * baseRadius,
      baseHeight,
      Math.sin(rad) * baseRadius,
    );
  }

  getBoundingBox(): { x: number; y: number; z: number } | null {
    if (!this.currentModel) return null;
    const box = new THREE.Box3().setFromObject(this.currentModel);
    const size = box.getSize(new THREE.Vector3());
    return { x: +size.x.toFixed(2), y: +size.y.toFixed(2), z: +size.z.toFixed(2) };
  }

  captureScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  /** 获取 2D UV 检视数据：返回每个 mesh-material 组合的 UV 线框和贴图 */
  getUV2DData(): UV2DData[] {
    const results: UV2DData[] = [];
    if (!this.currentModel) return results;

    this.currentModel.traverse((child: any) => {
      if (!child.isMesh || !child.geometry) return;
      const mesh = child as THREE.Mesh;
      const geo = mesh.geometry as THREE.BufferGeometry;
      const uvAttr = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
      if (!uvAttr) return;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const groups = geo.groups && geo.groups.length > 0
        ? geo.groups
        : [{ start: 0, count: geo.index ? geo.index.count : (uvAttr.count), materialIndex: 0 }];

      groups.forEach((grp) => {
        const mat = mats[grp.materialIndex ?? 0];
        if (!mat) return;
        const stdMat = mat as any;

        const index = geo.index;
        const triangleCount = Math.floor(grp.count / 3);
        const edges = new Set<string>();
        const segments: [number, number][] = [];

        for (let t = 0; t < triangleCount; t++) {
          const i0 = grp.start + t * 3;
          let a: number, b: number, c: number;
          if (index) {
            a = index.getX(i0);
            b = index.getX(i0 + 1);
            c = index.getX(i0 + 2);
          } else {
            a = i0; b = i0 + 1; c = i0 + 2;
          }
          const triEdges: [number, number][] = [[a, b], [b, c], [c, a]];
          triEdges.forEach(([i1, i2]) => {
            const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
            if (!edges.has(key)) {
              edges.add(key);
              segments.push([i1, i2]);
            }
          });
        }

        const uvs: number[] = [];
        segments.forEach(([i1, i2]) => {
          uvs.push(
            uvAttr.getX(i1), 1 - uvAttr.getY(i1),
            uvAttr.getX(i2), 1 - uvAttr.getY(i2),
          );
        });

        let textureUrl: string | null = null;
        if (stdMat.map && stdMat.map.image) {
          try {
            const img = stdMat.map.image;
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              textureUrl = canvas.toDataURL("image/png");
            }
          } catch { /* ignore */ }
        }

        results.push({
          meshName: mesh.name || "Mesh",
          materialName: stdMat.name || "材质",
          meshUuid: mesh.uuid,
          materialUuid: stdMat.uuid,
          uvSegments: new Float32Array(uvs),
          triangleCount,
          textureUrl,
          textureName: (stdMat.map as any)?.name || undefined,
        });
      });
    });
    return results;
  }

  dispose() {
    window.removeEventListener("resize", this.onResize);
    cancelAnimationFrame(this.animFrameId);
    this.clearModel();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

export interface UV2DData {
  meshName: string;
  materialName: string;
  meshUuid: string;
  materialUuid: string;
  uvSegments: Float32Array;
  triangleCount: number;
  textureUrl: string | null;
  textureName?: string;
}
