
const fs = require('fs')
const readline = require('readline');

const simpleGit = require('simple-git');
const git = simpleGit();


const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
startTime = new Date()
zipStartTime = new Date()
storesDir = "ZipLocationsVaccines/"
zipParam = []

console.log("APPLICATION START:"+startTime)

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }


const EventEmitter = require('events');
class ScrapeEmitter extends EventEmitter {}

const myEmitter = new ScrapeEmitter();
myEmitter.on('processZipCodes', async () => {
    console.log('a processZipCodes event occurred!');

    zipParam = JSON.parse(fs.readFileSync('kroger_zipcodes.json'))
    //zipParam = zipParam.slice(0,10)
    let storesProcessed = fs.readdirSync(storesDir)
    storesProcessed = storesProcessed.filter((s) => s.endsWith('.json'))
    console.log(storesProcessed)

    zipProcessed = storesProcessed.map((z) => {
        zipcode = z.split('_')[2].split('.')[0]
        return zipcode        
    })
    console.log(zipProcessed)
    zipcodesToReprocess = storesProcessed.filter((f) => {         
        time = parseInt(f.split('_')[1])
        return (time <= (new Date().getTime() - (1000 * 60 * 60 * 8)))
    })   
    
    zipcodesToReprocess = zipcodesToReprocess.map((f) => {
        zipcode = f.split('_')[2].split('.')[0]
        return zipcode
    })
    console.log("zips to reprocess")
    console.log(zipcodesToReprocess)

    zipcodesToProcess = zipParam.filter((z) => !zipProcessed.includes(z))
    console.log("zip to process first time")
    console.log(zipcodesToProcess)

    zipcodesToProcess.push(...zipcodesToReprocess)
    console.log("Zip Codes Available to Process:"+zipcodesToProcess.length)
    console.log(zipcodesToProcess)

    zipParam = zipcodesToProcess

//    if(!browser)
//        browser = await puppeteer.launch({headless:false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    
    let page = await browser.newPage();
    await page.goto('https://www.kroger.com/rx/guest/get-vaccinated');

    if(zipParam.length > 0){
        zipToProcess = zipParam[0]
        myEmitter.emit("searchStores", zipToProcess, page)                  
    } else {
        console.log("START:"+startTime)
        console.log("END:"+new Date())  
        console.log("Nothing to process, will try again in 10 minutes...")  
        await delay(1000 * 60 * 10) //wait 10 minutes and try again
        myEmitter.emit('processZipCodes');          
    }
})
myEmitter.on('searchStores', async (zip, page) => {
    zipStartTime = new Date()
    zipParam = zipParam.slice(1)

    console.log(zip)

    await page.on('response', async (response) => { 

        if (response.url().endsWith(zip) && response.status() == 200){
            console.log(response.url())
            console.log(response.status())      
            json = await response.json()

            console.log('an searchStores event occurred!'+zip);
            let dt = new Date()            
            let dtEnd = new Date(dt.getTime()+(1000*60*60*24*14))
            let dateStart = dt.getFullYear()+'-'+String((dt.getMonth()+1)).padStart(2, '0')+'-'+String((dt.getDate())).padStart(2, '0')
            let dateEnd = dtEnd.getFullYear()+'-'+String((dtEnd.getMonth()+1)).padStart(2, '0')+'-'+String((dtEnd.getDate())).padStart(2, '0')
            await page.goto("https://www.kroger.com/rx/api/anonymous/scheduler/slots/locationsearch/pharmacy/"+zip+"/"+dateStart+"/"+dateEnd+"/50?appointmentReason=122&appointmentReason=125&appointmentReason=129");
            
                    
        }

        if (!response.url().endsWith(zip) && response.url().indexOf('rx-security-bff') < 0 && response.url().indexOf(zip) > 0 && response.status() == 200){
            console.log(response.url())
            console.log(response.status())      
            json = await response.json()
            await delay(2000)            
            myEmitter.emit('foundStores', zip, json, page);                   
        }

        if (!response.url().endsWith(zip) && response.url().indexOf(zip) > 0  && response.status() != 200){
            console.log(response.url())
            console.log(response.status())             
            console.log("NOT 200 ERROR START:"+startTime)
            console.log("NOT 200 ERROR END:"+new Date())      
            console.log("will try again in 5 minutes....")
            await delay(300000)
            await page.close()
            myEmitter.emit('processZipCodes');     
        }

    });  



    await page.goto('https://www.kroger.com/rx/guest/get-vaccinated');
    
    page.waitForSelector('.PharmacyLocator [name="findAStore"]')
    const input = await page.$('.PharmacyLocator [name="findAStore"]');
    await input.click({ clickCount: 3 })
    for(let c of zip+""){
        page.waitForTimeout(200)
        await page.type('.PharmacyLocator [name="findAStore"]', c)                
    }
    processing = true
    await delay(2000)
    page.click('.PharmacyLocator [aria-label="search"]')

    console.log('get stores for zip:'+zip) 
    await delay(4000) 
    try{
        
        let securityCheck = await page.evaluate(() => {
            let el = document.querySelector("#sec-overlay") 
            val = "none"
            if(el){
                val = window.getComputedStyle(el).getPropertyValue("display")   
            }   
            return val != "none"
        })
        console.log(securityCheck)   
        if(securityCheck){
            console.log("prompted with captcha security; will try again in 15 minutes.")
            await delay(900000)
            await page.goto('https://www.kroger.com/')
            await delay(2000)
            await page.close()
            myEmitter.emit('processZipCodes');
        }
    }catch(ex){
        console.log(ex)        
        console.log('caught exception')
        await delay(2000)        
        await page.close()
        myEmitter.emit('processZipCodes');
    }


});
myEmitter.on('foundStores', async (zip, stores, page) => {

    console.log("Current Working Directory...")
    console.log(process.cwd())
    console.log("Git pull...")
    await git.pull()
    console.log("Git pull...FINISHED")

    /* Delete older file(s) for this zip code */
    let files = fs.readdirSync(storesDir)
    files = files.filter((f) => f.indexOf('_'+zip+'.json') > 0)
    files.forEach((f) => {
        fs.unlinkSync(storesDir+f)
    })

    /* Write new file for this zip code */
    console.log('an foundStores event occurred! '+zip);
    fs.writeFileSync(storesDir+'slots_'+new Date().getTime()+'_'+zip+'.json', JSON.stringify(stores, null, 2))
    console.log("ZIP PROCESS START:"+zip+":"+zipStartTime)
    console.log("ZIP PROCESS END:"+zip+":"+new Date())  

    /* Make change to git and push */
    console.log('Git add, commit, push...')
    await git.add('.')
    await git.commit('Processed ZipCode:'+zip)
    await git.push()
    console.log('Git add, commit, push...FINISHED')

    await delay(120000)        
    await page.close()
    myEmitter.emit('processZipCodes');
});


let browser;

(async () => {
    console.log('zip codes:'+JSON.stringify(zipParam))
    
    browser = await puppeteer.launch({headless:true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    processing = false
    processedCount = 0

    myEmitter.emit('processZipCodes');

})();