import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSubnet, packetJourney } from '../src/network.js';
import { loadProgress, saveProgress, emptyProgress } from '../src/storage.js';

test('a serial /30 resolves the actual host block, not the classful network', () => {
  const result = calculateSubnet('192.168.1.6/30');
  assert.equal(result.network, '192.168.1.4');
  assert.equal(result.first, '192.168.1.5');
  assert.equal(result.last, '192.168.1.6');
  assert.equal(result.broadcast, '192.168.1.7');
  assert.equal(result.mask, '255.255.255.252');
  assert.equal(result.wildcard, '0.0.0.3');
  assert.equal(result.hosts, 2);
});

test('subnet arithmetic works across octets and unsigned IPv4 boundaries', () => {
  const subnet = calculateSubnet('172.31.255.254/12');
  assert.equal(subnet.network, '172.16.0.0');
  assert.equal(subnet.broadcast, '172.31.255.255');
  const all = calculateSubnet('255.255.255.255/0');
  assert.equal(all.network, '0.0.0.0');
  assert.equal(all.mask, '0.0.0.0');
  assert.equal(all.broadcast, '255.255.255.255');
  assert.equal(all.hosts, 4294967294);
});

test('/31 point-to-point and /32 host routes do not invent broadcast hosts', () => {
  const pair = calculateSubnet('10.0.0.3/31');
  assert.equal(pair.first, '10.0.0.2');
  assert.equal(pair.last, '10.0.0.3');
  assert.equal(pair.hosts, 2);
  assert.equal(pair.broadcast, 'No aplica');
  const host = calculateSubnet('255.255.255.255/32');
  assert.equal(host.first, '255.255.255.255');
  assert.equal(host.last, host.first);
  assert.equal(host.hosts, 1);
  assert.equal(host.wildcard, '0.0.0.0');
});

test('invalid addresses and prefixes return an actionable error', () => {
  for (const value of ['', '192.168.1.1', '192.168.1.256/24', '1.2.3.4/33', '-1.2.3.4/24', '1.2.3/24', 'abc/24', '1.2.3.4/-1']) {
    assert.throws(() => calculateSubnet(value), Error, value);
  }
});

test('same VLAN switches locally; crossing VLANs needs layer three', () => {
  assert.equal(packetJourney('same', false).success, true);
  assert.equal(packetJourney('same', true).path, 'local');
  assert.equal(packetJourney('other', false).success, false);
  assert.equal(packetJourney('other', true).path, 'routed');
});

test('study progress survives a save/load round trip', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const progress = { ...emptyProgress(), lessons: ['ios'], steps: { campus: [0, 2] }, bestQuiz: 83, quizzes: 2, saved: ['dhcp'], lastLesson: 'trunks' };
  assert.equal(saveProgress(progress, storage), true);
  assert.deepEqual(loadProgress(storage), progress);
});

test('blocked or corrupted storage cannot prevent opening the dashboard', () => {
  assert.deepEqual(loadProgress({ getItem() { throw new Error('blocked'); } }), emptyProgress());
  assert.deepEqual(loadProgress({ getItem: () => '{not json' }), emptyProgress());
  assert.equal(saveProgress(emptyProgress(), { setItem() { throw new Error('quota'); } }), false);
  const result = loadProgress({ getItem: () => JSON.stringify({ lessons: ['ios', 'ios', 5], steps: { campus: [0, 0, -1, 'bad'] }, bestQuiz: 500 }) });
  assert.deepEqual(result.lessons, ['ios']);
  assert.deepEqual(result.steps.campus, [0]);
  assert.equal(result.bestQuiz, 100);
});

test('an environment denying access to the storage object itself still opens', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    assert.deepEqual(loadProgress(), emptyProgress());
    assert.equal(saveProgress(emptyProgress()), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
