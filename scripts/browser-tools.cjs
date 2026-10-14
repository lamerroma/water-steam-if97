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
};

// Follow the compact menu/search paths used by mobile users.
exports.openAppMenu=async page=>{const menu=page.locator('.mobile-app-menu');if(await menu.count()&&!await menu.evaluate(e=>e.open))await menu.locator(':scope > summary').click();};
exports.openToolFinder=async page=>{if(!await page.locator('#tool-catalog-toggle').isVisible())await page.click('#ui-search-toggle');};

exports.openUnits=async page=>{if(!await page.locator('.setup-pane').isVisible())await page.click('#ui-units-toggle');};
exports.closeUnits=async page=>{if(await page.locator('.setup-pane').isVisible())await page.locator('.setup-pane [data-action=toggle-setup]').evaluate(e=>e.click());};
exports.chooseModel=async(page,model)=>{await exports.openUnits(page);await page.locator('input[name=formulation][value="'+model+'"]').check();await exports.closeUnits(page);};
