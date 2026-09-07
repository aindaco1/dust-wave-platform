import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderDigestHtml,formatReceived,compact,escapeHtml} from '../src/index.js';
const fixture=JSON.parse(readFileSync(new URL('./opportunity-characterization.json',import.meta.url)));
test('extraction preserves Opportunity Radar HTML byte for byte',()=>{
 const dateLabel=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(fixture.date));
 const html=renderDigestHtml({subject:fixture.expected.subject,title:'Dust Wave Opportunity Radar',eyebrow:`${dateLabel} · 2 items`,introduction:'Relevant creative-industry calls that need a human look.',footer:'Compiled from enabled mail and public opportunity sources on the 12-hour Dust Wave schedule. Links return to the original public source when available.',sections:fixture.items.map(item=>({title:item.category,items:[{...item,eyebrow:item.category,metadata:[item.deadline?`Deadline ${item.deadline}`:'',item.sender??'',formatReceived(item.received_at)].filter(Boolean).join(' · ')}]}))});
 assert.equal(html,fixture.expected.html);
});
test('scanner presentation is injected and external text is escaped',()=>{
 const html=renderDigestHtml({subject:'GitHub Repo Scan',title:'GitHub Repo Scan',eyebrow:'PARTIAL',introduction:'1 < 2',footer:'Read-only scan',sections:[{title:'Review',items:[{title:'PR <script>',eyebrow:'example/repo',metadata:'head & test',summary:'Check current head',url:'https://github.com/example/repo/pull/1'}]}]});
 assert.ok(html.includes('PR &lt;script&gt;'));assert.ok(html.includes('1 &lt; 2'));assert.ok(!html.includes('Opportunity Radar'));assert.ok(html.includes('max-width:420px'));
 assert.equal(formatReceived('invalid'),'');assert.equal(escapeHtml(`&<>"'`),'&amp;&lt;&gt;&quot;&#39;');assert.ok(compact('word '.repeat(200),280).length<=280);
});
