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

const googleMapReview = async (googlUrl, page) => {
    await page.goto(googlUrl)
    await page.waitForSelector(".section-star-display")
    await page.screenshot({ path: `/var/www/html/wp-content/uploads/wmc-review/${googlUrl.split("/")[4]}.png` });
    const rating = await page.evaluate(() => parseFloat(document.querySelector(".section-star-display").textContent))
    const reviewCount = await page.evaluate(() => parseInt(document.querySelector(".section-rating-line .widget-pane-link").textContent.replace(/\D/g, '')))
    return { rating, reviewCount }
}
const fetchAndSaveReview = async (page) => {
    try {
        const worldmedClinic = await googleMapReview("https://goo.gl/maps/yvbUrohuUou", page)
        const worldmedHospital = await googleMapReview("https://goo.gl/maps/wk7e2P67XXJ2", page)
        const worldmedFacebook = await facebookReview("worldmedcenter")
        const reviews = { worldmedHospital, worldmedClinic, worldmedFacebook }
        jsonfile.writeFileSync("/var/www/html/wp-content/uploads/wmc-review/review.json", { reviews, date: new Date().toJSON() })
        console.log(`[${new Date().toGMTString()}]`, "Saved review data successfully")
        console.log(reviews)
    } catch (e) {
        await page.screenshot({ path: `/var/www/html/wp-content/uploads/wmc-review/error_${googlUrl.split("/")[4]}.png` })
        console.error(`[${new Date().toGMTString()}]`, e)
    }
}

const run = async () => {
    console.log("Fetching review data every 6 hours")
    const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] })
    const page = await browser.newPage()
    fetchAndSaveReview(page)
    cron.schedule("0 */6 * * *", () => fetchAndSaveReview(page))
}

run()