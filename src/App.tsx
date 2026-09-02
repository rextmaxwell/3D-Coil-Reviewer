import React, { useState, useEffect } from 'react';
import { CoilViewer } from './components/CoilViewer';
import { calculateCoil, DEFAULT_PARAMS, CoilParams } from './utils';
import { Disc, Maximize2, Settings2 } from 'lucide-react';

function NumberInput({
  label,
  value,
  unit,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  unit: string;
  onChange?: (val: number) => void;
  disabled?: boolean;
}) {
  const [localVal, setLocalVal] = useState(value.toFixed(3));

  useEffect(() => {
    if (Math.abs(parseFloat(localVal) - value) > 0.0001) {
      setLocalVal(value.toFixed(3));
    }
  }, [value]);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          className={`block w-full rounded-md border-gray-300 shadow-sm sm:text-sm pl-3 pr-16 py-2 border ${
            disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'
          }`}
          value={localVal}
          disabled={disabled}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={() => {
            if (onChange) {
              const n = parseFloat(localVal);
              if (!isNaN(n)) onChange(n);
            }
          }}
          step="any"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <span className="text-gray-500 sm:text-xs font-mono">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [params, setParams] = useState<CoilParams>(() => calculateCoil('od', 48, DEFAULT_PARAMS));
  const [mode, setMode] = useState<'rolled' | 'sheet'>('rolled');
  
  const [sectionStart, setSectionStart] = useState<number>(0);
  const [sectionEnd, setSectionEnd] = useState<number>(100);
  
  const [compressedMode, setCompressedMode] = useState<boolean>(true);
  const [visibleStripLength, setVisibleStripLength] = useState<number>(120);
  const [thicknessMultiplier, setThicknessMultiplier] = useState<number>(50);

  const handleChange = (field: keyof CoilParams, val: number) => {
    setParams((prev) => calculateCoil(field, Math.max(0, val), prev));
  };

  const handleStartChange = (val: number) => {
    const safeVal = Math.max(0, Math.min(val, params.length));
    setSectionStart(safeVal);
    if (safeVal > sectionEnd) setSectionEnd(safeVal);
  };

  const handleEndChange = (val: number) => {
    const safeVal = Math.max(0, Math.min(val, params.length));
    setSectionEnd(safeVal);
    if (safeVal < sectionStart) setSectionStart(safeVal);
  };

  useEffect(() => {
    if (sectionEnd > params.length) setSectionEnd(params.length);
    if (sectionStart > params.length) setSectionStart(Math.max(0, params.length - 100));
  }, [params.length]);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-[400px] bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
        <div className="p-6 border-b border-gray-100 bg-white sticky top-0 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Settings2 size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Aluminum Coil</h1>
          </div>
          <p className="text-sm text-gray-500">Configure dimensions (Imperial units).</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Material Core</h3>
          <NumberInput label="Gauge (Thickness)" value={params.thickness} unit="in" onChange={(val) => handleChange('thickness', val)} />
          <NumberInput label="Width" value={params.width} unit="in" onChange={(val) => handleChange('width', val)} />
          <NumberInput label="Density" value={params.density} unit="lbs/in³" onChange={(val) => handleChange('density', val)} />

          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 mt-6 pt-6 border-t border-gray-100">
            Coil Dimensions
          </h3>
          <NumberInput label="Inner Diameter (ID)" value={params.id} unit="in" onChange={(val) => handleChange('id', val)} />
          <NumberInput label="Outer Diameter (OD)" value={params.od} unit="in" onChange={(val) => handleChange('od', val)} />
          <NumberInput label="Length" value={params.length} unit="ft" onChange={(val) => handleChange('length', val)} />
          <NumberInput label="Total Weight" value={params.weight} unit="lbs" onChange={(val) => handleChange('weight', val)} />

          {mode === 'sheet' && (
            <div className="mt-6 pt-6 border-t border-gray-100 bg-blue-50/50 -mx-6 px-6 py-6 border-b border-gray-200">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-4 flex items-center justify-between">
                Sheet Section
              </h3>
              
              <NumberInput label="Start Footage (Core = 0)" value={sectionStart} unit="ft" onChange={handleStartChange} />
              <NumberInput label="End Footage" value={sectionEnd} unit="ft" onChange={handleEndChange} />
              
              <div className="mb-6 mt-2">
                <div className="text-sm font-semibold text-gray-800">
                  Selected Length: <span className="font-mono text-blue-600">{(sectionEnd - sectionStart).toFixed(1)} ft</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input 
                    type="checkbox" checked={compressedMode} 
                    onChange={(e) => setCompressedMode(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-gray-900">Enable Compressed View</span>
                </label>

                {compressedMode && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="flex justify-between text-xs font-medium text-gray-700 mb-2">
                        <span>Max Visible Strip</span>
                        <span className="font-mono">{visibleStripLength} in</span>
                      </label>
                      <input 
                        type="range" min="12" max="600" step="12"
                        value={visibleStripLength} 
                        onChange={(e) => setVisibleStripLength(parseInt(e.target.value))}
                        className="w-full accent-blue-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="flex justify-between text-xs font-medium text-gray-700 mb-2">
                        <span>Thickness Multiplier</span>
                        <span className="font-mono">{thicknessMultiplier}x</span>
                      </label>
                      <input 
                        type="range" min="1" max="200" step="1"
                        value={thicknessMultiplier} 
                        onChange={(e) => setThicknessMultiplier(parseInt(e.target.value))}
                        className="w-full accent-blue-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative h-full bg-neutral-100 p-4 lg:p-6">
        <div className="absolute top-8 right-8 z-10 flex bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm border border-gray-200">
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all ${
              mode === 'rolled' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setMode('rolled')}
          >
            <Disc size={16} />
            Rolled
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all ${
              mode === 'sheet' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setMode('sheet')}
          >
            <Maximize2 size={16} />
            Sheet View
          </button>
        </div>

        <CoilViewer
          mode={mode}
          thickness={params.thickness} width={params.width} id={params.id} od={params.od} length={params.length}
          sectionStart={sectionStart} sectionEnd={sectionEnd} compressedMode={compressedMode} 
          visibleStripLength={visibleStripLength} thicknessMultiplier={thicknessMultiplier}
        />
      </div>
    </div>
  );
}
