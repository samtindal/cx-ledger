import { readFileSync } from 'node:fs';

const url = (name: string) => new URL(`../../../fixtures/${name}`, import.meta.url);
export const loadFixtureText = (name: string) => readFileSync(url(name), 'utf8');
export const loadFixtureBytes = (name: string) => new Uint8Array(readFileSync(url(name)));
