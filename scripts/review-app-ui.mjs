import fs from 'node:fs';
import {getDocument} from '../web/student-portal/student-portal/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
const names=fs.readdirSync('ThinkIAS-APP-UI').filter(name=>name.endsWith('.pdf')).map(name=>name.slice(0,-4));
fs.mkdirSync('docs/app-ui-review',{recursive:true});
let result='';
for(const name of names){
 const pdf=await getDocument({data:new Uint8Array(fs.readFileSync(`ThinkIAS-APP-UI/${name}.pdf`)),useSystemFonts:true}).promise;
 const page=await pdf.getPage(1);
 const content=await page.getTextContent();
 const text=content.items.map(i=>i.str).join(' ');console.log(name+': '+text);result+=name+'\n'+text+'\n\n';
 const {createCanvas}=await import('../web/student-portal/student-portal/node_modules/@napi-rs/canvas/index.js');
 const viewport=page.getViewport({scale:1});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
 await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
 fs.writeFileSync(`docs/app-ui-review/${name}.png`,canvas.toBuffer('image/png'));
 await pdf.destroy();
}
fs.writeFileSync('docs/app-ui-review/all-screens.txt',result);
