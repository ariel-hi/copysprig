import test from 'node:test';
import assert from 'node:assert/strict';
import {copyText} from '../src/copy.mjs';
test('copies the exact Unicode string using modern clipboard',async()=>{let value;assert.equal(await copyText('♡ 𝓗𝓲\n你好',{clipboard:{writeText:async t=>{value=t;}}}),'clipboard');assert.equal(value,'♡ 𝓗𝓲\n你好');});
test('permission failure uses legacy selection, restores focus and removes temporary text',async()=>{let removed=false,focused=false,selected=false;const doc={activeElement:{focus(){focused=true;}},body:{appendChild(){}},createElement(){return {style:{},setAttribute(){},select(){selected=true;},remove(){removed=true;}};},execCommand(){return true;}};assert.equal(await copyText('test',{clipboard:{writeText:async()=>{throw new Error('denied');}},document:doc}),'selection');assert.ok(removed&&focused&&selected);});
test('both failures request manual selection instead of claiming success',async()=>{const doc={body:{appendChild(){}},createElement(){return{style:{},setAttribute(){},select(){},remove(){}};},execCommand(){return false;}};assert.equal(await copyText('test',{clipboard:{writeText:async()=>{throw new Error('denied');}},document:doc}),'manual');});
