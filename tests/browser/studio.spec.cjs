const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
// Fixture AI responses must not be bypassed by a service worker. Offline behavior is covered separately.
test.use({serviceWorkers:'block'});
function wavTone(seconds=1.6){const rate=24000,count=Math.round(rate*seconds),data=Buffer.alloc(44+count*2);data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(count*2,40);for(let i=0;i<count;i++)data.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*2*330)*5000),44+i*2);return data;}
async function fit(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
async function selectMedia(page,video=false){await page.locator('#story-media').setInputFiles([path.resolve('web/assets/lakeside-demo.png'),...(video?[path.resolve('tests/fixtures/short-clip.mp4')]:[])]);await expect(page.locator('.studio-tile')).toHaveCount(video?2:1);await page.getByRole('button',{name:'Describe this memory'}).click();}
async function mockAI(page){await page.route('**/api/config',route=>route.fulfill({json:{configured:true}}));await page.route('**/api/story',route=>{const body=route.request().postDataJSON();const scenes=body.media.map((item,i)=>({mediaId:item.id,caption:i?'A moving moment':'An afternoon together',narration:i?'The water moved quietly in the afternoon light.':'Jamie and Mum spent the afternoon beside the lake.'}));return route.fulfill({json:{title:'Our afternoon by the lake',text:scenes.map(s=>s.narration).join('\n\n'),scenes,transcript:body.audio?'Mum packed sandwiches.':''}});});await page.route('**/api/narrate',route=>route.fulfill({status:200,contentType:'audio/wav',body:wavTone()}));}
test.beforeEach(async({page})=>{page.on('pageerror',error=>{throw error;});await page.goto('/studio.html');await expect(page.getByRole('heading',{level:1})).toContainText('Bring your moments');});

test('media and descriptions survive reload; unsupported files retain the selection',async({page},testInfo)=>{await page.locator('#story-media').setInputFiles(path.resolve('web/assets/lakeside-demo.png'));await expect(page.locator('.studio-tile')).toHaveCount(1);await page.locator('#story-media').setInputFiles({name:'document.txt',mimeType:'text/plain',buffer:Buffer.from('test')});await expect(page.getByRole('alert')).toContainText('Choose photos or video clips');await expect(page.locator('.studio-tile')).toHaveCount(1);await page.getByRole('button',{name:'Describe this memory'}).click();await page.getByLabel('What would you like us to know?').fill('Mum and Jamie, summer 1998.');await expect(page.locator('#studio-save')).toHaveText('Draft kept in this browser');await page.waitForTimeout(450);await page.reload();await expect(page.getByLabel('What would you like us to know?')).toHaveValue('Mum and Jamie, summer 1998.');await fit(page);await page.screenshot({path:testInfo.outputPath('description.png'),fullPage:true});});

test('real photo and video import, ordering, story, narration, video download, and saved reopening',async({page},testInfo)=>{
  await mockAI(page);
  await page.locator('#story-media').setInputFiles([path.resolve('web/assets/lakeside-demo.png'),path.resolve('tests/fixtures/short-clip.mp4')]);
  await expect(page.locator('.studio-tile')).toHaveCount(2);
  await page.getByRole('button',{name:'Move item 2 earlier'}).click();
  await expect(page.locator('.studio-tile').first()).toContainText('short-clip.mp4');
  await page.getByRole('button',{name:'Describe this memory'}).click();
  await page.getByLabel('What would you like us to know?').fill('Jamie and Mum by the lake.');
  const request=page.waitForRequest('**/api/story');
  await page.getByRole('button',{name:'Generate story',exact:true}).click();
  const payload=(await request).postDataJSON();
  expect(payload.media[0].type).toBe('video');expect(payload.media[0].frames).toHaveLength(3);expect(payload.media[1].type).toBe('image');
  await expect(page.getByLabel('Story to read and narrate')).toContainText('Jamie and Mum');
  await page.getByLabel('Story to read and narrate').fill('Jamie and Mum spent a quiet afternoon by the lake.');
  await page.getByRole('button',{name:'Create AI narration',exact:true}).click();
  await expect(page.getByLabel('Finished narration')).toBeVisible();
  const download=page.waitForEvent('download');
  await page.getByRole('link',{name:'Download narration'}).click();
  const audio=await download;expect(fs.readFileSync(await audio.path()).toString('ascii',0,4)).toBe('RIFF');
  await page.getByRole('button',{name:'Create narrated video',exact:true}).click();
  await expect(page.getByLabel('Your finished memory film')).toBeVisible({timeout:20000});
  const movieDownload=page.waitForEvent('download');await page.getByRole('link',{name:'Download video'}).click();const movie=await movieDownload;const bytes=fs.readFileSync(await movie.path());expect(bytes.length).toBeGreaterThan(1000);expect(movie.suggestedFilename()).toMatch(/\.(mp4|webm)$/);
  const metadata=await page.getByLabel('Your finished memory film').evaluate(async video=>{if(video.readyState<1)await new Promise(resolve=>video.addEventListener('loadedmetadata',resolve,{once:true}));return {width:video.videoWidth,height:video.videoHeight,duration:video.duration};});expect(metadata.width).toBe(1280);expect(metadata.height).toBe(720);
  // Verify the exported file contains decodable audio, not just a silent picture track.
  const audioEnergy=await page.evaluate(async()=>{const video=document.querySelector('.studio-film'),context=new AudioContext();try{const buffer=await context.decodeAudioData(await(await fetch(video.src)).arrayBuffer());const samples=buffer.getChannelData(0);return samples.some(value=>Math.abs(value)>.001);}finally{await context.close();}});expect(audioEnergy).toBe(true);
  await page.getByRole('button',{name:'Save story to Memories'}).click();
  await expect(page.getByRole('status')).toContainText('Your story is saved in Memories');
  await page.goto('/');
  await page.getByRole('button',{name:'Open Our afternoon by the lake',exact:true}).click();
  await page.getByRole('link',{name:'Open your narrated story'}).click();
  await expect(page.getByLabel('Your finished memory film')).toBeVisible();
  await fit(page);await page.screenshot({path:testInfo.outputPath('finished-story.png'),fullPage:true});
});

test('own audio description is sent for transcription and can narrate the film',async({page})=>{await mockAI(page);await selectMedia(page);await page.locator('#description-audio').setInputFiles({name:'description.wav',mimeType:'audio/wav',buffer:wavTone()});await expect(page.getByLabel('Your recorded description')).toBeVisible();await page.getByRole('radio',{name:'My recorded voice'}).check();const request=page.waitForRequest('**/api/story');await page.getByRole('button',{name:'Generate story',exact:true}).click();expect((await request).postDataJSON().audio).toMatch(/^data:audio\/wav;base64,/);await expect(page.getByText('Mum packed sandwiches.',{exact:true})).toBeHidden();await page.getByText('Your transcribed description').click();await expect(page.getByText('Mum packed sandwiches.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Use my recorded narration'}).click();await expect(page.getByLabel('Finished narration')).toBeVisible();});

test('generation failure and missing connection retain media and description',async({page})=>{await page.route('**/api/story',route=>route.fulfill({status:503,json:{error:'AI story creation is not connected yet.'}}));await selectMedia(page);await page.getByLabel('What would you like us to know?').fill('Do not lose this description.');await page.getByRole('button',{name:'Generate story',exact:true}).click();await expect(page.getByRole('alert')).toContainText('not connected');await expect(page.getByLabel('What would you like us to know?')).toHaveValue('Do not lose this description.');await page.getByRole('button',{name:'Media',exact:false}).click();await expect(page.locator('.studio-tile')).toHaveCount(1);});

test('new story edits invalidate previously generated audio and video',async({page})=>{await mockAI(page);await selectMedia(page);await page.getByRole('button',{name:'Generate story',exact:true}).click();await page.getByRole('button',{name:'Create AI narration',exact:true}).click();await expect(page.getByLabel('Finished narration')).toBeVisible();await page.getByLabel('Story to read and narrate').fill('A different afternoon.');await expect(page.getByRole('button',{name:'Create narrated video',exact:true})).toBeDisabled();await expect(page.getByLabel('Finished narration')).toBeHidden();});

test('story maker key screens have no automated WCAG AA violations',async({page})=>{const AxeBuilder=require('@axe-core/playwright').default;const audit=async()=>{const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);};await mockAI(page);await audit();await selectMedia(page);await audit();await page.getByRole('button',{name:'Generate story',exact:true}).click();await audit();await fit(page);});
