import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const [,, url, out, w='1024', h='576', wait='2500'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--enable-gpu-rasterization','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs=[]; p.on('console', m => logs.push(m.type()+': '+m.text())); p.on('pageerror', e => logs.push('pageerror: '+e.message));
await p.goto(url); await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
console.log(JSON.stringify(await p.evaluate(()=>window.eye?.stats)), logs.join('\n'));
await b.close();
