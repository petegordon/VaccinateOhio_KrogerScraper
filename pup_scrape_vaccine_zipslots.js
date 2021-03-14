require('dotenv').config();

const fs = require('fs')
const simpleGit = require('simple-git');
const git = simpleGit();
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
startTime = new Date()
awsUploadTime = startTime
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

    let currentTime = new Date()
    if(currentTime.getTime() > (awsUploadTime.getTime()+(1000*60*30))){
        reformatZipCodeDataIntoLocationAvailability(storesDir)
        awsUploadTime = currentTime
    }

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


/** Function Calls */

function reformatZipCodeDataIntoLocationAvailability(dir, awsUpload = true){

    let zipFiles = fs.readdirSync(dir)
    zipFiles = zipFiles.filter((z) => z.endsWith('.json'))

    let storeAvailability = []

    let locationsAlreadyProcessed = {}

    for(let h=0; h<zipFiles.length; h++){
        let zip = zipFiles[h]
        let zip_unixtime = parseInt(zipFiles[h].split('_')[1])

        
        let stores = JSON.parse(fs.readFileSync(zipDir+zip))
        let start_date = null
        let end_date = null

        for(let i=0; i<stores.length; i++){

            let start_date = null
            let end_date = null

            let s = stores[i]
            let foundAlreadyIndex = -1

            if(Object.keys(locationsAlreadyProcessed).includes(s.loc_no)){
                if(locationsAlreadyProcessed[s.loc_no] > zip_unixtime){
                    continue
                } else {
                    for(let m=0; i<storeAvailability.length; m++){
                        if(storeAvailability[m].original_data.loc_no == s.loc_no){
                            foundAlreadyIndex = m
                            break;
                        }
                    }
                }
            }


            let storeDataFormat = {
                            //location_id: 123, // from https://app.vaccinateoh.org/api/locations
                            address: s.facilityDetails.address.address1+', '+s.facilityDetails.address.city+', '+s.facilityDetails.address.state+' '+s.facilityDetails.address.zipCode,
                            start_date: null,
                            end_date: null,
                            clear_existing: true, // true if we should delete all previous availability within this range
                            availability: []
                        }

            for(let j=0; j<s.dates.length; j++){        
                let date = s.dates[j].date
                if(end_date == null || new Date(date) > new Date(end_date)){
                    end_date = new Date(date)
                }
                if(start_date == null || new Date(date) < new Date(start_date)){
                    start_date = new Date(date)
                }        
                let slots = s.dates[j].slots
                let store_availability = []
                for(let k=0; k<slots.length; k++){

                    let slot = slots[k]
                    let available = {
                        availability_time: date+' '+slot.start_time,
                        brand: getBrandCode(slot.ar_reason)
                    }
                    store_availability.push(available)
                }

                if(store_availability.length > 0){
                    storeDataFormat.availability = store_availability                
                }

            }

            storeDataFormat.start_date = start_date
            storeDataFormat.end_date = end_date
            storeDataFormat.original_data = s
            storeDataFormat.original_data_unix_time = zip_unixtime
            storeDataFormat.origina_data_time = new Date().toISOString()

            if(foundAlreadyIndex >= 0){
                storeAvailability[foundAlreadyIndex] = storeDataFormat
            } else {
                storeAvailability.push(storeDataFormat)
            }

            locationsAlreadyProcessed[s.loc_no] = zip_unixtime
            
        }

        

    }

    let current_time = new Date().getTime();
    let filename = 'kroger_availability_'+current_time+'.json'
    fs.writeFileSync(filename, JSON.stringify(storeAvailability))


    if(awsUpload){
        console.log('do aws upload...')
        // snippet-start:[s3.JavaScript.buckets.upload]
        // Load the AWS SDK for Node.js
        var AWS = require('aws-sdk');
        // Set the region 
        AWS.config.update({region: process.env.AWS_REGION});
        // Create S3 service object
        s3 = new AWS.S3({apiVersion: '2006-03-01'});
        // call S3 to retrieve upload file to specified bucket
        var uploadParams = {Bucket: process.env.AWS_S3_BUCKET, Key: '', Body: ''};
        var file = filename;

        // Configure the file stream and obtain the upload parameters
        var fileStream = fs.createReadStream(file);
        fileStream.on('error', function(err) {
        console.log('File Error', err);
        });
        uploadParams.Body = fileStream;
        var path = require('path');
        uploadParams.Key = path.basename(file);

        // call S3 to retrieve upload file to specified bucket
        s3.upload (uploadParams, function (err, data) {
        if (err) {
            console.log("Error", err);
        } if (data) {
            console.log("Upload Success", data.Location);
        }
        });
    }



}

function getBrandCode(str){
    if(str.toLowerCase().indexOf('moderna') >= 0){
        return 'm'        
    } else if (str.toLowerCase().indexOf('pfizer') >= 0){
        return 'p'        
    } else if (str.toLowerCase().indexOf('john') >= 0){
        return 'j'        
    } else {
        return ''
    }

}