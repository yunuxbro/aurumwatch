"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function ModelViewer({ model, includedPartIds }) {
  const canvasRef = useRef(null);
  const [viewerError, setViewerError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!model || !canvas) return undefined;

    let renderer;
    let frameId;
    let resizeObserver;
    let errorTimer;
    const ownedGeometries = [];
    const ownedMaterials = [];
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100000);
      scene.add(new THREE.HemisphereLight(0xfff4dd, 0x343b42, 2.2));
      const keyLight = new THREE.DirectionalLight(0xfff3d4, 3.2);
      keyLight.position.set(6, 8, 10);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xb9c6d3, 1.5);
      fillLight.position.set(-7, 2, -5);
      scene.add(fillLight);

      const object = model.clone(true);
      object.traverse((child) => {
        if (child.isMesh) {
          child.visible = !child.userData.studioPartId ||
            includedPartIds.has(child.userData.studioPartId);
          child.geometry = child.geometry.clone();
          ownedGeometries.push(child.geometry);
          const material = new THREE.MeshStandardMaterial({
            color: "#c5a96f",
            metalness: 0.72,
            roughness: 0.28,
            side: THREE.DoubleSide,
          });
          child.material = material;
          ownedMaterials.push(material);
        } else if (child.isLine || child.isLineSegments) {
          const material = new THREE.LineBasicMaterial({ color: "#c5a96f" });
          child.material = material;
          ownedMaterials.push(material);
        }
      });
      scene.add(object);

      const bounds = new THREE.Box3().setFromObject(object);
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const extent = Math.max(size.x, size.y, size.z, 1);
        object.position.sub(center);
        camera.position.set(extent * 1.65, extent * 1.2, extent * 2.5);
        camera.near = Math.max(extent / 1000, 0.01);
        camera.far = extent * 100;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }

      const resize = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas.parentElement);
      resize();

      let dragging = false;
      let previousX = 0;
      let previousY = 0;
      const pointerDown = (event) => {
        dragging = true;
        previousX = event.clientX;
        previousY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
      };
      const pointerMove = (event) => {
        if (!dragging) return;
        object.rotation.y += (event.clientX - previousX) * 0.01;
        object.rotation.x += (event.clientY - previousY) * 0.01;
        previousX = event.clientX;
        previousY = event.clientY;
      };
      const pointerUp = () => { dragging = false; };
      canvas.addEventListener("pointerdown", pointerDown);
      canvas.addEventListener("pointermove", pointerMove);
      canvas.addEventListener("pointerup", pointerUp);
      canvas.addEventListener("pointercancel", pointerUp);

      const render = () => {
        frameId = window.requestAnimationFrame(render);
        if (!dragging) object.rotation.y += 0.002;
        renderer.render(scene, camera);
      };
      render();

      return () => {
        window.cancelAnimationFrame(frameId);
        resizeObserver?.disconnect();
        canvas.removeEventListener("pointerdown", pointerDown);
        canvas.removeEventListener("pointermove", pointerMove);
        canvas.removeEventListener("pointerup", pointerUp);
        canvas.removeEventListener("pointercancel", pointerUp);
        ownedGeometries.forEach((geometry) => geometry.dispose());
        ownedMaterials.forEach((material) => material.dispose());
        renderer.dispose();
      };
    } catch (error) {
      console.error("Could not initialize the CAD preview:", error);
      errorTimer = window.setTimeout(() => {
        setViewerError("3D preview is unavailable in this browser. The imported file and estimate remain available.");
      }, 0);
      renderer?.dispose();
      return () => window.clearTimeout(errorTimer);
    }
  }, [model, includedPartIds]);

  return (
    <div className="model-viewer">
      <canvas ref={canvasRef} aria-label="Interactive uploaded jewellery model" />
      {viewerError && <p className="model-viewer-error" role="status">{viewerError}</p>}
      {!viewerError && <span className="model-viewer-hint">Drag to rotate</span>}
    </div>
  );
}
