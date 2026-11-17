import Ajv2020 from 'ajv/dist/2020.js'; import addFormats from 'ajv-formats'; import fs from 'node:fs'; import path from 'node:path'; import { CFG } from './config.mjs';
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
const dir = path.join(CFG.root, 'schemas'); for (const f of fs.readdirSync(dir)) ajv.addSchema(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
export function check(name, doc) { const v = ajv.getSchema('https://transovo.example/schemas/' + name + '.schema.json'); if (!v) throw new Error('no schema ' + name); const ok = v(doc); return ok ? [] : v.errors.map(e => `${name}${e.instancePath} ${e.message}`); }
export function assertSchema(name, doc) { const e = check(name, doc); if (e.length) throw Object.assign(new Error('schema ' + name + ': ' + e.slice(0, 6).join('; ')), { code: 'SCHEMA', errors: e }); return doc; }
