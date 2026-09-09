import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const output = new URL('../node_modules/.cache/snapmap-photo-tests/', import.meta.url);
await mkdir(output, { recursive: true });
await build({ entryPoints: [new URL('../src/components/SpotPhotoEditor.jsx', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: new URL('editor.mjs', output).pathname });
const { default: Editor } = await import(new URL('editor.mjs', output));
test.after(async () => { await rm(output, { recursive: true, force: true }); });

const originals = [{ uri: 'first', photoBy: 'Alice', uploadedBy: 'Alice' }, { uri: 'second', photoBy: 'Bob', uploadedBy: 'Bob' }, { uri: 'third', photoBy: 'Chris', uploadedBy: 'Chris' }];
function setup() {
  const state = { images: null, error: '', busy: false };
  function Harness() {
    const [images, setImages] = React.useState(originals);
    state.images = images;
    return React.createElement(Editor, { images, setImages, uploaderName: 'Owner', onError: (error) => { state.error = error; }, onBusyChange: (busy) => { state.busy = busy; } });
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness), { createNodeMock: () => ({ click() {} }) }); });
  return { state, renderer, button: (label) => renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === label || button.props.children === label) };
}

test('cover and reorder controls keep photographer attribution with each image', () => {
  const { state, renderer, button } = setup();
  act(() => button('Move photo 3 earlier').props.onClick());
  assert.deepEqual(state.images.map((photo) => photo.uri), ['first', 'third', 'second']);
  act(() => button('Make cover').props.onClick());
  assert.deepEqual(state.images[0], originals[2]);
  act(() => button('Remove photo 2').props.onClick());
  assert.deepEqual(state.images, [originals[2], originals[1]]);
  assert.deepEqual(originals.map((photo) => photo.uri), ['first', 'second', 'third']);
  act(() => renderer.unmount());
});

test('failed replacement preserves the original image and exposes an error', async () => {
  const oldImage = globalThis.Image;
  globalThis.Image = class { set src(value) { queueMicrotask(() => this.onerror()); } };
  const { state, renderer, button } = setup();
  try {
    act(() => button('Replace photo 2').props.onClick());
    await act(async () => { await renderer.root.findByProps({ 'aria-label': 'Replace spot photo' }).props.onChange({ target: { files: [new Blob(['bad'], { type: 'image/jpeg' })], value: '' } }); });
    assert.deepEqual(state.images, originals);
    assert.match(state.error, /existing photos are unchanged/);
    assert.equal(state.busy, false);
  } finally { globalThis.Image = oldImage; act(() => renderer.unmount()); }
});

test('replacement stays in its original position and credits the new uploader', async () => {
  const oldImage = globalThis.Image;
  const oldDocument = globalThis.document;
  globalThis.Image = class { width = 100; height = 100; set src(value) { queueMicrotask(() => this.onload()); } };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,new' }) };
  const { state, renderer, button } = setup();
  try {
    act(() => button('Replace photo 2').props.onClick());
    await act(async () => { await renderer.root.findByProps({ 'aria-label': 'Replace spot photo' }).props.onChange({ target: { files: [new Blob(['ok'], { type: 'image/jpeg' })], value: '' } }); });
    assert.deepEqual(state.images, [originals[0], { uri: 'data:image/jpeg;base64,new', photoBy: 'Owner', uploadedBy: 'Owner' }, originals[2]]);
    assert.equal(state.error, '');
    assert.equal(state.busy, false);
  } finally { globalThis.Image = oldImage; globalThis.document = oldDocument; act(() => renderer.unmount()); }
});
