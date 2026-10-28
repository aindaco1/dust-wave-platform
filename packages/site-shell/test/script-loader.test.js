import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/script-loader-browser.js';

function fixture(existing=false) {
  const {document,Event}=parseHTML('<html><head></head><body></body></html>');
  let api;
  if(existing) document.head.innerHTML='<script data-sdk="true"></script>';
  const load=globalThis.DustWaveScriptLoader.createScriptLoader({document,src:'https://sdk.example/sdk.js',
    selector:'script[data-sdk="true"]',mark:s=>s.setAttribute('data-sdk','true'),getValue:()=>api});
  return {document,load,setApi:v=>{api=v;},fire:type=>document.querySelector('script').dispatchEvent(new Event(type))};
}
test('concurrent callers share one script or join an existing tag',async()=>{
  for(const existing of [false,true]) {
    const f=fixture(existing),one=f.load(),two=f.load();
    assert.equal(one,two); assert.equal(f.document.querySelectorAll('script').length,1);
    const api={}; f.setApi(api); f.fire('load'); assert.equal(await one,api);
  }
});
test('failed tags and listeners are removed; retries cannot hang on an already fired event',async()=>{
  for(const event of ['load','error']) {
    const f=fixture(),pending=f.load(),failed=f.document.querySelector('script');
    f.fire(event); await assert.rejects(pending);
    assert.equal(f.document.querySelector('script'),null);
    const retry=f.load(); assert.notEqual(f.document.querySelector('script'),failed);
    f.setApi({}); f.fire('load'); await retry;
  }
});
test('preloaded values avoid insertion and synchronous insertion errors remain retryable',async()=>{
  const f=fixture(); f.setApi({ready:true}); assert.deepEqual(await f.load(),{ready:true});
  assert.equal(f.document.querySelector('script'),null);
  f.setApi(null);
  const append=f.document.head.appendChild;
  f.document.head.appendChild=()=>{throw Error('blocked');};
  await assert.rejects(f.load(),/blocked/);
  f.document.head.appendChild=append;
  const retry=f.load(); f.setApi({}); f.fire('load'); await retry;
});

test('warmup and foreground callers share an instance only for matching keys/options', async () => {
  let loads=0, creates=0, release;
  const ready=new Promise(resolve=>{release=resolve;});
  const prepare=globalThis.DustWaveScriptLoader.createInstanceLoader({
    load:()=>{loads++;return ready;},
    create:(api,key,options)=>{creates++;return {api,key,options};}
  });
  const first=prepare('first',{locale:'en'});
  assert.equal(first,prepare('first',{locale:'en'}));
  release({});
  assert.equal(await first,await prepare('first',{locale:'en'}));
  assert.equal(loads,1);assert.equal(creates,1);
  assert.notEqual(await first,await prepare('first',{locale:'es'}));
  assert.notEqual(await first,await prepare('second',{locale:'en'}));
  assert.equal(creates,3);
});
test('load and initializer failures remain retryable without evicting other instances', async () => {
  for(const phase of ['load','create']) {
    let fail=false;
    const prepare=globalThis.DustWaveScriptLoader.createInstanceLoader({
      load:()=>{if(fail&&phase==='load')throw Error('unavailable');return {};},
      create:()=>{if(fail&&phase==='create')throw Error('unavailable');return {};}
    });
    const first=await prepare('first');fail=true;
    const pending=prepare('second');assert.equal(pending,prepare('second'));
    await assert.rejects(pending,/unavailable/);
    assert.equal(await prepare('first'),first);
    fail=false;assert.notEqual(await prepare('second'),first);
  }
});
