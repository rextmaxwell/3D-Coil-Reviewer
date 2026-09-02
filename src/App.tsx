import React, { useState, useEffect, useMemo } from 'react';
import { CoilViewer } from './components/CoilViewer';
import { calculateCoil, DEFAULT_PARAMS, CoilParams } from './utils';
import { Disc, Maximize2, Settings2, Upload, AlertCircle, Trash2, Download } from 'lucide-react';
import { parseDFT, parseRIN, DetectorOverlay, Defect, LaneBoundary } from './detectorParser';
import { MappedDefect, deriveDefectLocation } from './defectGeometry';
import Papa from 'papaparse';

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

  const [overlay, setOverlay] = useState<DetectorOverlay>({ defects: [], lanes: [] });
  const [dftFile, setDftFile] = useState<File | null>(null);
  const [rinFile, setRinFile] = useState<File | null>(null);
  const [dftError, setDftError] = useState<string | null>(null);
  const [rinError, setRinError] = useState<string | null>(null);
  const [selectedDefect, setSelectedDefect] = useState<MappedDefect | null>(null);
  const [selectedLaneIndex, setSelectedLaneIndex] = useState<number>(0);

  const handleDftUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDftFile(file);
    setDftError(null);
    try {
      const defects = await parseDFT(file);
      setOverlay(prev => ({ ...prev, defects }));
    } catch (err: any) {
      setDftError(err.message || 'Error parsing DFT');
    }
    e.target.value = '';
  };

  const handleRinUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRinFile(file);
    setRinError(null);
    try {
      const lanes = await parseRIN(file);
      let detectorWidth = undefined;
      if (lanes.length > 0) {
        const minLeft = Math.min(...lanes.map(l => l.left));
        const maxRight = Math.max(...lanes.map(l => l.right));
        detectorWidth = maxRight - minLeft;
        setSelectedLaneIndex(lanes[0].lane);
      }
      setOverlay(prev => ({ ...prev, lanes, detectorWidth }));
    } catch (err: any) {
      setRinError(err.message || 'Error parsing RIN');
    }
    e.target.value = '';
  };

  const clearDefects = () => {
    setOverlay({ defects: [], lanes: [] });
    setDftFile(null);
    setRinFile(null);
    setDftError(null);
    setRinError(null);
    setSelectedDefect(null);
  };

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

  const activeLane = overlay.lanes.find(l => l.lane === selectedLaneIndex);

  const mappedDefects = useMemo(() => {
    if (!activeLane || !overlay.defects.length) return [];
    return overlay.defects
      .map(d => deriveDefectLocation(d, activeLane, params))
      .filter(m => m.isWithinLane);
  }, [overlay.defects, activeLane, params]);

  // Clear selected defect if it's no longer in the filtered list
  useEffect(() => {
    if (selectedDefect && !mappedDefects.some(m => m.defect.flawNumber === selectedDefect.defect.flawNumber)) {
      setSelectedDefect(null);
    }
  }, [mappedDefects, selectedDefect]);

  const handleDownloadCSV = () => {
    if (!activeLane) return;
    const headers = [
      "Flaw Number", "Flaw Type", "Selected Lane", "Flaw Lane Start", "Flaw Lane End", "Camera", 
      "Area (raw)", "Length (raw)", "Width (raw)",
      "DFT File", "RIN File",
      "Detector Crossweb Position [in]", "Detector Downweb Position [ft]", "Detector Ending Position [ft]",
      "Lane Left Boundary [in]", "Lane Right Boundary [in]", "RIN Lane Width [in]",
      "Crossweb From Left Product Edge [in]", "Crossweb From Right Product Edge [in]",
      "Distance From Modeled Head [ft]", "Distance From Modeled Tail [ft]",
      "Radial Distance From ID Surface [in]", "Radial Distance From OD Surface [in]",
      "Radial Position Through Coil [%]",
      "Winding Angle Total [rad]", "Winding Angle Normalized [deg]",
      "Rolled X [in]", "Rolled Y [in]", "Rolled Z [in]",
      "Within Selected RIN Lane", "Within Modeled Width", "Within Modeled Length", "Within ID/OD Radial Range", "Position Valid",
      "Mapping Warning"
    ];
    
    const rows = mappedDefects.map(m => {
      const d = m.defect;
      return [
        d.flawNumber, d.flawType, activeLane.lane, d.laneStart ?? '', d.laneEnd ?? '', d.camera ?? '',
        d.area ?? '', d.length ?? '', d.width ?? '',
        dftFile?.name ?? '', rinFile?.name ?? '',
        d.crossweb.toFixed(3), d.downweb.toFixed(3), d.endingPosition?.toFixed(3) ?? '',
        activeLane.left.toFixed(3), activeLane.right.toFixed(3), (activeLane.right - activeLane.left).toFixed(3),
        m.distanceFromLeftEdge.toFixed(3), m.distanceFromRightEdge.toFixed(3),
        m.distanceFromHead.toFixed(3), m.distanceFromTail.toFixed(3),
        m.distanceFromID.toFixed(3), m.distanceFromOD.toFixed(3),
        m.radialPercent.toFixed(2) + '%',
        m.theta.toFixed(4), m.degrees.toFixed(2),
        m.rolledX.toFixed(3), m.rolledY.toFixed(3), m.rolledZ.toFixed(3),
        m.isWithinLane ? 'Yes' : 'No', m.isWithinModeledWidth ? 'Yes' : 'No', m.isWithinModeledLength ? 'Yes' : 'No', m.isWithinRadialRange ? 'Yes' : 'No', m.positionValid ? 'Yes' : 'No',
        m.warnings.join("; ")
      ];
    });
    
    const csv = Papa.unparse([headers, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = dftFile ? dftFile.name.replace(/\.[^/.]+$/, "") : "Defect-Locations";
    link.download = `${baseName}_Lane-${activeLane.lane}_Defect-Locations.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

          {(() => {
            const rID = params.id / 2;
            const rOD = Math.max(params.od, params.id + 0.1) / 2;
            const expectedLengthIn = Math.PI * (rOD * rOD - rID * rID) / params.thickness;
            const expectedLengthFt = expectedLengthIn / 12;
            const lengthDiff = Math.abs(expectedLengthFt - params.length);
            if (lengthDiff > params.length * 0.05 && params.length > 0) {
              return (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 flex items-start gap-2 mt-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <p>
                    <strong>Geometry Mismatch:</strong> Modeled length is {params.length.toFixed(1)} ft, but calculated length from ID/OD/thickness is {expectedLengthFt.toFixed(1)} ft. Radial mapping may be distorted.
                  </p>
                </div>
              );
            }
            return null;
          })()}

          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 mt-6 pt-6 border-t border-gray-100">
            Defect Overlay
          </h3>
          <div className="space-y-4">
            <p className="text-[10px] leading-tight text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
              <strong>Modeling Assumption:</strong> Radial mapping assumes detector downweb 0 corresponds to the modeled strip head at the ID and modeled coil length terminates at the OD.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DFT File (Defects)</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                  <Upload size={16} />
                  {dftFile ? 'Replace DFT' : 'Upload DFT'}
                  <input type="file" accept=".dft,.csv,.txt" className="hidden" onChange={handleDftUpload} />
                </label>
              </div>
              {dftFile && !dftError && <p className="text-xs text-green-600 mt-1 truncate">Loaded: {dftFile.name} ({overlay.defects.length} defects)</p>}
              {dftError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {dftError}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RIN File (Lanes)</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                  <Upload size={16} />
                  {rinFile ? 'Replace RIN' : 'Upload RIN'}
                  <input type="file" accept=".rin,.txt" className="hidden" onChange={handleRinUpload} />
                </label>
              </div>
              {rinFile && !rinError && <p className="text-xs text-green-600 mt-1 truncate">Loaded: {rinFile.name} ({overlay.lanes.length} lanes)</p>}
              {rinError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {rinError}</p>}
            </div>

            {overlay.detectorWidth !== undefined && Math.abs(overlay.detectorWidth - params.width) > 0.1 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <p>Detector width {overlay.detectorWidth.toFixed(2)} in differs from modeled coil width {params.width.toFixed(2)} in.</p>
              </div>
            )}

            {overlay.lanes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-1">Selected Slit Lane</label>
                <select
                  value={selectedLaneIndex}
                  onChange={(e) => setSelectedLaneIndex(parseInt(e.target.value))}
                  className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm pl-3 pr-10 py-2 border focus:border-blue-500 focus:ring-blue-500"
                >
                  {overlay.lanes.map((lane) => (
                    <option key={lane.lane} value={lane.lane}>
                      Lane {lane.lane} — {lane.left.toFixed(3)} to {lane.right.toFixed(3)} in — {(lane.right - lane.left).toFixed(3)} in wide
                    </option>
                  ))}
                </select>
                
                {activeLane && (
                  <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded p-2 border border-gray-100">
                    <div className="font-bold mb-1 text-gray-700">Lane {activeLane.lane}</div>
                    <div>{mappedDefects.length} defects</div>
                    <div>Crossweb span: {activeLane.left.toFixed(3)}–{activeLane.right.toFixed(3)} in</div>
                    <div>Modeled product width: {params.width.toFixed(3)} in</div>
                    {mappedDefects.some(m => !m.positionValid) && (
                      <div className="text-amber-600 mt-1 font-medium">
                        {mappedDefects.filter(m => !m.positionValid).length} defects outside modeled product geometry
                      </div>
                    )}
                  </div>
                )}
                
                {activeLane && (
                  <button 
                    onClick={handleDownloadCSV}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    <Download size={16} />
                    Download Defect Location Report (.csv)
                  </button>
                )}
              </div>
            )}

            {(dftFile || rinFile) && (
              <button 
                onClick={clearDefects}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors mt-2"
              >
                <Trash2 size={16} />
                Clear Defects
              </button>
            )}
          </div>

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
          mappedDefects={mappedDefects}
          selectedDefect={selectedDefect}
          onSelectDefect={setSelectedDefect}
        />

        {selectedDefect && (
          <div className="absolute bottom-8 right-8 z-10 w-80 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200">
            <h4 className="font-bold text-gray-900 flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
              <span>Flaw #{selectedDefect.defect.flawNumber}</span>
              <button onClick={() => setSelectedDefect(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium text-gray-900">{selectedDefect.defect.flawType}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Crossweb</span><span className="font-medium text-gray-900">{selectedDefect.defect.crossweb?.toFixed(3)} in</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Downweb</span><span className="font-medium text-gray-900">{selectedDefect.defect.downweb?.toFixed(3)} ft</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Dist. from ID</span><span className="font-medium text-gray-900">{selectedDefect.distanceFromID.toFixed(3)} in</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Dist. from OD</span><span className="font-medium text-gray-900">{selectedDefect.distanceFromOD.toFixed(3)} in</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Radial Pos</span><span className="font-medium text-gray-900">{selectedDefect.radialPercent.toFixed(1)}%</span></div>
              {selectedDefect.defect.endingPosition !== undefined && <div className="flex justify-between"><span className="text-gray-500">End Pos</span><span className="font-medium text-gray-900">{selectedDefect.defect.endingPosition.toFixed(3)} ft</span></div>}
              {selectedDefect.defect.laneStart !== undefined && <div className="flex justify-between"><span className="text-gray-500">Lane</span><span className="font-medium text-gray-900">{selectedDefect.defect.laneStart === selectedDefect.defect.laneEnd ? selectedDefect.defect.laneStart : `${selectedDefect.defect.laneStart}-${selectedDefect.defect.laneEnd}`}</span></div>}
              {selectedDefect.defect.area !== undefined && <div className="flex justify-between"><span className="text-gray-500">Area</span><span className="font-medium text-gray-900">{selectedDefect.defect.area.toFixed(3)}</span></div>}
              {selectedDefect.defect.camera && <div className="flex justify-between"><span className="text-gray-500">Camera</span><span className="font-medium text-gray-900">{selectedDefect.defect.camera}</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
