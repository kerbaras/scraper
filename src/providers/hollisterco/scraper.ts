import Product from '../../entities/product'
import Scraper from '../../interfaces/scraper'
import screenPage from '../../utils/capture'

const scraper: Scraper = async (request, page) => {
  page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36',
  )

  console.log('--->')
  console.log(request.pageUrl)

  await page.goto(request.pageUrl, { waitUntil: 'networkidle2' })
  // await page.goto(request.pageUrl)

  await page.waitForSelector('.product-title-main-header')
  let title = // @ts-ignore
  (await page.$eval('.product-title-main-header', match => match.innerText ?? '')).trim()

  const products = [new Product('1', title, request.pageUrl)]

  // const products = [new Product('id', 'title', 'url')]

  const screenshot = await screenPage(page)

  return {
    screenshot,
    products,
  }
}

export default scraper
