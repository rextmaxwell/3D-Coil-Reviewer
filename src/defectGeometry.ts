import { Defect, LaneBoundary } from './detectorParser';
import { CoilParams } from './utils';

export interface MappedDefect {
  defect: Defect;
  laneLocalCrossweb: number;
  distanceFromLeftEdge: number;
  distanceFromRightEdge: number;
  distanceFromHead: number;
  distanceFromTail: number;
  rID: number;
  rOD: number;
  radius: number;
  distanceFromID: number;
  distanceFromOD: number;
  radialFraction: number;
  radialPercent: number;
  theta: number;
  normalizedAngle: number;
  degrees: number;
  rolledX: number;
  rolledY: number;
  rolledZ: number;
  sheetZ: number;
  isWithinLane: boolean;
  isWithinModeledWidth: boolean;
  isWithinModeledLength: boolean;
  isWithinRadialRange: boolean;
  positionValid: boolean;
  warnings: string[];
}

export function deriveDefectLocation(
  defect: Defect,
  selectedLane: LaneBoundary,
  params: CoilParams
): MappedDefect {
  const laneLeft = selectedLane.left;
  const laneRight = selectedLane.right;
  const laneWidth = laneRight - laneLeft;

  const laneLocalCrossweb = defect.crossweb - laneLeft;
  const distanceFromLeftEdge = laneLocalCrossweb;
  const distanceFromRightEdge = laneWidth - laneLocalCrossweb;

  const distanceFromHead = defect.downweb;
  const distanceFromTail = params.length - defect.downweb;

  const rID = params.id / 2;
  const modeledOD = params.od;
  const safeOD = Math.max(modeledOD, params.id + 0.1);
  const rOD = safeOD / 2;

  const coilCenterY = safeOD / 2;

  const L_in = defect.downweb * 12;
  const t = params.thickness;

  const r = Math.sqrt(rID * rID + (t * L_in) / Math.PI);

  const distanceFromID = r - rID;
  const distanceFromOD = rOD - r;
  
  const radialFraction = (r - rID) / (rOD - rID);
  const radialPercent = radialFraction * 100;

  const theta = (2 * Math.PI * (r - rID)) / t;
  const normalizedAngle = (((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  const degrees = (normalizedAngle * 180) / Math.PI;

  const rolledX = r * Math.cos(theta);
  const rolledY = coilCenterY + r * Math.sin(theta);
  
  // Z mapping: 0 is center of the finished slit coil
  const rolledZ = laneLocalCrossweb - params.width / 2;
  const sheetZ = rolledZ;

  const warnings: string[] = [];
  
  let isWithinLane = false;
  if (defect.laneStart !== undefined && defect.laneEnd !== undefined) {
    if (selectedLane.lane >= defect.laneStart && selectedLane.lane <= defect.laneEnd) {
      isWithinLane = true;
    }
  } else {
    // If no explicit lane tags on defect, check crossweb overlap
    if (defect.crossweb >= laneLeft && defect.crossweb <= laneRight) {
      isWithinLane = true;
    }
  }

  const isWithinModeledWidth = laneLocalCrossweb >= 0 && laneLocalCrossweb <= params.width;
  if (!isWithinModeledWidth) warnings.push("Crossweb exceeds modeled finished width or is negative");

  const isWithinModeledLength = defect.downweb >= 0 && defect.downweb <= params.length;
  if (!isWithinModeledLength) warnings.push("Downweb exceeds modeled coil length or is negative");

  const isWithinRadialRange = r >= rID - 0.01 && r <= rOD + 0.01;
  if (!isWithinRadialRange) warnings.push("Calculated radius exceeds modeled OD");

  if (defect.crossweb < 0 || defect.downweb < 0) {
      warnings.push("Negative detector coordinate");
  }

  const positionValid = isWithinModeledWidth && isWithinModeledLength && isWithinRadialRange && defect.crossweb >= 0 && defect.downweb >= 0;

  return {
    defect,
    laneLocalCrossweb,
    distanceFromLeftEdge,
    distanceFromRightEdge,
    distanceFromHead,
    distanceFromTail,
    rID,
    rOD,
    radius: r,
    distanceFromID,
    distanceFromOD,
    radialFraction,
    radialPercent,
    theta,
    normalizedAngle,
    degrees,
    rolledX,
    rolledY,
    rolledZ,
    sheetZ,
    isWithinLane,
    isWithinModeledWidth,
    isWithinModeledLength,
    isWithinRadialRange,
    positionValid,
    warnings
  };
}
