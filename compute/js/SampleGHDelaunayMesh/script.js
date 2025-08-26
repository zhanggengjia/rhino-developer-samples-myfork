// cd "C:\Users\User\rhino-developer-samples\compute\js\SampleGHDelaunayMesh"
// ls
// http-server .

// Import libraries
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import rhino3dm from 'rhino3dm';
import { RhinoCompute } from 'rhinocompute'; // 你目前環境用這個 OK

const definitionName = 'delaunay.gh';
let definition, scene, camera, renderer, controls;

const rhino = await rhino3dm();
console.log('Loaded rhino3dm.');

RhinoCompute.url = 'http://localhost:6001/';
// RhinoCompute.apiKey = ''  // 本機 Hops 不用

// 健檢（確認真的打到 6001）
fetch(`${RhinoCompute.url}healthcheck`)
  .then((r) => r.text())
  .then((t) => console.log('compute health:', t));

// 載 GH 檔
const buffer = await fetch(definitionName).then((r) => r.arrayBuffer());
definition = new Uint8Array(buffer);

init();
compute();

async function compute() {
  // 產隨機點（用 JSON 格式送到 GH，勿 new Point3d）
  const points = [];
  const cntPts = 100,
    bndX = 100,
    bndY = 100,
    bndZ = 10;

  for (let i = 0; i < cntPts; i++) {
    const x = Math.random() * (bndX - -bndX) + -bndX;
    const y = Math.random() * (bndY - -bndY) + -bndY;
    const z = Math.random() * (bndZ - -bndZ) + -bndZ;

    // ✅ 送 JSON 給 GH（這是 Grasshopper Compute 預期的 Point3d 格式）
    points.push(JSON.stringify({ X: x, Y: y, Z: z }));

    // three.js 可視化
    const geo = new THREE.SphereGeometry(1, 5, 5);
    geo.translate(x, y, z);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
    });
    scene.add(new THREE.Mesh(geo, mat));
  }

  // ⚠️ 名稱必須對齊 GH 輸入端 NickName（大小寫也要一樣）
  const ptsTree = new RhinoCompute.Grasshopper.DataTree('points');
  ptsTree.append([0], points);

  const trees = [ptsTree];

  // 呼叫 Compute
  const res = await RhinoCompute.Grasshopper.evaluateDefinition(
    definition,
    trees
  );
  if (!res?.values?.length)
    throw new Error('No values from Compute; check GH input name/type.');

  // 取 mesh（第一個輸出、索引 0 的 branch）
  const raw = res.values[0].InnerTree['{0}']?.[0]?.data;
  if (!raw) throw new Error('No mesh data in InnerTree {0}');
  const mesh = rhino.CommonObject.decode(JSON.parse(raw));

  document.getElementById('loader')?.remove();

  const material = new THREE.MeshBasicMaterial({ wireframe: true });
  const threeMesh = meshToThreejs(mesh, material);
  scene.add(threeMesh);
}

// --- boilerplate (原樣即可) ---
function init() {
  THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // 黑色
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  camera.position.z = 300;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  window.addEventListener('resize', onWindowResize, false);
  animate();
}
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function meshToThreejs(mesh, material) {
  const loader = new THREE.BufferGeometryLoader();
  const geometry = loader.parse(mesh.toThreejsJSON());
  return new THREE.Mesh(geometry, material);
}
