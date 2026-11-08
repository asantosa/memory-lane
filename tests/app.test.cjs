const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync('web/voice.js', 'utf8')+'\n'+fs.readFileSync('web/app.js', 'utf8');
const key = 'album-echo-memories';
const record = (id, title = id) => ({ id, title, story: 'A saved story', date: 'Around 1998', people: '', photo: null });

function app(initial = {}) {
  const data = new Map(Object.entries(initial));
  const nodes = new Map(['content', 'style-trigger', 'style-panel', 'breadcrumb', 'toast', 'draft-status'].map(id => [id, {
    innerHTML: '', textContent: '', hidden: false, dataset: {}, addEventListener() {}, setAttribute() {}, querySelectorAll: () => [],
  }]));
  const blobs = [];
  const localStorage = {
    getItem: k => data.get(k) ?? null,
    setItem(k, v) { if (localStorage.failKey === k) throw new Error('Quota exceeded'); data.set(k, String(v)); },
    removeItem: k => data.delete(k),
  };
  const context = vm.createContext({
    document: { getElementById: id => nodes.get(id) || null, body: { dataset: {} }, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ click() {} }) },
    localStorage, window: { scrollTo() {}, addEventListener() {} }, crypto: webcrypto, console,
    setTimeout: () => 1, clearTimeout() {}, Blob,
    URL: { createObjectURL: blob => { blobs.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
  });
  vm.runInContext(source, context);
  return { run: code => vm.runInContext(code, context), data, localStorage, nodes, blobs };
}

test('title-only memory saves and clears its draft', async () => {
  const a = app();
  a.run("draft.title='A small beginning'; persistDraft()");
  await a.run('saveMemory()');
  assert.equal(JSON.parse(a.data.get(key))[0].title, 'A small beginning');
  assert.equal(a.data.has('memory-lane-draft'), false);
  assert.equal(a.run('page'), 'library');
});

test('missing title cannot create a memory', async () => {
  const a = app();
  a.run("draft.title='   '; draft.step=3");
  await a.run('saveMemory()');
  assert.equal(a.data.has(key), false);
  assert.equal(a.run('draft.step'), 2);
});

test('quota failure preserves existing memories and draft', async () => {
  const a = app({ [key]: JSON.stringify([record('original')]) });
  a.run("draft.title='Unsaved'; persistDraft()");
  a.localStorage.failKey = key;
  await a.run('saveMemory()');
  assert.equal(JSON.parse(a.data.get(key))[0].id, 'original');
  assert.equal(JSON.parse(a.data.get('memory-lane-draft')).title, 'Unsaved');
  assert.match(a.run('editorError'), /could not be saved/);
});

test('editing updates one memory without duplicating it', async () => {
  const a = app({ [key]: JSON.stringify([record('one'), record('two')]) });
  a.run("selected=memories[0]; startEditing(); draft.title='Changed'");
  await a.run('saveMemory()');
  const saved = JSON.parse(a.data.get(key));
  assert.equal(saved.length, 2);
  assert.equal(saved[0].title, 'Changed');
  assert.equal(saved[1].id, 'two');
});

test('reopening an unfinished edit preserves its changes', () => {
  const a = app({ [key]: JSON.stringify([record('one')]) });
  a.run("selected=memories[0]; startEditing(); draft.title='Unfinished edit'; persistDraft(); navigate('home'); startEditing()");
  assert.equal(a.run('draft.title'), 'Unfinished edit');
});

test('a saved draft survives app initialization', () => {
  const a = app({ 'memory-lane-draft': JSON.stringify({ title: 'Returning draft', story: 'My words', step: 2 }) });
  assert.equal(a.run('draft.title'), 'Returning draft');
  assert.equal(a.run('draft.story'), 'My words');
  assert.equal(a.run('draft.step'), 2);
});

test('save preserves memories added by another tab', async () => {
  const a = app({ [key]: JSON.stringify([record('old')]) });
  a.data.set(key, JSON.stringify([record('other-tab'), record('old')]));
  a.run("draft.title='New from this tab'");
  await a.run('saveMemory()');
  assert.equal(JSON.parse(a.data.get(key)).length, 3);
  assert.equal(JSON.parse(a.data.get(key))[1].id, 'other-tab');
});

test('a previously saved user starts with their own memories', () => {
  const a = app({ [key]: JSON.stringify([record('one')]) });
  assert.equal(a.run('demoMode'), false);
});

test('concurrent edits do not overwrite the other tab’s changes', async () => {
  const a = app({ [key]: JSON.stringify([record('one')]) });
  a.run("selected=memories[0]; startEditing(); draft.title='My unfinished version'");
  a.data.set(key, JSON.stringify([record('one', 'Updated in another tab')]));
  await a.run('saveMemory()');
  assert.equal(JSON.parse(a.data.get(key))[0].title, 'Updated in another tab');
  assert.equal(a.run('draft.title'), 'My unfinished version');
  assert.equal(a.run('editConflict'), true);
});

test('invalid record data is preserved and saving is paused', async () => {
  const raw = JSON.stringify([null, { id: 'broken' }]);
  const a = app({ [key]: raw });
  a.run("draft.title='New'");
  await a.run('saveMemory()');
  assert.equal(a.data.get(key), raw);
  assert.equal(a.run('storageAvailable'), false);
});

test('explicit demo preference survives a reload', () => {
  const a = app({ [key]: JSON.stringify([record('one')]), 'memory-lane-demo': 'true' });
  assert.equal(a.run('demoMode'), true);
});

test('HTML-looking titles render as text', () => {
  const a = app({ [key]: JSON.stringify([record('one', '<img src=x onerror=alert(1)>')]) });
  a.run("navigate('library')");
  const html = a.nodes.get('content').innerHTML;
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
});

test('malformed storage cannot be silently overwritten', async () => {
  const a = app({ [key]: '{broken json' });
  a.run("draft.title='New memory'");
  await a.run('saveMemory()');
  assert.equal(a.data.get(key), '{broken json');
});

test('export contains the saved photo and story, excluding the built-in demo', async () => {
  const photo = 'data:image/jpeg;base64,dGVzdA==';
  const a = app({ [key]: JSON.stringify([{ ...record('one'), photo }]) });
  a.run('exportMemories()');
  const backup = JSON.parse(await a.blobs[0].text());
  assert.equal(backup.format, 'memory-lane-backup');
  assert.equal(backup.memories.length, 1);
  assert.equal(backup.memories[0].photo, photo);
  assert.equal(backup.memories[0].story, 'A saved story');
});

test('photo collections deduplicate and preserve all photos through saving', async () => {
  const a = app();
  a.run("appendDraftPhotos([{src:'data:image/jpeg;base64,YQ==',source:null},{src:'data:image/jpeg;base64,Yg==',source:null},{src:'data:image/jpeg;base64,YQ==',source:null}]);draft.title='Two photos'");
  assert.equal(a.run('photoList(draft).length'), 2);
  await a.run('saveMemory()');
  const saved = JSON.parse(a.data.get(key))[0];
  assert.equal(saved.extraPhotos.length, 1);
  assert.equal(saved.photo, 'data:image/jpeg;base64,YQ==');
});

test('cover selection and removal preserve the remaining photos', () => {
  const a = app();
  a.run("appendDraftPhotos([{src:'a'},{src:'b'},{src:'c'}]);makeCover(2)");
  assert.equal(a.run('draft.photo'), 'c');
  a.run('removeDraftPhoto(0)');
  assert.equal(a.run('draft.photo'), 'a');
  assert.equal(a.run('photoList(draft).length'), 2);
});

test('oversized album selection is rejected without altering the draft', () => {
  const a = app();
  a.run("appendDraftPhotos([{src:'original'}])");
  assert.throws(() => a.run("appendDraftPhotos(Array.from({length:12},(_,i)=>({src:String(i)})))"), /up to 12 photos/);
  assert.equal(a.run('draft.photo'), 'original');
  assert.equal(a.run('photoList(draft).length'), 1);
});

test('walkthrough selection and story do not enter saved memories or the draft', () => {
  const a = app();
  a.run("walk.chosen.add(0);walk.chosen.add(1);walk.title='Demo only';walk.step=4;navigate('demo')");
  assert.equal(a.data.has(key), false);
  assert.equal(a.run('draft.title'), '');
  assert.equal(a.run('walkPhotos().length'), 2);
  assert.match(a.nodes.get('content').innerHTML, /Demo only/);
});

test('date, location, and audio survive saving, editing, and export', async () => {
  const a = app();
  a.run("draft.title='Spoken memory';draft.date='Around 1998';draft.location='Lake Tahoe';draft.audio={src:'data:audio/mp4;base64,YQ==',mimeType:'audio/mp4',seconds:4}");
  await a.run('saveMemory()');
  a.run('selected=memories[0];startEditing()');
  assert.equal(a.run('draft.location'), 'Lake Tahoe');
  assert.equal(a.run('draft.audio.seconds'), 4);
  a.run('exportMemories()');
  const exported = JSON.parse(await a.blobs[0].text()).memories[0];
  assert.equal(exported.date, 'Around 1998');
  assert.equal(exported.location, 'Lake Tahoe');
  assert.equal(exported.audio.src, 'data:audio/mp4;base64,YQ==');
});

test('dictation appends final words once and does not save unconfirmed interim text', () => {
  const a = app();
  a.run("window.SpeechRecognition=class{start(){} stop(){}};draft.story='Already written.';startDictation('story');var result=[{transcript:'A sunny afternoon.'}];result.isFinal=false;voice.recognition.onresult({results:[result]})");
  assert.equal(a.run('draft.story'), 'Already written.');
  a.run('result.isFinal=true;voice.recognition.onresult({results:[result]});voice.recognition.onresult({results:[result]})');
  assert.equal(a.run('draft.story'), 'Already written. A sunny afternoon.');
  a.run('stopVoice()');
  assert.equal(a.run('voiceBusy()'), false);
});

test('speech permission rejection leaves the existing story intact', () => {
  const a = app();
  a.run("window.SpeechRecognition=class{start(){} stop(){}};draft.story='My original words';startDictation('story');voice.recognition.onerror({error:'not-allowed'})");
  assert.equal(a.run('draft.story'), 'My original words');
  assert.equal(a.run('voiceBusy()'), false);
  assert.match(a.run('voice.status'), /denied/);
});

test('voice recording saves audio and releases the microphone tracks', async () => {
  const a = app();
  a.run("var stopped=0;navigator={mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})}};window.MediaRecorder=class{static isTypeSupported(){return true}constructor(){this.mimeType='audio/mp4';this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';return this.onstop()}};FileReader=class{readAsDataURL(){this.result='data:audio/mp4;base64,YQ==';this.onload()}};page='add'");
  await a.run('startVoiceNote()');
  a.run("voice.recorder.ondataavailable({data:new Blob(['audio'],{type:'audio/mp4'})})");
  await a.run('voice.recorder.stop()');
  assert.equal(a.run('draft.audio.src'), 'data:audio/mp4;base64,YQ==');
  assert.equal(a.run('stopped'), 1);
  assert.equal(a.run('voiceBusy()'), false);
});

test('empty library offers capture without mixing a sample into saved memories', () => {
  const a = app();
  a.run("navigate('library')");
  const html = a.nodes.get('content').innerHTML;
  assert.match(html, /Add your first memory/);
  assert.doesNotMatch(html, /data-open="sample"/);
});

test('Today and Revisit prioritize saved memories even with a legacy demo preference', () => {
  const a = app({ [key]: JSON.stringify([record('mine', 'My afternoon')]), 'memory-lane-demo': 'true' });
  assert.match(a.nodes.get('content').innerHTML, /data-open="mine"/);
  assert.doesNotMatch(a.nodes.get('content').innerHTML, /data-open="sample"/);
  a.run("navigate('revisit')");
  assert.equal(a.run('selected.id'), 'mine');
});
