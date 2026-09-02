export const AL_DENSITY = 0.0975; // lbs/in³

export interface CoilParams {
  thickness: number; // inches
  width: number; // inches
  id: number; // inches
  od: number; // inches
  length: number; // feet
  weight: number; // lbs
  density: number; // lbs/in³
}

export const DEFAULT_PARAMS: CoilParams = {
  thickness: 0.040,
  width: 36.0,
  id: 20.0,
  od: 48.0,
  length: 0,
  weight: 0,
  density: AL_DENSITY,
};

export function calculateCoil(
  changedField: keyof CoilParams,
  value: number,
  current: CoilParams
): CoilParams {
  const next = { ...current, [changedField]: value };
  const { thickness, width, id, density } = next;

  // Prevent divide by zero
  if (thickness <= 0 || width <= 0) return next;

  if (changedField === 'length') {
    const v = thickness * width * (next.length * 12);
    next.od = Math.sqrt(Math.pow(id, 2) + (4 * v) / (Math.PI * width));
    next.weight = v * density;
  } else if (changedField === 'od') {
    next.od = Math.max(id, next.od);
    const v = (Math.PI / 4) * (Math.pow(next.od, 2) - Math.pow(id, 2)) * width;
    next.length = v / (thickness * width * 12);
    next.weight = v * density;
  } else if (changedField === 'weight') {
    const v = next.weight / density;
    next.length = v / (thickness * width * 12);
    next.od = Math.sqrt(Math.pow(id, 2) + (4 * v) / (Math.PI * width));
  } else {
    // If fundamental properties change, keep length fixed and update OD and Weight.
    const v = thickness * width * (next.length * 12);
    next.od = Math.sqrt(Math.pow(id, 2) + (4 * v) / (Math.PI * width));
    next.weight = v * density;
  }

  // Handle NaNs gracefully
  if (isNaN(next.od) || next.od < id) next.od = id;
  if (isNaN(next.length) || next.length < 0) next.length = 0;
  if (isNaN(next.weight) || next.weight < 0) next.weight = 0;

  return next;
}
