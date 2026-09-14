import assert from 'node:assert/strict';
import test from 'node:test';

const SHA = '5dbda2127357b4be87821902d36e4ce9560f6876';
const BASE = `https://raw.githubusercontent.com/ORESoftware/ores-interfaces/${SHA}/contracts/ores-compose-machine/v1`;
const response = await fetch(`${BASE}/authored.schema.json`);
assert.equal(response.status, 200);
const defs = (await response.json()).$defs;

test('sidecars cannot inject arbitrary backend or listener coordinates through EnsureRequest', () => {
  for (const field of ['backend','backend_url','listener','listen','bind','host','port','socket','sidecar']) {
    assert.equal(defs.EnsureRequest.properties[field], undefined, field);
  }
  assert.equal(defs.EnsureRequest.additionalProperties, false);
});

test('public machine ingress rejects wildcard LAN bridge and metadata endpoints', () => {
  const p = new RegExp(defs.MachineIngress.properties.authority.pattern);
  for (const value of ['0.0.0.0:8080','10.0.0.2:8080','172.17.0.2:8080','192.168.1.4:8080','169.254.169.254:80']) {
    assert.equal(p.test(value), false, value);
  }
});

test('only loopback TCP and absolute Unix-style authority shapes are public', () => {
  const p = new RegExp(defs.MachineIngress.properties.authority.pattern);
  for (const value of ['127.0.0.1:41000','127.42.1.9:41000','[::1]:41000','/tmp/ores-compose/embedded.sock']) assert.ok(p.test(value), value);
  assert.equal(p.test('relative.sock'), false);
});

test('admin plane and sidecar credentials are absent from every public machine model', () => {
  const forbidden = ['admin_url','admin_host','admin_port','sidecar_token','bearer_token','authorization','secret','credential'];
  for (const model of Object.values(defs)) {
    if (!model.properties) continue;
    for (const field of forbidden) assert.equal(model.properties[field], undefined, field);
  }
});

test('ingress failure is typed separately from activation failure for fail-closed publication', () => {
  const codes = defs.MachineErrorResponse.properties.code.anyOf.map((entry) => entry.const);
  assert.ok(codes.includes('activation_failed'));
  assert.ok(codes.includes('ingress_unavailable'));
  assert.notEqual(codes.indexOf('activation_failed'), codes.indexOf('ingress_unavailable'));
});
