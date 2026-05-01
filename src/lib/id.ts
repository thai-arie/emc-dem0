let seq = 1000;

export function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}`;
}
