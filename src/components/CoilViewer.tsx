import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Bounds, Grid } from '@react-three/drei';
import * as THREE from 'three';

interface CoilViewerProps {
  mode: 'rolled' | 'sheet';
  thickness: number;
  width: number;
  id: number;
  od: number;
  length: number;
  sectionStart: number;
  sectionEnd: number;
  compressedMode: boolean;
  visibleStripLength: number;
  thicknessMultiplier: number;
}

function Rolled({ id, od, width }: { id: number; od: number; width: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const safeOD = Math.max(od, id + 0.1);
    shape.absarc(0, 0, safeOD / 2, 0, Math.PI * 2, false);
    
    if (id > 0) {
      const hole = new THREE.Path();
      hole.absarc(0, 0, id / 2, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: false,
      curveSegments: 128,
    });
    
    geom.center();
    geom.translate(0, safeOD / 2, 0);
    return geom;
  }, [id, od, width]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial 
        color="#e4e4e7" 
        metalness={0.7} 
        roughness={0.3} 
        side={THREE.DoubleSide} 
      />
    </mesh>
  );
}

interface SheetSectionProps {
  sectionStart: number;
  sectionEnd: number;
  thickness: number;
  width: number;
  compressedMode: boolean;
  visibleStripLength: number;
  thicknessMultiplier: number;
}

function SheetSection({ sectionStart, sectionEnd, thickness, width, compressedMode, visibleStripLength, thicknessMultiplier }: SheetSectionProps) {
  const actualStripLength = Math.max(0, sectionEnd - sectionStart) * 12; // inches
  const drawLength = compressedMode ? Math.min(visibleStripLength, actualStripLength) : actualStripLength;
  const drawThickness = compressedMode ? thickness * thicknessMultiplier : thickness;

  const safeDrawLength = Math.max(0.001, drawLength);

  const stripGeometry = useMemo(() => {
    const geom = new THREE.BoxGeometry(safeDrawLength, drawThickness, width);
    // Center it on Y axis so it sits nicely, and keep X centered.
    geom.translate(0, drawThickness / 2, 0);
    return geom;
  }, [safeDrawLength, drawThickness, width]);

  return (
    drawLength > 0 ? (
      <mesh geometry={stripGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#e4e4e7" metalness={0.7} roughness={0.3} />
      </mesh>
    ) : null
  );
}

export function CoilViewer({ 
  mode, thickness, width, id, od, length, sectionStart, sectionEnd, compressedMode, visibleStripLength, thicknessMultiplier 
}: CoilViewerProps) {
  
  const actualStripLength = Math.max(0, sectionEnd - sectionStart) * 12;
  const drawLength = compressedMode ? Math.min(visibleStripLength, actualStripLength) : actualStripLength;
  const lengthScale = actualStripLength > 0 ? (drawLength / actualStripLength) : 1;

  return (
    <div className="w-full h-full bg-neutral-900 rounded-xl overflow-hidden shadow-inner relative flex flex-col">
      <Canvas camera={{ position: [200, 200, 200], fov: 45 }} shadows>
        <color attach="background" args={['#171717']} />
        <Environment preset="warehouse" />
        <ambientLight intensity={0.4} />
        <directionalLight position={[100, 100, 50]} intensity={1.5} castShadow shadow-mapSize={1024} />
        
        <Bounds fit clip observe margin={1.2}>
          {mode === 'rolled' ? (
            <Rolled id={id} od={od} width={width} />
          ) : (
            <SheetSection 
              sectionStart={sectionStart} sectionEnd={sectionEnd} 
              thickness={thickness} width={width} 
              compressedMode={compressedMode} 
              visibleStripLength={visibleStripLength} 
              thicknessMultiplier={thicknessMultiplier} 
            />
          )}
        </Bounds>

        <Grid infiniteGrid fadeDistance={Math.max(od * 5, 2000)} sectionColor="#333" cellColor="#222" />
        <OrbitControls makeDefault />
      </Canvas>
      
      <div className="absolute top-4 left-4 text-xs font-mono text-neutral-400 bg-neutral-900/80 px-2 py-1 rounded">
        Drag to rotate • Scroll to zoom
      </div>

      {mode === 'sheet' && compressedMode && actualStripLength > 0 && (
        <div className="absolute bottom-4 left-4 text-xs font-mono text-blue-400 bg-blue-900/40 border border-blue-800/80 px-3 py-2 rounded backdrop-blur-md">
          <div className="font-bold mb-1 uppercase tracking-wider text-blue-300">Compressed Scale Active</div>
          <div>Thickness Exaggeration: {thicknessMultiplier}x</div>
          <div>Strip Length Rendered: {(lengthScale * 100).toFixed(1)}%</div>
          <div className="text-neutral-400 mt-1">({drawLength.toFixed(1)}" visible out of {actualStripLength.toFixed(1)}" actual)</div>
        </div>
      )}
    </div>
  );
}
