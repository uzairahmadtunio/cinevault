import { toJSONAsync } from 'seroval';
const BASE = 'https://3movie-cinevault.vercel.app';
const FN_BYID = '0768672f04c56c4687bfd00e74b4c43d8e6b6e6ffb8e189338472a7a624c7e95';
const body = JSON.stringify(await toJSONAsync({ data: { id: process.argv[2] || '7014' } }));
const res = await fetch(`${BASE}/_serverFn/${FN_BYID}`, { method: 'POST', headers: { 'x-tsr-serverFn': 'true', 'content-type': 'application/json', accept: 'application/json' }, body });
const text = await res.text();
console.log(text.slice(0, 2500));
