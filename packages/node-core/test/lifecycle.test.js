import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once, EventEmitter } from 'node:events';
import { runCapturedProcess } from '../src/process.js';
import { installServerDrain } from '../src/server-drain.js';

test('capture preserves argv, separate streams and output bounds with capture disabled',async()=>{
  const result=await runCapturedProcess(process.execPath,['-e','process.stdout.write(process.argv[1]); process.stderr.write("err")','a b; no shell']);
  assert.equal(result.stdout,'a b; no shell'); assert.equal(result.stderr,'err');
  await assert.rejects(runCapturedProcess(process.execPath,['-e','process.stdout.write("xxx")'],{
    maximumOutputBytes:2,streams:[{name:'stdout',capture:false},{name:'stderr'}]}),{kind:'limit'});
  await assert.rejects(runCapturedProcess('/missing/command',[]),{kind:'spawn'});
  await assert.rejects(runCapturedProcess(process.execPath,['-e','setInterval(()=>{},100)'],{timeoutMs:100}),{kind:'timeout'});
  await assert.rejects(runCapturedProcess(process.execPath,['-e','process.kill(process.pid,"SIGTERM")']),{kind:'exit',signal:'SIGTERM'});
});
test('abort and callback exceptions terminate bounded capture',async()=>{
  const controller=new AbortController();
  const pending=runCapturedProcess(process.execPath,['-e','setInterval(()=>{},100)'],{signal:controller.signal,onSpawn:()=>controller.abort()});
  await assert.rejects(pending,{kind:'abort'});
  await assert.rejects(runCapturedProcess(process.execPath,['-e','console.log("x")'],{streams:[{name:'stdout',onData:()=>{throw Error('invalid stream');}},{name:'stderr'}]}),/invalid stream/);
});
test('server drain stops new connections once while accepted work completes',async()=>{
  let release, started;
  const began=new Promise(resolve=>{started=resolve;});
  const work=new Promise(resolve=>{release=resolve;});
  const server=http.createServer(async(_req,res)=>{started();await work;res.end('completed');});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const signals=new EventEmitter(); let stops=0;
  const drain=installServerDrain({server,signalSource:signals,stopScheduling:()=>stops++});
  const port=server.address().port;
  const response=fetch('http://127.0.0.1:'+port);
  await began;
  const closed=once(server,'close');
  signals.emit('SIGTERM'); drain.shutdown(); signals.emit('SIGINT');
  assert.equal(stops,1);
  const admitted=await new Promise(resolve=>{
    const socket=net.createConnection({port,host:'127.0.0.1'});
    socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));
  });
  assert.equal(admitted,false);
  release(); assert.equal(await (await response).text(),'completed');
  await closed; assert.equal(signals.listenerCount('SIGTERM'),0);
});
