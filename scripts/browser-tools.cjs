// Exercise the actual navigation rather than clicking tabs hidden by grouping.
exports.openTool=async(page,action)=>{
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
