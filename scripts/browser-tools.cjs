// Exercise the actual navigation rather than clicking tabs hidden by grouping.
exports.openTool=async(page,action)=>{
 if(await page.locator('body').evaluate(e=>e.classList.contains('ui-task-layout'))&&await page.locator('.setup-pane').isVisible()&&!await page.locator('body').evaluate(e=>e.classList.contains('diagram-active')))await page.locator('.setup-pane [data-action=toggle-setup]').evaluate(e=>e.click());
 if(await page.locator('#section-select').isVisible()){
  await page.selectOption('#section-select',action);
 }else{
  await page.fill('#tool-search',action);
  await page.locator(`[role=tab][data-action="${action}"]`).click();
  await page.fill('#tool-search','');
 }
 // Locator.waitFor returns no remote ElementHandle. Keeping a canvas handle
 // alive also keeps its detached event closures and old diagram scenes alive.
 if(['ts','hsdiagram','phdiagram'].includes(action))await page.locator('#steam-diagram').waitFor({timeout:180000});
};

// Follow the compact menu/search paths used by mobile users.
exports.openAppMenu=async page=>{const menu=page.locator('.mobile-app-menu');if(await menu.count()&&!await menu.evaluate(e=>e.open))await menu.locator(':scope > summary').click();};
exports.openToolFinder=async page=>{if(!await page.locator('#tool-catalog-toggle').isVisible())await page.click('#ui-search-toggle');};

exports.openUnits=async page=>{if(!await page.locator('.setup-pane').isVisible())await page.click('#ui-units-toggle');};
exports.closeUnits=async page=>{if(await page.locator('.setup-pane').isVisible())await page.locator('.setup-pane [data-action=toggle-setup]').evaluate(e=>e.click());};
exports.chooseModel=async(page,model)=>{await exports.openUnits(page);await page.locator('input[name=formulation][value="'+model+'"]').click();await page.waitForFunction(model=>document.querySelector('input[name=formulation]:checked')?.value===model,model,{timeout:120000});await exports.closeUnits(page);};

// Exercise a fresh navigation through the real, verified service-worker cache.
// Callers must allow service workers in this disposable test context. Start with
// fresh local data, matching the former independent file-origin scenarios. Warm-up is online; all
// subsequent assertions, including a newly created calculation Worker, are offline.
exports.openOfflineApp=async(page,baseURL=process.env.CALCULATOR_URL||process.env.DIAGRAM_URL||'http://127.0.0.1:8080/')=>{
 const context=page.context();await context.setOffline(false);
 await page.goto(baseURL);
 await page.evaluate(()=>localStorage.clear());await page.reload();
 await page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||'')&&!document.querySelector('#calculate')?.disabled,null,{timeout:120000});
 await context.setOffline(true);await page.reload();
 await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);
};
