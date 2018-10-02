const fetch = require("node-fetch")
const jsdom = require("jsdom")
const jsonfile = require('jsonfile')
const cron = require("node-cron")
const puppeteer = require('puppeteer')
const { JSDOM } = jsdom

const fetch_retry = async (url, n) => {
    try {
        return await fetch(url)
    } catch (err) {
        if (n === 1) throw err;
        return await fetch_retry(url, n - 1);
    }
};

const facebookReview = async (pageId) => {
    const facebook = await fetch_retry(`https://en-gb.facebook.com/pg/${pageId}/reviews/`, 3)
    const facebookResponse = await facebook.text()
    const dom = new JSDOM(facebookResponse)
    const reviewLine = dom.window.document.querySelectorAll("div[role=complementary] > div > div");
    const rating = parseFloat(reviewLine[1].textContent.split(" out of ")[0])
    const reviewCount = parseInt(reviewLine[2].textContent.replace(/\D/g, ''))
    return { rating, reviewCount }
}

const googleMapReview = async (googlUrl, browser) => {
    const page = await browser.newPage()
    await page.goto(googlUrl)
    await page.waitForSelector(".section-star-display")
    await page.screenshot({path: `/var/www/html/wp-content/uploads/wmc-review/${googlUrl.split("/")[4]}.png`});
    const rating = await page.evaluate(() => parseFloat(document.querySelector(".section-star-display").textContent))
    const reviewCount = await page.evaluate(() => parseInt(document.querySelector(".section-rating-line .widget-pane-link").textContent.replace(/\D/g, '')))
    console.log({ rating, reviewCount })
    return { rating, reviewCount }
}
const run = async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
    try {
        const results = await Promise.all([
            googleMapReview("https://goo.gl/maps/yvbUrohuUou", browser),
            googleMapReview("https://goo.gl/maps/wk7e2P67XXJ2", browser),
            facebookReview("worldmedcenter")
        ])
        const reviews = { worldmedHospital: results[1], worldmedClinic: results[0], worldmedFacebook: results[2] }
        jsonfile.writeFileSync("/var/www/html/wp-content/uploads/wmc-review/review.json", { reviews, date: new Date().toJSON() })
        console.log(`[${new Date().toGMTString()}]`, "Saved review data successfully")
    } catch (e) {
        console.error(`[${new Date().toGMTString()}]`, e)
    } finally {
        browser.close()
    }
}
console.log("Fetching review data every 6 hours")
run()
cron.schedule("0 */6 * * *", () => run())
