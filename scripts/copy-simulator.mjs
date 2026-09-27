import { cp } from 'node:fs/promises';
await cp('simulador', 'dist/simulador', { recursive: true });
console.log('Simulador Cisco incluido en dist/simulador.');
