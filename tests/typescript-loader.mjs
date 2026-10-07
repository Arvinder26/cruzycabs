import { readFile,access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
export async function resolve(specifier,context,next){
  if(specifier.endsWith('/runtime-env'))return {url:'data:text/javascript,export const env = globalThis.__testEnv;',shortCircuit:true};
  if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export const env = globalThis.__testEnv;',shortCircuit:true};
  if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')&&!/\.[a-z]+$/i.test(specifier)){
    for(const suffix of ['.ts','.tsx']){const candidate=new URL(specifier+suffix,context.parentURL);try{await access(fileURLToPath(candidate));return {url:candidate.href,shortCircuit:true};}catch{/* continue resolution */}}
  }
  return next(specifier,context);
}
export async function load(url,context,next){if(url.startsWith('file:')&&/\.tsx?$/.test(url)){const source=await readFile(fileURLToPath(url),'utf8');return {format:'module',source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};}return next(url,context);}
