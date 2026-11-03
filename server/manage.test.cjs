const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

function inspectModule() {
  const listeners = [];
  const localRequire = name => {
    if (name === 'http' || name === 'node:http') return {
      createServer: handler => ({ handler, listen: (...args) => listeners.push(args) }),
    };
    if (name === 'child_process' || name === 'node:child_process') return {
      exec: () => { throw new Error('Real process commands are forbidden in this fixture'); },
      execSync: () => { throw new Error('Real process commands are forbidden in this fixture'); },
    };
    return require(name);
  };
  localRequire.main = {};
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(__dirname + '/manage.cjs', 'utf8'), {
    require: localRequire, module, process: { env: {} }, console, URL, Buffer,
  });
  return { exports: module.exports, listeners };
}

function factory() {
  const inspected = inspectModule();
  assert.equal(inspected.listeners.length, 0, 'Import must never listen or control a real service');
  assert.equal(typeof inspected.exports.createManagementServer, 'function');
  return require('./manage.cjs').createManagementServer;
}

const token = 'offline-fixture-token-for-management-tests';
async function fixture(t) {
  const calls = [];
  const server = factory()({ token, commands: { fixture: { start: 'fixture-start', stop: 'fixture-stop' } },
    execute: async command => { calls.push(command); return 'fixture-only'; },
    check: () => { calls.push('fixture-check'); return true; },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { calls, base: `http://127.0.0.1:${server.address().port}` };
}

test('import is inert and default bind is loopback', () => {
  const module = inspectModule();
  assert.equal(module.listeners.length, 0);
  assert.equal(module.exports.DEFAULT_HOST, '127.0.0.1');
});

test('missing or weak tokens fail before constructing a listener', () => {
  const make = factory();
  for (const token of [undefined, '', 'change-me-dev', 'short']) {
    assert.throws(() => make({ token }), /token/i);
  }
});

test('unauthorized status and control requests execute no commands', async t => {
  const f = await fixture(t);
  for (const path of ['/start/fixture', '/stop/fixture', '/status']) {
    const response = await fetch(f.base + path, { method: path === '/status' ? 'GET' : 'POST' });
    assert.equal(response.status, 401);
  }
  assert.deepEqual(f.calls, []);
});

test('origin rejection and preflight cannot control services', async t => {
  const f = await fixture(t);
  const bad = await fetch(f.base + '/start/fixture', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://untrusted.example' },
  });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const preflight = await fetch(f.base + '/start/fixture', {
    method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5173' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  assert.deepEqual(f.calls, []);
});

test('valid controls and status use only owned fixture commands', async t => {
  const f = await fixture(t);
  for (const action of ['start', 'stop']) {
    const response = await fetch(`${f.base}/${action}/fixture`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).output, 'fixture-only');
  }
  const status = await fetch(f.base + '/status', { headers: { Authorization: `Bearer ${token}` } });
  assert.deepEqual(await status.json(), { fixture: 'running' });
  assert.deepEqual(f.calls, ['fixture-start', 'fixture-stop', 'fixture-check']);
});

test('prototype names and extra path segments are never executable', async t => {
  const f = await fixture(t);
  for (const path of ['/start/constructor', '/start/__proto__', '/start/fixture/extra']) {
    const response = await fetch(f.base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 404);
  }
  assert.deepEqual(f.calls, []);
});

test('browser client sends authenticated requests to the actual fixture server', async t => {
  const { sendManagementCommand } = await import('../src/management.mjs');
  const f = await fixture(t);
  const response = await sendManagementCommand(f.base, token, 'fixture', 'start');
  assert.equal(response.output, 'fixture-only');
  assert.deepEqual(f.calls, ['fixture-start']);
});

test('browser client reports HTTP rejection without claiming control success', async t => {
  const { sendManagementCommand } = await import('../src/management.mjs');
  const f = await fixture(t);
  await assert.rejects(sendManagementCommand(f.base, token + '-wrong', 'fixture', 'start'), /HTTP 401/);
  assert.deepEqual(f.calls, []);
});

test('browser client rejects missing credentials before any request', async () => {
  const { sendManagementCommand } = await import('../src/management.mjs');
  let requests = 0;
  const fetchFixture = async () => { requests++; throw new Error('Must not fetch'); };
  await assert.rejects(sendManagementCommand('http://127.0.0.1', '', 'fixture', 'start', fetchFixture), /token/);
  await assert.rejects(sendManagementCommand('http://127.0.0.1', token, '../escape', 'start', fetchFixture), /Invalid/);
  assert.equal(requests, 0);
});

test('browser source must not contain a telemetry secret', () => {
  const source = fs.readFileSync(__dirname + '/../src/App.jsx', 'utf8');
  assert.equal(source.includes('sk-lf-'), false);
});
