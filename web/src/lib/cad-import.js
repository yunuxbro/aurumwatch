import { calculateClosedMeshVolume, UNIT_TO_MM } from "./cad-geometry";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
let occtModulePromise;

async function loadOcctModule() {
  if (!occtModulePromise) {
    const loading = new Promise((resolve, reject) => {
      if (typeof window.occtimportjs === "function") {
        resolve(window.occtimportjs);
        return;
      }

      const script = document.createElement("script");
      script.src = "/cad/occt-import-js.js";
      script.async = true;
      script.onload = () => {
        if (typeof window.occtimportjs !== "function") {
          reject(new Error("The STEP/IGES parser loaded without its initialization function."));
          return;
        }
        resolve(window.occtimportjs);
      };
      script.onerror = () => reject(new Error("Could not load the local STEP/IGES parser."));
      document.head.append(script);
    }).then((createModule) => createModule({
      locateFile: (fileName) => `/cad/${fileName}`,
    }));
    occtModulePromise = loading.catch((error) => {
      occtModulePromise = null;
      throw error;
    });
  }
  return occtModulePromise;
}

async function addOcctMeshes(root, result, THREE) {
  if (!result.success || !Array.isArray(result.meshes) || result.meshes.length === 0) {
    throw new Error("The CAD file did not contain readable 3D geometry.");
  }

  for (const [index, item] of result.meshes.entries()) {
    const position = item.attributes?.position?.array;
    if (!Array.isArray(position) || position.length < 9) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    const meshIndices = item.index?.array;
    if (Array.isArray(meshIndices) && meshIndices.length > 0) {
      geometry.setIndex(meshIndices);
    }
    geometry.computeVertexNormals();
    const color = item.color;
    const material = new THREE.MeshStandardMaterial({
      color: color?.length === 3
        ? new THREE.Color(color[0], color[1], color[2])
        : new THREE.Color("#c3a86f"),
      metalness: 0.68,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = item.name || `CAD part ${index + 1}`;
    root.add(mesh);
  }
}

function addDxfEntity(THREE, root, entity) {
  const points = [];
  const pushPoint = (point) => {
    if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
      points.push(point.x, point.y, Number.isFinite(point.z) ? point.z : 0);
    }
  };
  let closed = false;

  if (entity.type === "LINE") {
    pushPoint(entity.vertices?.[0] || entity.startPoint);
    pushPoint(entity.vertices?.[1] || entity.endPoint);
  } else if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
    (entity.vertices || []).forEach(pushPoint);
    closed = Boolean(entity.shape || entity.closed);
  } else if (entity.type === "CIRCLE" || entity.type === "ARC") {
    const segments = 64;
    const start = entity.type === "ARC" ? entity.startAngle : 0;
    let end = entity.type === "ARC" ? entity.endAngle : Math.PI * 2;
    if (entity.type === "ARC" && end <= start) end += Math.PI * 2;
    for (let index = 0; index <= segments; index += 1) {
      const angle = start + (end - start) * index / segments;
      pushPoint({
        x: entity.center.x + Math.cos(angle) * entity.radius,
        y: entity.center.y + Math.sin(angle) * entity.radius,
        z: entity.center.z || 0,
      });
    }
    closed = entity.type === "CIRCLE";
  } else if (entity.type === "SPLINE") {
    (entity.fitPoints?.length ? entity.fitPoints : entity.controlPoints || []).forEach(pushPoint);
  }

  if (points.length < 6) return false;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color: "#b99b63" });
  root.add(closed ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material));
  return true;
}

async function parseDxf(file) {
  const [{ default: DxfParser }, THREE] = await Promise.all([
    import("dxf-parser"),
    import("three"),
  ]);
  const drawing = new DxfParser().parse(await file.text());
  if (!drawing?.entities?.length) {
    throw new Error("The DXF file contains no supported drawing entities.");
  }
  const root = new THREE.Group();
  root.name = file.name;
  const supportedEntities = drawing.entities
    .map((entity) => addDxfEntity(THREE, root, entity))
    .filter(Boolean).length;
  if (supportedEntities === 0) {
    throw new Error("The DXF file contains no previewable 2D lines, arcs, or circles.");
  }
  return {
    root,
    parts: [],
    isDrawing: true,
    note: `2D preview only: ${supportedEntities} drawing entities. Add a verified weight for pricing.`,
  };
}

async function parseModel(file, extension, unit) {
  const THREE = await import("three");
  const buffer = await file.arrayBuffer();
  let root;
  let scaleToMm = UNIT_TO_MM[unit];

  if (extension === "stl") {
    const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
    const geometry = new STLLoader().parse(buffer);
    root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: "#c3a86f", metalness: 0.68, roughness: 0.3,
    })));
  } else if (extension === "obj") {
    const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
    root = new OBJLoader().parse(new TextDecoder().decode(buffer));
  } else if (extension === "3mf") {
    const { ThreeMFLoader } = await import("three/addons/loaders/3MFLoader.js");
    root = new ThreeMFLoader().parse(buffer);
  } else if (extension === "glb" || extension === "gltf") {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(buffer, "", resolve, reject);
    });
    root = gltf.scene;
    scaleToMm = 1000;
  } else if (extension === "3dm") {
    const { Rhino3dmLoader } = await import("three/addons/loaders/3DMLoader.js");
    const loader = new Rhino3dmLoader();
    loader.setLibraryPath("/cad/");
    root = await new Promise((resolve, reject) => {
      loader.parse(buffer, resolve, reject);
    });
  } else if (extension === "step" || extension === "stp" || extension === "iges" || extension === "igs") {
    const occt = await loadOcctModule();
    const content = new Uint8Array(buffer);
    const settings = { linearUnit: "millimeter" };
    const result = extension === "iges" || extension === "igs"
      ? occt.ReadIgesFile(content, settings)
      : occt.ReadStepFile(content, settings);
    root = new THREE.Group();
    root.name = file.name;
    await addOcctMeshes(root, result, THREE);
    scaleToMm = 1;
  } else {
    throw new Error(`The .${extension} format is not supported.`);
  }

  root.name ||= file.name;
  return { root, parts: [], isDrawing: false, note: null, scaleToMm };
}

export async function importCadFile(file, unit) {
  if (!file) throw new Error("Select a design file first.");
  if (file.size === 0) throw new Error("The selected design file is empty.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Design files must be 50 MB or smaller for local browser processing.");
  }
  if (!(unit in UNIT_TO_MM)) throw new Error("Select the units used by the design file.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) throw new Error("The selected file has no extension.");
  const drawingExtensions = new Set(["dxf"]);
  const modelExtensions = new Set([
    "stl", "obj", "3mf", "glb", "gltf", "3dm", "step", "stp", "iges", "igs",
  ]);
  if (!drawingExtensions.has(extension) && !modelExtensions.has(extension)) {
    throw new Error("Use STL, OBJ, 3MF, GLB/glTF, Rhino 3DM, STEP/STP, IGES/IGS, or DXF.");
  }

  const parsed = drawingExtensions.has(extension)
    ? await parseDxf(file)
    : await parseModel(file, extension, unit);
  const { root, isDrawing, note } = parsed;
  root.updateMatrixWorld(true);
  const parts = [];
  let meshIndex = 0;
  let renderableObjectCount = 0;
  root.traverse((object) => {
    if (object.isMesh || object.isLine || object.isLineSegments || object.isPoints) {
      renderableObjectCount += 1;
    }
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const analysis = calculateClosedMeshVolume(
      geometry.attributes.position.array,
      geometry.index?.array,
      parsed.scaleToMm,
    );
    const id = `part-${meshIndex++}`;
    object.userData.studioPartId = id;
    parts.push({
      id,
      name: object.name || `Part ${meshIndex}`,
      closed: analysis.closed,
      volumeMm3: analysis.volumeMm3,
      reason: analysis.reason,
    });
    geometry.dispose();
  });

  if (renderableObjectCount === 0) {
    if (extension === "3dm") {
      throw new Error(
        "This Rhino file has no embedded mesh for local preview. Export a mesh from Rhino (STL or 3MF) to preview and estimate volume; B-rep-only 3DM files are not meshed by this private, browser-only tool.",
      );
    }
    throw new Error("The file contains no renderable 3D geometry.");
  }

  return { root, parts, isDrawing, note, extension };
}
