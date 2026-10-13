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
