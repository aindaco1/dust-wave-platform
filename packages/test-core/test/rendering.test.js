import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTextScale, waitForStableRendering } from '../src/rendering.js';

test('text scaling uses a routed same-origin stylesheet and waits for rendering',async()=>{
  const calls=[];
  const page={route:async(pattern,handler)=>{calls.push(pattern);await handler({fulfill:async value=>calls.push(value)});},
    addStyleTag:async value=>calls.push(value),evaluate:async(_callback,timeout)=>calls.push(timeout)};
  await applyTextScale(page,200,{pathPrefix:'/__store-text-scale-'});
  assert.deepEqual(calls,['**/__store-text-scale-200.css',{contentType:'text/css',body:':root { font-size: 200% !important; }'},{url:'/__store-text-scale-200.css'},2000]);
  await assert.rejects(applyTextScale(page,NaN),RangeError);
  await assert.rejects(applyTextScale(page,200,{pathPrefix:'https://other/'}),TypeError);
});
test('font rejection still permits two animation frames',async()=>{
  const oldDocument=globalThis.document, oldWindow=globalThis.window;
  let frames=0;
  globalThis.document={fonts:{ready:Promise.reject(Error('font'))}};
  globalThis.window={setTimeout,requestAnimationFrame:resolve=>{frames++;resolve();}};
  try { await waitForStableRendering({evaluate:(callback,arg)=>callback(arg)},1); assert.equal(frames,2); }
  finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
