import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Path-based on purpose: under the jsdom environment, `new URL(rel, import.meta.url)` resolves against http://localhost.
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../fixtures');
const path = (name: string) => resolve(dir, name);
export const loadFixtureText = (name: string) => readFileSync(path(name), 'utf8');
export const loadFixtureBytes = (name: string) => new Uint8Array(readFileSync(path(name)));
