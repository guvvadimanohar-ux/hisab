const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile);let running=false;
async function scan(image){
 if(process.platform!=='darwin')throw Error('Local receipt scanning currently requires the macOS server. You can enter the bill manually.');
 if(running)throw Error('A receipt is being scanned. Try again shortly.');
 if(typeof image!=='string'||image.length>6*1024*1024||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image))throw Error('Choose a PNG or JPEG receipt under 4 MB.');
 const bytes=Buffer.from(image.split(',')[1],'base64');if(bytes.length>4*1024*1024||!(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes[0]===255&&bytes[1]===216))throw Error('Invalid receipt image.');
 running=true;let dir;
 try{dir=await fs.mkdtemp(path.join(os.tmpdir(),'hisab-receipt-'));const file=path.join(dir,'receipt');await fs.writeFile(file,bytes,{mode:0o600});const {stdout}=await run('/usr/bin/swift',[path.join(__dirname,'../helpers/receiptOCR.swift'),file],{timeout:60000,maxBuffer:512*1024});const lines=JSON.parse(stdout);return {lines,text:lines.map(l=>l.text).join('\n'),notice:'Review all extracted text against the original receipt before saving.'};}
 catch(e){throw Error('Local receipt scanning could not finish. Check the image or enter the bill manually.');}finally{running=false;if(dir)await fs.rm(dir,{recursive:true,force:true});}
}
module.exports={scan};
