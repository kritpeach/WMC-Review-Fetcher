const fetch = require("node-fetch")
const jsdom = require("jsdom")
const jsonfile = require('jsonfile')
const { JSDOM } = jsdom

const fetch_retry = async (url, options, n) => {
    try {
        return await fetch(url, options)
    } catch (err) {
        if (n === 1) throw err;
        return await fetch_retry(url, options, n - 1);
    }
};

const googleReview = async (q) => {
    const google = await fetch(`https://www.google.com/search?q=${q}&gl=th&hl=en`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 XL Build/OPD1.170816.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Mobile Safari/537.36"
        }
    })
    const googleResponse = await google.text()
    const dom = new JSDOM(googleResponse)
    const starsLine = dom.window.document.querySelector("g-review-stars");
    const { parentElement } = starsLine
    const rating = parseFloat(parentElement.querySelector("span").textContent)
    const reviewCount = parseInt(parentElement.querySelector("div").textContent.replace(/[{()}]/g, ''))
    return { rating, reviewCount }
}

const facebookReview = async (pageId) => {
    const facebook = await fetch_retry(`https://en-gb.facebook.com/pg/${pageId}/reviews/`)
    const facebookResponse = await facebook.text()
    const dom = new JSDOM(facebookResponse)
    const reviewLine = dom.window.document.querySelectorAll("div[role=complementary] > div > div");
    const rating = parseFloat(reviewLine[1].textContent.split(" out of ")[0])
    const reviewCount = parseInt(reviewLine[2].textContent.replace(/\D/g, ''))
    return { rating, reviewCount }
}
const run = async () => {
    const worldmedClinic = await googleReview("worldmed+clinic")
    const wordmedHospital = await googleReview("worldmed+hospital")
    const worldmedFacebook = await facebookReview("worldmedcenter")
    const reviews = { wordmedHospital, worldmedClinic, worldmedFacebook }
    jsonfile.writeFileSync("/var/www/html/wp-content/uploads/wmc-review/review.json", { reviews , timestamp: new Date().toJSON()})
    console.log(reviews)
}
run()