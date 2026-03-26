const listeners = new Set();
let items = [];

const toId = (p) => {
  const base = p?.id ?? p?.sku ?? p?.code ?? p?.name ?? p?.title ?? "";
  return String(base).trim().toLowerCase();
};

export const getProducts = () => items.slice();

export const addProduct = (p) => {
  if (!p) return;
  const id = toId(p);
  if (!id) return;
  const exists = items.some(x => toId(x) === id);
  if (exists) {
    listeners.forEach(fn => fn(items));
    return;
  }
  items = [...items, p];
  listeners.forEach(fn => fn(items));
};

export const subscribe = (fn) => {
  if (typeof fn !== "function") return () => {};
  listeners.add(fn);
  fn(items);
  return () => listeners.delete(fn);
};
