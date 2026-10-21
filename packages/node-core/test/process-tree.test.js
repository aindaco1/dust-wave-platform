import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnManagedProcess, stopProcess } from '../src/process.js';
test('teardown reaches TERM-resistant descendants after leader exit',{skip:process.platform==='win32'},async()=>{
  const source=`const {spawn}=require("node:child_process");
    const child=spawn(process.execPath,["-e","process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"],{stdio:["ignore","pipe","ignore"]});
    child.stdout.once("data",()=>console.log(child.pid));setInterval(()=>{},1000);`;
  const parent=spawnManagedProcess(process.execPath,['-e',source],{stdio:['ignore','pipe','pipe']});
  let pid;
  try {
    pid=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('child readiness timed out')),3000);
      parent.stdout.once('data',bytes=>{clearTimeout(timer);resolve(Number(bytes.toString().trim()));});
    });
    await stopProcess(parent,{processGroup:true,graceMs:100});
    let gone=false;
    for(let i=0;i<80;i++) {try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH'){gone=true;break;}throw error;}await new Promise(resolve=>setTimeout(resolve,25));}
    assert.equal(gone,true);
  }finally{if(pid){try{process.kill(pid,'SIGKILL');}catch{}}await stopProcess(parent,{processGroup:true,graceMs:100});}
});
