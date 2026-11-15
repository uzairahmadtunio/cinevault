import { toJSONAsync } from 'seroval';

const BASE = 'https://3movie-cinevault.vercel.app';
const FN_BYID = '0768672f04c56c4687bfd00e74b4c43d8e6b6e6ffb8e189338472a7a624c7e95';

async function raw(id, data) {
  const body = JSON.stringify(await toJSONAsync({ data }));
  const res = await fetch(`${BASE}/_serverFn/${id}`, {
    method: 'POST',
    headers: { 'x-tsr-serverFn': 'true', 'content-type': 'application/json', accept: 'application/json' },
    body,
  });
  return res.text();
}

// Minimal seroval cross-JSON decoder for plain data (objects/arrays/strings/numbers/bools/null)
function decode(node, refs = new Map()) {
  if (node == null || typeof node !== 'object') return node;
  const { t, i, p, s } = node;
  if (i != null && refs.has(i) && t !== 10 && t !== 11) return refs.get(i);
  switch (t) {
    case 0: return undefined;
    case 1: return p; // number? verify empirically
    case 2: return p; // string?
    case 3: return null;
    case 4: return true;
    case 5: return false;
    case 10: { // object
      const obj = {};
      if (i != null) refs.set(i, obj);
      const keys = p.k, vals = p.v;
      keys.forEach((k, idx) => { obj[k] = decode(vals[idx], refs); });
      return obj;
    }
    case 11: { // array
      const arr = [];
      if (i != null) refs.set(i, arr);
      for (const v of p.v ?? p ?? []) arr.push(decode(v, refs));
      return arr;
    }
    default:
      return { __undecoded: node };
  }
}

async function main() {
  const mid = process.argv[2] || '7014';
  const text = await raw(FN_BYID, { id: mid });
  const json = JSON.parse(text);
  const decoded = decode(json);
  const mv = decoded?.result?.movie ?? decoded?.movie ?? decoded;
  console.log(JSON.stringify(mv, null, 1).slice(0, 3000));
}

main().catch((e) => console.error('FATAL', e));
