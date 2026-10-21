import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMediaTarget } from '../src/editor-media.js';
import { recoverDraftBaseline } from '../src/draft-recovery.js';

test('captured targets follow identity across reorder but reject removal, replacement, detach and cancellation', () => {
  const item={images:[{}]}, other={}; let items=[item,other], attached=true, current=true;
  const target=captureMediaTarget({item,target:item.images[0],getItems:()=>items,isAttached:()=>attached,
    contains:(block,image)=>block.images.includes(image),isCurrent:()=>current});
  assert.equal(target.index(),0);
  items.reverse(); assert.equal(target.index(),1);
  current=false; assert.equal(target.index(),-1); current=true;
  attached=false; assert.equal(target.index(),-1); attached=true;
  const image=item.images.pop(); assert.equal(target.index(),-1); item.images.push(image);
  items=[other,{images:[image]}]; assert.equal(target.index(),-1);
});
test('stale drafts keep revision and published snapshot paired through repeated reloads', () => {
  const options={draftRevision:'old',draftSnapshot:'old-content',currentRevision:'new',currentSnapshot:'new-content',needsPublishing:true};
  const result=recoverDraftBaseline(options);
  assert.deepEqual(result,{revision:'old',snapshot:'old-content',conflict:true});
  assert.deepEqual(recoverDraftBaseline({...options,draftRevision:result.revision,draftSnapshot:result.snapshot}),result);
  assert.deepEqual(recoverDraftBaseline({...options,legacyRevisionMatches:true}),{revision:'new',snapshot:'new-content',conflict:false});
  assert.deepEqual(recoverDraftBaseline({...options,needsPublishing:false}),{revision:'new',snapshot:'new-content',conflict:false});
  assert.deepEqual(recoverDraftBaseline({...options,draftRevision:'',draftSnapshot:'',workingRevisionChanged:true}),{revision:'',snapshot:'',conflict:true});
});
