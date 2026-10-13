import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';

const baseURL = 'http://127.0.0.1:3000';
const out = 'visual-artifacts';
await fs.mkdir(out, { recursive: true });

let hasBlockingIssue = false;

const hardTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms)),
]);

async function capture(name, viewport) {
  const startedAt = Date.now();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(20000);

  const consoleErrors = [];
  const pageErrors = [];
  const captureErrors = [];
  const captures = [];
  const a11yViolations = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(String(err)));

  const snap = async (label, options = {}) => {
    const path = `${out}/${name}-${label}.png`;
    try {
      await hardTimeout(
        page.screenshot({ path, fullPage: false, timeout: 25000, ...options }),
        28000,
        `${name}/${label} screenshot`,
      );
      captures.push(path);
    } catch (error) {
      captureErrors.push(`${label}: ${String(error)}`);
    }
  };

  const goTo = async (selector, label) => {
    await hardTimeout(
      page.evaluate((target) => {
        const element = document.querySelector(target);
        if (!element) throw new Error(`Missing selector: ${target}`);
        const top = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      }, selector),
      5000,
      `${name}/${label} scroll`,
    );
    await page.waitForTimeout(900);
    await snap(label);
  };

  try {
    await hardTimeout(page.goto(baseURL, { waitUntil: 'domcontentloaded' }), 18000, `${name} navigation`);
    await page.waitForTimeout(3800);

    try {
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])
        .analyze();
      for (const violation of axe.violations) {
        a11yViolations.push({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.slice(0, 6).map(node => node.target),
        });
      }
      const blockingA11y = axe.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      if (blockingA11y.length) captureErrors.push(`a11y: ${blockingA11y.map(v => `${v.id}(${v.nodes.length})`).join(', ')}`);
    } catch (error) {
      captureErrors.push(`a11y-audit: ${String(error)}`);
    }

    // Regression: a settled page must not write the scroll-progress CSS
    // property continuously while the visitor is idle. WebGL may still render
    // its own scene, but the DOM progress controller must sleep between events.
    try {
      const idleWrites = await page.evaluate(async () => {
        const style = document.documentElement.style;
        const original = style.setProperty;
        let writes = 0;
        style.setProperty = function (...args) {
          if (args[0] === '--journey') writes++;
          return original.apply(this, args);
        };
        try {
          await new Promise(resolve => setTimeout(resolve, 750));
        } finally {
          style.setProperty = original;
        }
        return writes;
      });
      if (idleWrites > 4) {
        captureErrors.push(`idle-scroll-performance: ${idleWrites} journey style updates during 750ms idle`);
      }
    } catch (error) {
      captureErrors.push(`idle-scroll-performance: ${String(error)}`);
    }

    await snap('hero');

    // A global navigation shortcut must never open a modal while a visitor is
    // typing in a form field. The fixture is removed before visual captures.
    try {
      await page.evaluate(() => {
        const field = document.createElement('input');
        field.id = 'v5-shortcut-input-fixture';
        field.setAttribute('aria-label', 'Keyboard shortcut safety test');
        field.style.cssText = 'position:fixed;left:-9999px;opacity:0';
        document.body.appendChild(field);
        field.focus();
      });
      await page.keyboard.type('ra', { delay: 50 });
      const shortcutSafety = await page.evaluate(() => {
        const field = document.getElementById('v5-shortcut-input-fixture');
        const value = field?.value;
        const recruiterOpen = !!document.querySelector('.recruiter-panel');
        const atlasOpen = !!document.querySelector('[role="dialog"][aria-label*="atlas" i]');
        field?.remove();
        return { value, recruiterOpen, atlasOpen };
      });
      if (shortcutSafety.value !== 'ra' || shortcutSafety.recruiterOpen || shortcutSafety.atlasOpen) {
        captureErrors.push('keyboard-shortcuts: typing into an input opened a global overlay or lost text');
      }
    } catch (error) {
      captureErrors.push(`keyboard-shortcuts: ${String(error)}`);
      await page.evaluate(() => document.getElementById('v5-shortcut-input-fixture')?.remove());
    }

    const sections = [
      ['profile', '#profile'],
      ['foundation', '#foundation'],
      ['knowledge', '#knowledge'],
      ['agency', '#agency'],
      ['reliability', '#reliability'],
      ['flight-log', '#flight-log'],
      ['principle', '#principle'],
      ['comms', '#comms'],
    ];

    for (const [label, selector] of sections) {
      try { await goTo(selector, label); }
      catch (error) { captureErrors.push(`${label}: ${String(error)}`); }
    }

    try {
      await goTo('#knowledge', 'knowledge-focus');
      const card = page.locator('.director-project').first();
      if (name === 'desktop') {
        await card.hover({ position: { x: 220, y: 130 }, timeout: 15000 });
        await page.waitForTimeout(450);
        await snap('project-hover');
      }
      await card.click({ force: true, timeout: 15000 });
      await page.waitForTimeout(500);
      const inspector = page.locator('.inspector').first();
      if (!(await inspector.isVisible())) captureErrors.push('project-inspector: did not open');
      await snap('project-inspector');
      await page.getByRole('button', { name: /close project/i }).click();
      await page.waitForTimeout(250);
    } catch (error) {
      captureErrors.push(`project-interaction: ${String(error)}`);
    }

    try {
      const quickView = page.getByRole('button', { name: /recruiter cut/i });
      if (!(await quickView.isVisible())) captureErrors.push('recruiter-cut: trigger not visible');
      await quickView.click({ force: true, timeout: 15000 });
      await page.waitForTimeout(450);
      const recruiterAudit = await page.evaluate(() => {
        const panel = document.querySelector('.recruiter-panel');
        const links = Array.from(document.querySelectorAll('.recruiter-panel .action-row a'));
        if (!panel) return { missing: true, scrollable: false, minContrast: 0 };
        const overflowY = getComputedStyle(panel).overflowY;
        const scrollable = panel.scrollHeight <= panel.clientHeight + 2 || overflowY === 'auto' || overflowY === 'scroll';

        const srgb = (n) => {
          const v = n / 255;
          return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
        };
        const luminance = ([r,g,b]) => .2126*srgb(r)+.7152*srgb(g)+.0722*srgb(b);
        const parseRgb = (value) => {
          const nums = value.match(/[\d.]+/g)?.map(Number) ?? [];
          return nums.slice(0,3);
        };
        const panelLum = luminance([233,230,221]);
        const ratios = links.map(link => {
          const rgb = parseRgb(getComputedStyle(link).color);
          if (rgb.length < 3) return 1;
          const lum = luminance(rgb);
          return (Math.max(panelLum,lum)+.05)/(Math.min(panelLum,lum)+.05);
        });
        return {
          missing:false,
          scrollable,
          minContrast: ratios.length ? Math.min(...ratios) : 0,
          scrollHeight: panel.scrollHeight,
          clientHeight: panel.clientHeight,
          overflowY,
        };
      });
      if (recruiterAudit.missing) captureErrors.push('recruiter-cut: panel missing');
      if (!recruiterAudit.scrollable) captureErrors.push(`recruiter-cut: content clips without scroll (${recruiterAudit.scrollHeight} > ${recruiterAudit.clientHeight}, overflowY=${recruiterAudit.overflowY})`);
      if (recruiterAudit.minContrast && recruiterAudit.minContrast < 3) captureErrors.push(`recruiter-cut: action contrast too low (${recruiterAudit.minContrast.toFixed(2)}:1)`);
      await snap('recruiter-cut');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } catch (error) {
      captureErrors.push(`recruiter-cut: ${String(error)}`);
    }

    try {
      const atlasTrigger = page.getByRole('button', { name: /systems atlas/i }).first();
      if (!(await atlasTrigger.isVisible())) captureErrors.push('systems-atlas: trigger not visible');
      await atlasTrigger.click({ force: true, timeout: 15000 });
      await page.waitForTimeout(450);
      const atlas = page.getByRole('dialog', { name: /systems atlas/i });
      if (!(await atlas.isVisible())) captureErrors.push('systems-atlas: dialog did not open');
      await snap('systems-atlas');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } catch (error) {
      captureErrors.push(`systems-atlas: ${String(error)}`);
    }

    try {
      const layout = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const heroSpans = Array.from(document.querySelectorAll('.director-name span')).map((node) => {
          const rect = node.getBoundingClientRect();
          return { text: node.textContent || '', left: rect.left, right: rect.right, width: rect.width };
        });
        const systemCards = Array.from(document.querySelectorAll('.director-system-scene .director-project')).map((node) => {
          const rect = node.getBoundingClientRect();
          const title = node.querySelector('.director-project-title')?.getBoundingClientRect();
          const summary = node.querySelector('.director-project-summary')?.getBoundingClientRect();
          const proof = node.querySelector('.director-project-proof')?.getBoundingClientRect();
          const signal = node.querySelector('.director-project-signal')?.getBoundingClientRect();
          const footer = node.querySelector('.director-project-bottom')?.getBoundingClientRect();
          const contentBottom = Math.max(summary?.bottom ?? rect.top, proof?.bottom ?? rect.top, signal?.bottom ?? rect.top);
          return {
            left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width,
            titleLeft:title?.left ?? null, titleRight:title?.right ?? null,
            footerTop:footer?.top ?? null, footerBottom:footer?.bottom ?? null,
            contentBottom,
            footerOverlap: footer ? footer.top < contentBottom - 1 : false,
            childClip: [title,summary,proof,signal,footer].filter(Boolean).some(child => child.left < rect.left - 2 || child.right > rect.right + 2 || child.top < rect.top - 2 || child.bottom > rect.bottom + 2),
          };
        });
        const thesis = Array.from(document.querySelectorAll('.director-thesis span')).map(node => {
          const rect=node.getBoundingClientRect();
          return {left:rect.left,right:rect.right,width:rect.width,text:(node.textContent||'').trim()};
        });
        const scrollCue = document.querySelector('.director-scroll');
        const scrollRect = scrollCue ? scrollCue.getBoundingClientRect() : null;
        return {
          viewportWidth,
          heroSpans,
          systemCards,
          thesis,
          scrollCue: scrollRect ? {left:scrollRect.left,right:scrollRect.right,width:scrollRect.width,display:getComputedStyle(scrollCue).display} : null
        };
      });
      await fs.writeFile(`${out}/${name}-layout.json`, JSON.stringify(layout, null, 2));

      const badHero = layout.heroSpans.find(rect => rect.left < -2 || rect.right > layout.viewportWidth + 2);
      if (badHero) captureErrors.push(`hero-overflow: ${badHero.text} [${badHero.left.toFixed(1)}, ${badHero.right.toFixed(1)}]`);

      const clippedCard = layout.systemCards.find(rect => rect.childClip || rect.footerOverlap);
      if (clippedCard) captureErrors.push(`system-card-content-collision: childClip=${clippedCard.childClip} footerOverlap=${clippedCard.footerOverlap}`);

      const badThesis = layout.thesis.find(rect => rect.left < -2 || rect.right > layout.viewportWidth + 2);
      if (badThesis) captureErrors.push(`thesis-overflow: ${badThesis.text} [${badThesis.left.toFixed(1)}, ${badThesis.right.toFixed(1)}]`);

      if (layout.scrollCue && layout.scrollCue.display !== 'none' && (layout.scrollCue.left < -2 || layout.scrollCue.right > layout.viewportWidth + 2)) {
        captureErrors.push(`scroll-cue-overflow: [${layout.scrollCue.left.toFixed(1)}, ${layout.scrollCue.right.toFixed(1)}]`);
      }

      if (name === 'mobile') {
        const badCard = layout.systemCards.find(rect => rect.width < layout.viewportWidth * 0.78 || rect.left < -2 || rect.right > layout.viewportWidth + 2);
        if (badCard) captureErrors.push(`mobile-system-card-geometry: left=${badCard.left.toFixed(1)} right=${badCard.right.toFixed(1)} width=${badCard.width.toFixed(1)}`);
      }
    } catch (error) {
      captureErrors.push(`layout-audit: ${String(error)}`);
    }

    try {
      await hardTimeout(
        page.evaluate(async () => {
          const maxY = document.documentElement.scrollHeight;
          for (let y = 0; y < maxY; y += 1200) {
            window.scrollTo(0, y);
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          window.scrollTo(0, 0);
        }),
        30000,
        `${name} activation scroll`,
      );
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const offenders = Array.from(document.querySelectorAll('body *'))
          .map(node => {
            const rect = node.getBoundingClientRect();
            return {
              tag: node.tagName.toLowerCase(),
              cls: typeof node.className === 'string' ? node.className.slice(0, 140) : '',
              text: (node.textContent || '').trim().replace(/\s+/g,' ').slice(0, 90),
              left: rect.left,
              right: rect.right,
              width: rect.width,
              position: getComputedStyle(node).position,
              overflowX: getComputedStyle(node).overflowX,
            };
          })
          .filter(item => item.width > 0 && (item.left < -2 || item.right > viewportWidth + 2))
          .sort((a,b) => Math.max(b.right-viewportWidth,-b.left)-Math.max(a.right-viewportWidth,-a.left))
          .slice(0,20);
        const criticalOffenders = Array.from(document.querySelectorAll('body *'))
          .filter(node => {
            if (node.closest('.cinematic-grade,.world-canvas,.scene-word,.scene-index,.director-project-glow')) return false;
            // Scroll-driven chapter transitions deliberately translate inactive
            // story sections through/outside the viewport. Only assess geometric
            // clipping on the active chapter; global scroll width and individual
            // card child-clipping are independently asserted.
            const chapter = node.closest('[data-story-section="true"]');
            if (chapter && !chapter.classList.contains('is-active')) return false;
            const style=getComputedStyle(node);
            if (style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0) return false;
            const rect=node.getBoundingClientRect();
            // Inspect rendered *direct* text, not the full textContent of grids,
            // timelines, cards and other containers with descendant text. Those
            // parent rectangles animate as a unit and can extend off-canvas
            // without clipping any individual readable label.
            const text=Array.from(node.childNodes)
              .filter(child=>child.nodeType===3)
              .map(child=>child.textContent||'').join('').trim();
            // QA should flag visible clipped copy, not inactive offscreen chapters
            // (scroll-driven sections intentionally start translated outside the viewport).
            // Entirely off-screen nodes do not represent *visible* clipping
            // during scroll-driven chapter entrances. Horizontal document
            // overflow and card-internal clipping are validated separately.
            return text.length>0 && rect.width>0
              && rect.bottom>0 && rect.top<window.innerHeight
              && rect.right>0 && rect.left<viewportWidth
              && (rect.left < -2 || rect.right > viewportWidth + 2);
          })
          .map(node => {
            const rect=node.getBoundingClientRect();
            return {tag:node.tagName.toLowerCase(),cls:typeof node.className==='string'?node.className.slice(0,140):'',text:(node.textContent||'').trim().replace(/\s+/g,' ').slice(0,90),left:rect.left,right:rect.right,width:rect.width};
          })
          .slice(0,12);
        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth,
          scrollHeight: document.documentElement.scrollHeight,
          offenders,
          criticalOffenders
        };
      });
      await fs.writeFile(`${out}/${name}-overflow.json`, JSON.stringify(overflow, null, 2));
      if (overflow.scrollWidth > overflow.viewportWidth + 2) {
        const top = overflow.offenders[0];
        const detail = top ? ` top=${top.tag}.${top.cls} [${top.left.toFixed(1)}, ${top.right.toFixed(1)}]` : '';
        captureErrors.push(`horizontal-overflow: ${overflow.scrollWidth}px > ${overflow.viewportWidth}px${detail}`);
      }
      if (overflow.criticalOffenders?.length) {
        const top=overflow.criticalOffenders[0];
        captureErrors.push(`visible-content-overflow: ${top.tag}.${top.cls} "${top.text}" [${top.left.toFixed(1)}, ${top.right.toFixed(1)}]`);
      }
      await snap('full-activated', { fullPage: true, captureBeyondViewport: false });
    } catch (error) {
      captureErrors.push(`full-activated: ${String(error)}`);
    }
  } catch (error) {
    captureErrors.push(`fatal: ${String(error)}`);
  } finally {
    await fs.writeFile(
      `${out}/${name}-browser.json`,
      JSON.stringify({viewport,elapsedMs:Date.now()-startedAt,captures,consoleErrors,pageErrors,captureErrors,a11yViolations}, null, 2),
    );
    if (consoleErrors.length || pageErrors.length || captureErrors.length) hasBlockingIssue = true;
    await context.close();
    await browser.close();
  }
}

await capture('desktop', { width: 1440, height: 900 });
await capture('laptop', { width: 1366, height: 768 });
await capture('mobile', { width: 390, height: 844 });

async function captureFrench(name, viewport) {
  const browser = await chromium.launch({ headless:true });
  const context = await browser.newContext({ viewport, deviceScaleFactor:1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type()==='error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(String(err)));
  try {
    await page.goto(baseURL + '/fr/', { waitUntil:'domcontentloaded', timeout:20000 });
    await page.waitForTimeout(600);
    const audit = await page.evaluate(() => {
      const viewportWidth=window.innerWidth;
      const offenders=Array.from(document.querySelectorAll('body *')).filter(node=>{
        const style=getComputedStyle(node);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
        const rect=node.getBoundingClientRect();
        return rect.width>0&&(rect.left < -2 || rect.right > viewportWidth + 2);
      }).map(node=>{
        const rect=node.getBoundingClientRect();
        return {tag:node.tagName.toLowerCase(),cls:typeof node.className==='string'?node.className.slice(0,100):'',left:rect.left,right:rect.right};
      }).slice(0,10);
      return {
        scrollWidth:document.documentElement.scrollWidth,
        viewportWidth,
        h1:document.querySelector('h1')?.textContent?.trim()||'',
        hasCv:Boolean(Array.from(document.querySelectorAll('a')).find(a=>/CV/i.test(a.textContent||''))),
        offenders
      };
    });
    if(audit.h1!=='Maharshi Patel')errors.push('fr: missing expected H1');
    if(!audit.hasCv)errors.push('fr: CV link missing');
    if(audit.scrollWidth>audit.viewportWidth+2)errors.push(`fr: horizontal overflow ${audit.scrollWidth} > ${audit.viewportWidth}`);
    await page.screenshot({path:`${out}/${name}-fr.png`,fullPage:true,timeout:25000});
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    const blocking=axe.violations.filter(v=>v.impact==='critical'||v.impact==='serious');
    if(blocking.length)errors.push(`fr a11y: ${blocking.map(v=>v.id).join(', ')}`);
  } catch(error) {
    errors.push(String(error));
  } finally {
    await fs.writeFile(`${out}/${name}-fr-browser.json`,JSON.stringify({viewport,errors},null,2));
    if(errors.length)hasBlockingIssue=true;
    await context.close();
    await browser.close();
  }
}

await captureFrench('desktop', { width:1440, height:900 });
await captureFrench('mobile', { width:390, height:844 });

async function captureProject(name, viewport) {
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  page.on('pageerror',err=>errors.push(String(err)));
  try{
    await page.goto(baseURL+'/projects/agentic-rag-engine/',{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(500);
    const audit=await page.evaluate(()=>{
      const w=window.innerWidth;
      const scrollWidth=document.documentElement.scrollWidth;
      const title=document.querySelector('h1')?.textContent?.trim()||'';
      const snapshot=document.querySelectorAll('.project-snapshot article').length;
      const architecture=document.querySelectorAll('.architecture-node').length;
      const evidence=document.querySelectorAll('.project-deep-dive li').length;
      const actions=document.querySelectorAll('.project-actions a').length;
      const pagination=document.querySelectorAll('.project-pagination a').length;
      const visibleOverflow=Array.from(document.querySelectorAll('body *')).filter(node=>{
        const style=getComputedStyle(node);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
        if(node.closest('.project-art'))return false;
        const rect=node.getBoundingClientRect();
        return rect.width>0&&(rect.left < -2 || rect.right > w + 2);
      }).slice(0,8).map(node=>{
        const rect=node.getBoundingClientRect();
        return {tag:node.tagName.toLowerCase(),cls:typeof node.className==='string'?node.className.slice(0,100):'',left:rect.left,right:rect.right};
      });
      return {w,scrollWidth,title,snapshot,architecture,evidence,actions,pagination,visibleOverflow};
    });
    if(audit.title!=='Agentic RAG Engine')errors.push('project: wrong or missing title');
    if(audit.snapshot!==4)errors.push(`project: expected 4 snapshot cells, got ${audit.snapshot}`);
    if(audit.architecture<4)errors.push(`project: architecture incomplete (${audit.architecture})`);
    if(audit.evidence<6)errors.push(`project: evidence surface too small (${audit.evidence})`);
    if(audit.actions<2)errors.push('project: source/live actions missing');
    if(audit.pagination!==2)errors.push('project: previous/next navigation missing');
    if(audit.scrollWidth>audit.w+2)errors.push(`project: horizontal overflow ${audit.scrollWidth} > ${audit.w}`);
    if(audit.visibleOverflow.length)errors.push(`project: visible overflow ${JSON.stringify(audit.visibleOverflow[0])}`);
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    const blocking=axe.violations.filter(v=>v.impact==='critical'||v.impact==='serious');
    if(blocking.length) {
      const details = blocking.map(v => ({
        id:v.id,
        impact:v.impact,
        nodes:v.nodes.slice(0,12).map(n => ({
          target:n.target,
          summary:n.failureSummary,
        })),
      }));
      await fs.writeFile(`${out}/${name}-project-a11y.json`, JSON.stringify(details,null,2));
      console.error(`project ${name} accessibility failures: ${JSON.stringify(details)}`);
      errors.push(`project a11y: ${blocking.map(v=>v.id).join(', ')}`);
    }
    await page.screenshot({path:`${out}/${name}-project-agentic-rag.png`,fullPage:true,timeout:25000});
  }catch(error){
    errors.push(String(error));
  }finally{
    await fs.writeFile(`${out}/${name}-project-browser.json`,JSON.stringify({viewport,errors},null,2));
    if(errors.length)hasBlockingIssue=true;
    await context.close();
    await browser.close();
  }
}

await captureProject('desktop',{width:1440,height:900});
await captureProject('mobile',{width:390,height:844});

if (hasBlockingIssue) {
  console.error('Portfolio V5 visual QA failed. Browser audit summaries:');
  for (const name of ['desktop-browser','laptop-browser','mobile-browser',
                      'desktop-fr-browser','mobile-fr-browser',
                      'desktop-project-browser','mobile-project-browser']) {
    try {
      const report=JSON.parse(await fs.readFile(`${out}/${name}.json`, 'utf8'));
      const errors=[...(report.captureErrors||[]),...(report.errors||[]),
                    ...(report.consoleErrors||[]),...(report.pageErrors||[])];
      if (errors.length) console.error(`${name}: ${JSON.stringify(errors)}`);
    } catch(error) {
      console.error(`${name}: cannot inspect report (${String(error)})`);
    }
  }
  process.exitCode = 1;
}
