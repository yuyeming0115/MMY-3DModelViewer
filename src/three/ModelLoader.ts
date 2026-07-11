import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

export type ModelFormat = "glb" | "gltf" | "fbx" | "obj" | "ply";

export interface MeshInfo {
  uuid: string;
  name: string;
  materialIndex: number;
  position: { x: number; y: number; z: number };
  vertices: number;
  triangles: number;
}

export interface MaterialInfo {
  uuid: string;
  name: string;
  type: string;
  color: string;
  opacity: number;
  roughness: number;
  metalness: number;
  emissive: string;
  emissiveIntensity: number;
  normalScale: number;
  aoIntensity: number;
  hasMap: boolean;
  hasNormalMap: boolean;
  hasRoughnessMap: boolean;
  hasMetalnessMap: boolean;
  hasAOMap: boolean;
  hasEmissiveMap: boolean;
  hasAlphaMap: boolean;
  mapName?: string;
  normalMapName?: string;
}

export interface ModelStats {
  vertices: number;
  triangles: number;
  meshes: number;
  materials: number;
  textures: number;
  animations: number;
  format: ModelFormat;
  fileName: string;
  fileSize: number;
  meshList: MeshInfo[];
  materialList: MaterialInfo[];
}

export function isSupportedFormat(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ["glb", "gltf", "fbx", "obj", "ply"].includes(ext || "");
}

export function getFormat(fileName: string): ModelFormat {
  return fileName.split(".").pop()?.toLowerCase() as ModelFormat;
}

function colorToHex(color: THREE.Color | undefined): string {
  if (!color) return "#cccccc";
  return "#" + color.getHexString();
}

function extractMaterialInfo(m: any, idx: number): MaterialInfo {
  return {
    uuid: m.uuid,
    name: m.name || `材质 ${idx + 1}`,
    type: m.type || "Material",
    color: colorToHex(m.color),
    opacity: m.opacity ?? 1,
    roughness: m.roughness ?? 0.5,
    metalness: m.metalness ?? 0,
    emissive: colorToHex(m.emissive),
    emissiveIntensity: m.emissiveIntensity ?? 1,
    normalScale: +(m.normalScale?.x ?? 1).toFixed(2),
    aoIntensity: +(m.aoMapIntensity ?? 1).toFixed(2),
    hasMap: !!m.map,
    hasNormalMap: !!m.normalMap,
    hasRoughnessMap: !!m.roughnessMap,
    hasMetalnessMap: !!m.metalnessMap,
    hasAOMap: !!m.aoMap,
    hasEmissiveMap: !!m.emissiveMap,
    hasAlphaMap: !!m.alphaMap,
    mapName: m.map?.name || m.map?.image?.src?.split("/").pop() || undefined,
    normalMapName: m.normalMap?.name || undefined,
  };
}

/** 将 FBX 的 MeshPhongMaterial 转换为 MeshStandardMaterial 以便统一编辑 */
function convertPhongToStandard(model: THREE.Object3D) {
  model.traverse((child: any) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const converted = mats.map((m: any) => {
      if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) return m;
      const sm = new THREE.MeshStandardMaterial({
        name: m.name || "",
        color: m.color ? m.color.clone() : new THREE.Color(0xcccccc),
        map: m.map || null,
        normalMap: m.normalMap || null,
        alphaMap: m.alphaMap || null,
        emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
        emissiveMap: m.emissiveMap || null,
        emissiveIntensity: m.emissiveIntensity ?? 1,
        opacity: m.opacity ?? 1,
        transparent: m.transparent ?? false,
        side: m.side ?? THREE.FrontSide,
        roughness: 0.5,
        metalness: m.specular ? 0.1 : 0,
        flatShading: m.flatShading ?? false,
        wireframe: m.wireframe ?? false,
      });
      m.dispose?.();
      return sm;
    });
    child.material = Array.isArray(child.material) ? converted : converted[0];
  });
}

function computeStats(
  model: THREE.Object3D,
  format: ModelFormat,
  fileName: string,
  fileSize: number,
  animationCount: number
): ModelStats {
  let vertices = 0;
  let triangles = 0;
  let meshCount = 0;
  const matSet = new Map<string, THREE.Material>();
  const meshList: MeshInfo[] = [];

  model.traverse((child: any) => {
    if (!child.isMesh) return;
    meshCount++;
    const geom = child.geometry;
    let mv = 0, mt = 0;
    if (geom) {
      const pos = geom.getAttribute("position");
      if (pos) { mv = pos.count; vertices += pos.count; }
      if (geom.index) mt = geom.index.count / 3;
      else if (pos) mt = pos.count / 3;
      triangles += mt;
    }
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    mats.forEach((m: THREE.Material) => {
      if (m) matSet.set(m.uuid, m);
    });
    const primaryMat = mats[0];
    let matIdx = -1;
    if (primaryMat) {
      let i = 0;
      for (const uuid of matSet.keys()) {
        if (uuid === primaryMat.uuid) { matIdx = i; break; }
        i++;
      }
      if (matIdx === -1) matIdx = matSet.size - 1;
    }
    meshList.push({
      uuid: child.uuid,
      name: child.name || `Mesh_${meshCount}`,
      materialIndex: matIdx,
      position: {
        x: +child.position.x.toFixed(2),
        y: +child.position.y.toFixed(2),
        z: +child.position.z.toFixed(2),
      },
      vertices: mv,
      triangles: Math.floor(mt),
    });
  });

  const materialList: MaterialInfo[] = [];
  let idx = 0;
  for (const m of matSet.values()) {
    materialList.push(extractMaterialInfo(m as any, idx));
    idx++;
  }

  let textCount = 0;
  for (const m of matSet.values()) {
    Object.values(m as any).forEach((v: any) => {
      if (v && v.isTexture) textCount++;
    });
  }

  return {
    vertices,
    triangles: Math.floor(triangles),
    meshes: meshCount,
    materials: matSet.size,
    textures: textCount,
    animations: animationCount,
    format,
    fileName,
    fileSize,
    meshList,
    materialList,
  };
}

export interface LoadResult {
  model: THREE.Object3D;
  stats: ModelStats;
  animations: THREE.AnimationClip[];
}

export async function loadModelFromBuffer(
  buffer: ArrayBuffer,
  format: ModelFormat,
  fileName: string,
  fileSize: number,
  resourceMap?: Map<string, ArrayBuffer>
): Promise<LoadResult> {
  const blob = new Blob([buffer]);
  const url = URL.createObjectURL(blob);

  try {
    let model: THREE.Object3D;
    let animations: THREE.AnimationClip[] = [];

    switch (format) {
      case "glb":
      case "gltf": {
        const loader = new GLTFLoader();
        const manager = new THREE.LoadingManager();
        if (resourceMap && resourceMap.size > 0) {
          manager.setURLModifier((u) => {
            for (const [name, data] of resourceMap) {
              if (u.endsWith(name) || u.includes(name)) {
                return URL.createObjectURL(new Blob([data]));
              }
            }
            return u;
          });
        }
        loader.manager = manager;
        const gltf = await loader.loadAsync(url);
        model = gltf.scene;
        animations = gltf.animations || [];
        break;
      }
      case "fbx": {
        const loader = new FBXLoader();
        model = await loader.loadAsync(url);
        animations = (model as any).animations || [];
        convertPhongToStandard(model);
        break;
      }
      case "obj": {
        const loader = new OBJLoader();
        model = await loader.loadAsync(url);
        convertPhongToStandard(model);
        break;
      }
      case "ply": {
        const loader = new PLYLoader();
        const geom = await loader.loadAsync(url);
        geom.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
          color: 0xb0b4c8,
          roughness: 0.7,
          metalness: 0.1,
          flatShading: true,
        });
        model = new THREE.Mesh(geom, mat);
        model.name = "PLY_Mesh";
        break;
      }
      default:
        throw new Error(`不支持的格式: ${format}`);
    }

    const stats = computeStats(model, format, fileName, fileSize, animations.length);
    return { model, stats, animations };
  } finally {
    URL.revokeObjectURL(url);
  }
}
