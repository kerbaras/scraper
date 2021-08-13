import Product from '../../entities/product'
import Scraper from '../../interfaces/scraper'
import screenPage from '../../utils/capture'

const scraper: Scraper = async (request, page) => {
  page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36',
  )

  let itemGroupUrl = request.pageUrl
  let itemGroupId = request.pageUrl.split('?')[0].split('-').slice(-1)[0]

  await page.goto(request.pageUrl)

  const data = await page.evaluate(() => {
    let title = document.querySelector('.product-title-main-header')?.textContent?.trim() || ''
    let subtitle = document.querySelector('.short-description')?.textContent?.trim() || ''

    // @ts-ignore
    let currency = document
      .querySelector('.open-currency-selection-modal span')
      .textContent.split('(')[1]
      .split(')')[0]

    // @ts-ignore
    let breadcrumbs = document.querySelector('.breadcrumbs ol').innerText.split('\n')

    let options = Array.prototype.map
      .call(document.querySelectorAll('select[name="sku"] option'), el => ({
        idx: el.value,
        ...Object.assign({}, el.dataset),
      }))

    // if more than one option remove the first empty tag
    options = options.length === 1 ? options : options.slice(1)

    let swatch
    let onlyOneAvailable = false

    // @ts-ignore
    if (document.querySelector('.product-swatches li').length > 1) {
      swatch = Array.prototype.map.call(
        document.querySelectorAll('.product-swatches input'),
        el => ({
          ...Object.assign({}, el.dataset),
        }),
      )
    } else {
      // @ts-ignore
      onlyOneAvailable = options.find(o => o.inventoryStatus === 'Available').swatch
      swatch = [
        {
          // @ts-ignore
          productid: Object.keys(productCatalog)[0],
          swatch: onlyOneAvailable,
          producturl: null,
        },
      ]
    }

    swatch = swatch.map(sw => {
      //@ts-ignore
      let p = productCatalog[sw.productid]
      let kv = p.productAttrsComplex.FiberContent
      let keyValues = {}

      if(kv !== undefined) {
        // check for .value (str) or .values []
        if (kv.value) {
          let [key, value] = kv.value.split(':')
          keyValues[key] = value
        } else {
          //@ts-ignore
          for (let pairs of p.productAttrsComplex.FiberContent.values) {
            let [key, value] = pairs.value.split(':')
            keyValues[key] = value
          }
        }
      }

      let bullets = p.productAttrsComplex.CareInstructions?.values.map(o => o.value)
      bullets = Array.isArray(bullets) ? bullets : []

      return {
        //@ts-ignore
        ...sw,
        sizeChartUrls: [
          `https://www.hollisterco.com/api/ecomm/h-wd/product/sizeguide/${p.sizeChartName}`,
        ],
        description: p.longDesc,
        keyValuePairs: keyValues,
        bullets: bullets,
        //@ts-ignore
        images: Object.values(productCatalog[sw.productid].imageSets)
          .flat()
          //@ts-ignore
          .filter(o => o.id)
          //@ts-ignore
          .map(o => `https://img.hollisterco.com/is/image/anf/${o.id}?policy=product-large`),
      }
    })

    options = options
      .filter((op: any) => !onlyOneAvailable || op.swatch === onlyOneAvailable)
      .map((op: any) => ({
        ...op,
        ...swatch.find(s => s.swatch === op.swatch),
      }))

    options = options.map((op: any) => {
      //@ts-ignore
      let item:any = Object.values(productPrices[op.productid].items)[0]
      return {
        ...op,
        ...item
      }
  })

    return {
      options,
      title,
      subtitle,
      breadcrumbs,
      currency,
    }
  })

  data.options = data.options.map((op: any) => ({
    ...op,
    producturl:
      op.producturl === null ? itemGroupUrl : new URL(itemGroupUrl).hostname + op.producturl,
  }))

  console.dir(data, { depth: null })

  const products = data.options.map((v: any) => {
    let p = new Product(`${v.idx}-${v.productid}`, data.title, v.producturl)

    p.subTitle = data.subtitle
    p.metadata = {}
    p.images = v.images
    p.videos = []
    p.description = v.description
    p.currency = data.currency
    p.sku = v.sku
    p.brand = v.brand
    p.size = v.sizePrimary + (v.sizeSecondary ? ` - ${v.sizeSecondary}` : '')
    p.realPrice = v.offerPrice
    p.higherPrice = v.listPrice
    p.availability = v.inventoryStatus === 'Available'
    p.itemGroupId = itemGroupId
    p.color = v.swatch
    p.colorFamily = v.swatchColorFamily
    p.bullets = v.bullets
    p.keyValuePairs = v.keyValuePairs
    p.sizeChartUrls = v.sizeChartUrls

    return p
  })

  const screenshot = await screenPage(page)

  // cookies & cache
  const client = await page.target().createCDPSession()
  await client.send('Network.clearBrowserCookies')
  await client.send('Network.clearBrowserCache')

  return {
    screenshot,
    products,
  }
}

export default scraper
