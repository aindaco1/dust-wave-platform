export interface DigestCard {title:string;url?:string|null;eyebrow:string;metadata:string;summary:string}
export interface DigestShell {subject:string;title:string;eyebrow:string;introduction:string;footer:string;sections:{title:string;items:DigestCard[]}[]}
export function renderDigestHtml(input:DigestShell):string;
export function compact(value:string,limit:number):string;
export function formatReceived(value:string):string;
export function escapeHtml(value:string):string;
