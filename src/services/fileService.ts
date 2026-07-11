import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

export interface PickedFile {
  name: string;
  path: string;
  size: number;
  buffer: ArrayBuffer;
}

const SUPPORTED_EXTS = ["glb", "gltf", "fbx", "obj", "ply"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "tga", "hdr"];

/** 通过 Tauri 对话框选择单个模型文件 */
export async function pickModelFile(): Promise<PickedFile | null> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: "3D 模型", extensions: SUPPORTED_EXTS },
    ],
  });

  if (!selected || typeof selected !== "string") return null;
  return await loadPickedFile(selected);
}

/** 通过 Tauri 对话框选择单个贴图文件 */
export async function pickImageFile(): Promise<PickedFile | null> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: "图片", extensions: IMAGE_EXTS },
    ],
  });
  if (!selected || typeof selected !== "string") return null;
  return await loadPickedFile(selected);
}

/** 根据路径加载文件信息与内容 */
export async function loadPickedFile(path: string): Promise<PickedFile> {
  const name = path.split(/[\\/]/).pop() || "model";
  const bytes = await readFile(path);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, path, size: buffer.byteLength, buffer };
}
