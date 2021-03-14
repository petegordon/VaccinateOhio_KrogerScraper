//const puppeteer = require('puppeteer');
const fs = require('fs')
const readline = require('readline');

function sendSMS(message){
    let accountSid = "<TWILIO SID>" //process.env.TWILIO_ACCOUNT_SID;
    let authToken = "<TWILIO AUTH_TOKEN>"  //process.env.TWILIO_AUTH_TOKEN;
    let client = require('twilio')(accountSid, authToken);
    
    client.messages
      .create({
         body: message,     
         from: '+<FROM PHONE>',
         to: '+<TO PHONE>'
       })
      .then(message => console.log(message.sid));
}




const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
startTime = new Date()
zipStartTime = new Date()
storesDir = "ZipLocationsVaccines/"

console.log("START:"+startTime)

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

let manualProcessing = false

if(process.argv[2]){
    zipParam = process.argv[2];
    if(zipParam.startsWith('[')){
        zipParam = JSON.parse(zipParam)
    }else{
        if(zipParam=="manual"){
            manualProcessing = true
        }
        throw new Error("Must pass in zipcodes as JSON Array as string")
    }
} else {
    console.log(process.cwd())
    //zipParam = JSON.parse(fs.readFileSync('ohio_zips.json'))
    //zipParam = JSON.parse(fs.readFileSync('kroger_zipcodes.json'))
    zipParam = JSON.parse(fs.readFileSync('kroger_zipcodes.json'))
    //zipParam = zipParam.slice(0,10)
    let storesProcessed = fs.readdirSync(storesDir)
    storesProcessed = storesProcessed.filter((s) => s.endsWith('.json'))
    zipProcessed = storesProcessed.map((f) => { 
        console.log(f)
        zipcode = f.split('_')[2].split('.')[0]
        time = parseInt(f.split('_')[1])
        if (time > (new Date().getTime() - (1000 * 60 * 60 * 8))){
            return zipcode
        }
    })

    zipParam = zipParam.filter((z) => !zipProcessed.includes(z))

    console.log("create vaccine location length:"+zipParam.length)
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
/*    
    zipProcessed = storesProcessed.filter((f) => {         
        time = parseInt(f.split('_')[1])
        return (time > (new Date().getTime() - (1000 * 60 * 60 * 8)))
    })
*/    
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

    if(!browser)
        browser = await puppeteer.launch({headless:false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    
    let page = await browser.newPage();
    await page.goto('https://www.kroger.com/rx/guest/get-vaccinated');



    if(zipParam.length > 0){
        zipToProcess = zipParam[0]
        facilityToProcess = null
        //zipParam = zipParam.slice(1)
        if(manualProcessing){
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });        
            rl.question(`Continue with facility: ${facilityToProcess} and ${zipToProcess}? `, (fac) => { 
                myEmitter.emit("searchStores", fac, page)
            })
            rl.write(zipToProcess);
        } else {
             myEmitter.emit("searchStores", zipToProcess, page)          
        }

        
    } else {
        console.log("START:"+startTime)
        console.log("END:"+new Date())        
    }
})
myEmitter.on('searchStores', async (zip, page) => {
    zipStartTime = new Date()
  // let facilityObj = zipParam.filter((s) => {return s.facilityId == fac })
   zipParam = zipParam.slice(1)

   console.log(zip)
//    let zip = facilityObj[0].address.zipCode


    await page.on('response', async (response) => { 

        if (response.url().endsWith(zip) && response.status() == 200){
            console.log(response.url())
            console.log(response.status())      
            json = await response.json()
            //await delay(2000)            
           // myEmitter.emit('foundStores', fac.facilityId, json, page);       
            processedCount++    
            processing = false

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
            console.log("START:"+startTime)
            console.log("END:"+new Date())      
            //process.exit()
            /*
            const rl2 = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });        
            rl2.question(`Continue by starting over? `, () => { 
                myEmitter.emit('processZipCodes', page);
            })  
            */  
           await delay(300000)

           await delay(2000)        
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

//            sendSMS("Need to do CAPTCHA security check")
 
/*
            const rl2 = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });        
            rl2.question(`Continue after doing CAPTCHA?`, () => { 
                myEmitter.emit('processZipCodes', page);
            })  
  
*/

            await delay(900000)
            await page.goto('https://www.kroger.com/')

            await delay(2000)
            await page.close()
            myEmitter.emit('processZipCodes');
        }
    }catch(ex){
        console.log(ex)        
        console.log('caught exception')

        //await page.goto('https://www.kroger.com/rx/guest/get-vaccinated');
        await delay(2000)        
        await page.close()
        myEmitter.emit('processZipCodes');
    }


});
myEmitter.on('foundStores', async (zip, stores, page) => {

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