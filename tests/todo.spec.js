import {test,expect} from '@playwright/test';
test('no-build todo example: add, edit, cancel, filter, persist, delete and clear',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/todo-mvc/');
  const input=page.getByRole('textbox',{name:'New todo'});
  for(const title of ['First','Second','Third']) {await input.fill(title);await input.press('Enter');}
  await expect(page.locator('li')).toHaveCount(3);
  await page.locator('li label').first().dblclick();
  let edit=page.getByRole('textbox',{name:'Edit todo'});
  await edit.fill('Revised');await edit.press('Enter');
  await expect(page.locator('li label').first()).toHaveText('Revised');
  await page.locator('li label').first().dblclick();
  await edit.fill('Discard');await edit.press('Escape');
  await expect(page.locator('li label').first()).toHaveText('Revised');
  await page.getByRole('checkbox',{name:'Complete todo'}).nth(1).check();
  await page.getByRole('button',{name:'Active',exact:true}).click();
  await expect(page.locator('li label')).toHaveText(['Revised','Third']);
  await page.getByRole('button',{name:'Delete todo'}).nth(1).click();
  await page.getByRole('button',{name:'All',exact:true}).click();
  await expect(page.locator('li label')).toHaveText(['Revised','Second']);
  await page.reload();await expect(page.locator('li label')).toHaveText(['Revised','Second']);
  await page.getByRole('button',{name:'Clear completed'}).click();
  await expect(page.locator('li label')).toHaveText(['Revised']);
  await page.getByRole('checkbox',{name:'Toggle all'}).check();
  await page.getByRole('button',{name:'Clear completed'}).click();
  await expect(page.locator('li')).toHaveCount(0);
  expect(errors).toEqual([]);
});
