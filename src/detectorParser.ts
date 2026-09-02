import Papa from 'papaparse';

export interface Defect {
  flawNumber: string;
  flawType: string;
  crossweb: number;
  downweb: number;
  endingPosition?: number;
  length?: number;
  width?: number;
  area?: number;
  laneStart?: number;
  laneEnd?: number;
  camera?: string;
  raw?: Record<string, string>;
}

export interface LaneBoundary {
  lane: number;
  left: number;
  right: number;
}

export interface DetectorOverlay {
  defects: Defect[];
  lanes: LaneBoundary[];
  detectorWidth?: number;
}

export async function parseDFT(file: File): Promise<Defect[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  
  let headerRowIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Flaw #') && lines[i].includes('Flaw Type')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Could not find DFT header row containing "Flaw #" and "Flaw Type".');
  }

  const csvContent = lines.slice(headerRowIndex).join('\n');
  
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const defects: Defect[] = [];
        
        for (const row of results.data as Record<string, string>[]) {
          const flawNumber = row['Flaw #'];
          // Sometimes PapaParse returns an empty row if it hits a blank line at the end, etc.
          // Or if there's a Stop Inspection event, it might not have Flaw #.
          if (!flawNumber || row['Flaw Type'] === 'Start Inspection' || row['Flaw Type'] === 'Stop Inspection' || row['Flaw Type'] === 'Overflow') {
            continue;
          }

          const parseFloatSafe = (val: string | undefined) => {
            if (!val || val.trim() === '') return undefined;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? undefined : parsed;
          };

          defects.push({
            flawNumber: row['Flaw #'],
            flawType: row['Flaw Type'],
            crossweb: parseFloatSafe(row['Flaw Crossweb Position']) || 0,
            downweb: parseFloatSafe(row['Flaw Downweb Position']) || 0,
            endingPosition: parseFloatSafe(row['Flaw Ending Position']),
            length: parseFloatSafe(row['Flaw Length']),
            width: parseFloatSafe(row['Flaw Width']),
            area: parseFloatSafe(row['Flaw Area']),
            laneStart: parseFloatSafe(row['Flaw Lane Start']),
            laneEnd: parseFloatSafe(row['Flaw Lane End']),
            camera: row['Flaw Camera'],
            raw: row
          });
        }
        resolve(defects);
      },
      error: (error: any) => reject(error)
    });
  });
}

export async function parseRIN(file: File): Promise<LaneBoundary[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  
  let numLanes = 0;
  for (const line of lines) {
    const match = line.match(/^NUM OF LANES\s*:\s*(\d+)/i);
    if (match) {
      numLanes = parseInt(match[1], 10);
      break;
    }
  }

  const lanes: LaneBoundary[] = [];
  if (numLanes > 0) {
    for (let i = 0; i < numLanes; i++) {
      let left = 0;
      let right = 0;
      for (const line of lines) {
        const lMatch = line.match(new RegExp(`^LANE L${i}\\s*:\\s*([0-9.]+)`, 'i'));
        if (lMatch) left = parseFloat(lMatch[1]);
        
        const rMatch = line.match(new RegExp(`^LANE R${i}\\s*:\\s*([0-9.]+)`, 'i'));
        if (rMatch) right = parseFloat(rMatch[1]);
      }
      lanes.push({ lane: i, left, right });
    }
  }

  return lanes;
}
