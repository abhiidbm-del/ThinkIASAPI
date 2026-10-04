const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../ThinkIASStudent/node_modules/typescript');

function createService(post) {
  const source = fs.readFileSync(require('node:path').join(__dirname, '../../ThinkIASStudent/src/app/shared/services/proctoring.service.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, Blob, FormData, clearInterval, cancelAnimationFrame() {},
    require(name) {
      if (name === '@angular/core') return { Injectable: () => value => value, signal: initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; return read; } };
      if (name === 'rxjs') return { firstValueFrom: value => value };
      if (name.includes('environment')) return { environment: { apiUrl: '/api' } };
      return {};
    }
  });
  const service = new exports.ProctoringService({ post });
  service.sessionId = 'session-1';
  service.active.set(true);
  service.screenActive.set(true);
  const tracks = Array.from({ length: 3 }, () => ({ stopped: false, stop() { this.stopped = true; } }));
  service.stream = { getTracks: () => [tracks[0]] };
  service.sourceStreams = tracks.slice(1).map(track => ({ getTracks: () => [track] }));
  service.recorder = { state: 'recording', mimeType: 'video/webm;codecs=vp8,opus', stop() { this.state = 'inactive'; service.chunks.push(new Blob(['final frame'])); queueMicrotask(() => this.onstop()); } };
  return { service, tracks };
}

test('final submission stops every capture track before upload and keeps the final frame', async () => {
  const calls = [];
  const { service, tracks } = createService(async (url, form) => {
    assert.ok(tracks.every(track => track.stopped));
    assert.equal(service.active(), false);
    assert.equal(service.screenActive(), false);
    calls.push(url);
    if (url.endsWith('/complete')) {
      assert.equal(form.get('recording').type, 'video/webm');
      assert.equal(await form.get('recording').text(), 'final frame');
    }
  });
  const first = service.finish();
  assert.equal(service.finish(), first);
  await first;
  assert.deepEqual(calls, ['/api/proctoring/sessions/session-1/end', '/api/proctoring/sessions/session-1/complete']);
  assert.equal(service.pendingRecording(), false);
  assert.equal(service.sessionId, '');
});

test('upload failure leaves capture stopped and retains recording for retry', async () => {
  let fail = true;
  const { service, tracks } = createService(async url => {
    if (url.endsWith('/complete') && fail) throw new Error('Upload unavailable');
  });
  await assert.rejects(service.finish(), /Upload unavailable/);
  assert.ok(tracks.every(track => track.stopped));
  assert.equal(service.pendingRecording(), true);
  assert.equal(service.uploading(), false);
  assert.equal(service.chunks.length, 1);
  fail = false;
  await service.finish();
  assert.equal(service.pendingRecording(), false);
  assert.equal(service.chunks.length, 0);
});
