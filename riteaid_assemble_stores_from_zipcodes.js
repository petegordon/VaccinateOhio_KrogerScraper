
const fs = require('fs')

const storesDir = 'ZipLocations_RiteAid/'
//read ZipLOcations_RiteAid directory files
let files = fs.readdirSync(storesDir)
let stores = {}
files.forEach((f) => {
    let file = fs.readFileSync(storesDir+f)
    let zipResults = JSON.parse(file)
    zipResults.Data.stores.forEach((s) => {
        stores[s.storeNumber] = s
    })
})

console.log(Object.values(stores).length)

fs.writeFileSync('riteaid_stores.json', JSON.stringify(stores))



