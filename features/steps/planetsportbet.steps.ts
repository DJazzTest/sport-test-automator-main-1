import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import assert from 'assert';

let driver: WebDriver;

Before(async function () {
  driver = await new Builder().forBrowser('chrome').build();
});

After(async function () {
  await driver.quit();
});

Given('I navigate to {string}', async function (url: string) {
  await driver.get(url);
});

When('I go to {string}', async function (url: string) {
  await driver.get(url);
});

When('I click on any in-play match (tennis or cricket)', async function () {
  // Wait for matches to load, then click the first tennis or cricket match
  await driver.wait(until.elementLocated(By.css('[data-sport="Tennis"], [data-sport="Cricket"]')), 10000);
  const match = await driver.findElement(By.css('[data-sport="Tennis"], [data-sport="Cricket"]'));
  await match.click();
});

Then('I should see an element with class "swiper-slide match-stats-one swiper-slide-prev"', async function () {
  await driver.wait(until.elementLocated(By.css('.swiper-slide.match-stats-one.swiper-slide-prev')), 10000);
  const element = await driver.findElement(By.css('.swiper-slide.match-stats-one.swiper-slide-prev'));
  assert.ok(await element.isDisplayed());
});
