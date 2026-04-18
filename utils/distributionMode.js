let mode = 'comparatif';
export function setOptimized(on) {
  mode = on ? 'optimise' : 'comparatif';
}
export function isOptimized() {
  return mode === 'optimise';
}
export function getMode() {
  return mode;
}
