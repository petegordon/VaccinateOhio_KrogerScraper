

/*

https://www.riteaid.com/covid-vaccine-apt
    DOB, City, State, Zip, Child Care Worker
Continue
         https://www.riteaid.com/pharmacy/apt-scheduler
     43081
Find Stores
     https://www.riteaid.com/services/ext/v2/stores/getStores?address=355%20East%20Main%20Street%20Lexington%20OH%2044904&attrFilter=PREF-112&fetchMechanismVersion=2&radius=50
Select Store
Next
https://www.riteaid.com/services/ext/v2/vaccine/checkSlots?storeNumber=2394
|
|- Apologies, due to high demand, there are currently no appointment times available
|- "Make an Appointment at Rite Aid" and "What day and time work for you?"
https://www.riteaid.com/content/riteaid-web/en.ragetavailableappointmentslots.json?storeNumber=2394&moment=1616207458547&captchatoken=03AGdBq26Qk58p30LKVpguNcpJT7ZwJFmd71291pt5wBozo0QhhRNIVZrlbpPDPysVb-90Ixvg6UHI4DddcndlXnYsVNMbd2bAxM0Ji8Ol5GWkHzvqpTQxjRec6Q0GdV4MmWCQLwoomQ0sQNrVvzcxGTkNzOcam3W3DkhfXD1vDcjPgpIjbiE9qjEBSBJHrzSAYqrBF8VjWgvR4R-AnQMEY-ecmLVhQqRFQUBMFmZYPdyXT92mrC19wb6wLYTHI7Kt-bWvS-dwA-NCXQNpSJjBSeqJZURf18t5xbdKrJ9ueQLAwv8B1lwvqFaz23aGOtZvq9CYrl2I59VBPJx1eojSFDL6Mr5k3uJogL4mnNJsPnTNYnkwOwJDVVsBlYvnDqFGLGKBmk0KwvG-TecBstN6B4ocCuqJ3kreiUqKrtcpUaQ3nvwJhz-x26opPlpa8lqsElgNNgx67ppxGliC3Kx9KnabQg-2G9tKEQ


*/

require('dotenv').config();

let exceptionAttempts = 0;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const fs = require('fs')
const simpleGit = require('simple-git');
const git = simpleGit();
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
startTime = new Date()
awsUploadTime = startTime
zipStartTime = new Date()
storesDir = "ZipLocationsVaccines_RiteAid/"
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

    zipParam = JSON.parse(fs.readFileSync('riteaid_zipcodes.json'))
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
    await page.goto('https://www.riteaid.com/covid-vaccine-apt',{waitUntil: 'networkidle0'});

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
            await page.goto("https://www.kroger.com/rx/api/anonymous/scheduler/slots/locationsearch/pharmacy/"+zip+"/"+dateStart+"/"+dateEnd+"/50?appointmentReason=122&appointmentReason=125&appointmentReason=129",{waitUntil: 'networkidle0'});
            
                    
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

    //enter DOB, 
    await page.waitForSelector('#dateOfBirth')
    let dob = await page.$('#dateOfBirth')
    await delay(1000)
    await dob.click()
    await dob.type('10/29/1955')

    //enter City, 
    let city = await page.$('#city')
    await delay(1000)
    await city.click()
    await city.type('Columbus')

    //enter State, 
    await delay(3000)
   // await page.$('.page').click()
    //await delay(1000)
    //await page.$('.page').click()
    await page.focus('.covid-eligibilty__check')

    //await page.keyboard.press('ArrowDown');
    //await page.keyboard.press('ArrowDown');
    //await page.keyboard.press('ArrowDown');
    //await page.keyboard.press('ArrowDown');
    //await delay(3000)
    //await page.$eval('#eligibility_state', (el) => el.scrollIntoView())
    //await delay(3000)
    //await page.hover('#eligibility_state')
    //await delay(3000)
/*    
    await page.evaluate(() => {
        document.querySelector('#eligibility_state').click();
      }); 
*/      
    //await delay(1000)   
    //let state = await page.$('#eligibility_state')
//    await delay(1000)
//    await page.hover('#eligibility_state')    
//if (await page.$('#eligibility_state') !== null) console.log('found');
//else console.log('not found');
let selector = '#eligibility_state'
const input = await page.$(selector);
await page.$eval('#eligibility_state', (el) => {
    const yOffset = -200; 
    const element = el
    const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
    window.scrollTo({top: y, behavior: 'smooth'});
})
await delay(1000)
await input.click({ clickCount: 3 })
await page.type(selector, "Ohio")

/*
    await delay(1000)
    await page.click('#eligibility_state')
    await delay(1000)
    await page.type('#eligibility_state', 'Ohio')    
*/
    //eneter Zip, 
    //eneter Child Care Worker
    let occ = await page.$('#Occupation')
    await page.$eval('#Occupation', (el) => {
        const yOffset = -200; 
        const element = el
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
        window.scrollTo({top: y, behavior: 'smooth'});
    })     
    await delay(1000)
    await occ.click('#Occupation')
    //await occ.type('Childcare Worker')     
    
    //click on ChildCare Worker Occupation
    await page.evaluate( () => {
        document.querySelectorAll('.typeahead__list')[1].querySelectorAll('li')[0].click()
    })

    
    let medical_conditions = await page.$('#mediconditions')
    await page.$eval('#mediconditions', (el) => {
        const yOffset = -200; 
        const element = el
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
        window.scrollTo({top: y, behavior: 'smooth'});
    })     
    await delay(1000)
    await medical_conditions.click('#mediconditions')
    //await medical_conditions.type("None of the Above")      
    await page.evaluate( () => {
        document.querySelectorAll('.typeahead__list')[2].querySelectorAll('li')[28].click()
    })    

    //click Continue
    await delay(1000)
    let continueButton = await page.$('#continue')
    await page.$eval('#continue', (el) => {
        const yOffset = -200; 
        const element = el
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
        window.scrollTo({top: y, behavior: 'smooth'});
    })    
    

//TODO::GOT PROMPTED NOW NEED TO CLICK OK... AND MOVE TO NEXT STEP.
    continueButton.click()
    await delay(2000)
    let modalDialog = page.$('#error-modal .form-btns--continue')
    await page.$eval('#error-modal .form-btns--continue', (el) => {
        const yOffset = -200; 
        const element = el
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
        window.scrollTo({top: y, behavior: 'smooth'});
    })      
 //   modalDialog.click()

    await page.evaluate( () => {
        console.log('before click')        
        el = document.querySelector('#error-modal .form-btns--continue')
        console.log(el)
        el.click()        
        console.log('after click')
    })    

    //await page.goto('https://www.riteaid.com/pharmacy/apt-scheduler')    
    //let modalClick = await page.$('#error-modal .form-btns--continue')

    //await modalClick.click()

    await delay(5000)

  //       https://www.riteaid.com/pharmacy/apt-scheduler
    
    //select search and enter zip code
    let search = await page.$('#covid-store-search')
    await search.click()
    await search.type(zip) //Enter ZipCode 43081
    //click Find Stores
    let searchButton = await page.$('.covid-store__search__btn button')
    await page.$eval('.covid-store__search__btn button', (el) => {
        const yOffset = -200; 
        const element = el
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
        window.scrollTo({top: y, behavior: 'smooth'});
    }) 

    await page.evaluate( () => {
        console.log('before click find stores')        
        el = document.querySelector('.covid-store__search__btn button')
        console.log(el)
        el.click()        
        console.log('after click find stores')
    })   

    //searchButton.click()
  //  await page.click('#btn-find-store')

    await delay(3000)
    // https://www.riteaid.com/services/ext/v2/stores/getStores?address=355%20East%20Main%20Street%20Lexington%20OH%2044904&attrFilter=PREF-112&fetchMechanismVersion=2&radius=50
    // Loop through all stores
    // click Select Store
    // a[data-loc-id="3266"]

//Click Next
//.cmp-button__text.cmp-button__textappointment
//https://www.riteaid.com/services/ext/v2/vaccine/checkSlots?storeNumber=2394


//.covid-scheduler__validation-section
//"Apologies, due to high demand"

//|- Apologies, due to high demand, there are currently no appointment times available

//.covid-scheduler__heading

//|- "Make an Appointment at Rite Aid" and "What day and time work for you?"
//https://www.riteaid.com/content/riteaid-web/en.ragetavailableappointmentslots.json?storeNumber=2394&moment=1616207458547&captchatoken=03AGdBq26Qk58p30LKVpguNcpJT7ZwJFmd71291pt5wBozo0QhhRNIVZrlbpPDPysVb-90Ixvg6UHI4DddcndlXnYsVNMbd2bAxM0Ji8Ol5GWkHzvqpTQxjRec6Q0GdV4MmWCQLwoomQ0sQNrVvzcxGTkNzOcam3W3DkhfXD1vDcjPgpIjbiE9qjEBSBJHrzSAYqrBF8VjWgvR4R-AnQMEY-ecmLVhQqRFQUBMFmZYPdyXT92mrC19wb6wLYTHI7Kt-bWvS-dwA-NCXQNpSJjBSeqJZURf18t5xbdKrJ9ueQLAwv8B1lwvqFaz23aGOtZvq9CYrl2I59VBPJx1eojSFDL6Mr5k3uJogL4mnNJsPnTNYnkwOwJDVVsBlYvnDqFGLGKBmk0KwvG-TecBstN6B4ocCuqJ3kreiUqKrtcpUaQ3nvwJhz-x26opPlpa8lqsElgNNgx67ppxGliC3Kx9KnabQg-2G9tKEQ


console.log('completed find stores')



})
let browser;

(async () => {
    console.log('zip codes:'+JSON.stringify(zipParam))
    
    browser = await puppeteer.launch({headless:false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});

    // add this handler before emitting any events
    /*
    process.on('uncaughtException', async function (err) {
        console.log('UNCAUGHT EXCEPTION - keeping process alive:', err); // err.message is "foobar"
        if(exceptionAttempts == 0){
            console.log('delay for a minute... and then try again... ')
            await delay(60000)
            myEmitter.emit('processZipCodes');    
        } else {
            console.log("Hit an exception twice!!! And, sending an SMS....")
            sendSMS("Hit an Excpetion Twice!!!!")
        }
        exceptionAttempts++
    });
    */

    myEmitter.emit('processZipCodes');

})();