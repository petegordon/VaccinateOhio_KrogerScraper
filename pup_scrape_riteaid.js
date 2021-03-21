require('dotenv').config();

let exceptionAttempts = 0;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const fs = require('fs')
const querystring = require('querystring')

const simpleGit = require('simple-git');
const git = simpleGit();
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
startTime = new Date()
awsUploadTime = startTime
storeStartTime = new Date()

storesVaccineDir = "ZipLocationsVaccines_RiteAid/"

storesToProcess = []

console.log("APPLICATION START:"+startTime)

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }


const EventEmitter = require('events');
class ScrapeEmitter extends EventEmitter {}

const myEmitter = new ScrapeEmitter();
myEmitter.on('processStores', async () => {
    console.log('a processStores event occurred!');

    storesObjectKeys = JSON.parse(fs.readFileSync('riteaid_stores.json'))
    storesToProcess = Object.keys(storesObjectKeys)
    //zipParam = zipParam.slice(0,10)
    let filesStoresProcessed = fs.readdirSync(storesVaccineDir)
    filesStoresProcessed = filesStoresProcessed.filter((s) => s.endsWith('.json'))
    console.log("stores processed:"+filesStoresProcessed.length)

    let storesProcessed = filesStoresProcessed.map((z) => {
        storeNumber = z.split('_')[5].split('.')[0]
        return storeNumber        
    })
    console.log(storesProcessed)
    storesToReprocess = filesStoresProcessed.filter((f) => {         
        time = parseInt(f.split('_')[4])
        return (time <= (new Date().getTime() - (1000 * 60 * 60 * 3)))
    })   
    
    storesToReprocess = storesToReprocess.map((f) => {
        storeNumber = f.split('_')[5].split('.')[0]
        return storeNumber
    })
    console.log("stores to reprocess")
    console.log(storesToReprocess)

    storesToProcess = storesToProcess.filter((z) => !storesProcessed.includes(z))
    console.log("stores to process first time")
    console.log(storesToProcess)

    storesToProcess.push(...storesToReprocess)
    console.log("Zip Codes Available to Process:"+storesToProcess.length)
    console.log(storesToProcess)


    let page = await browser.newPage();
    await page.goto('https://www.riteaid.com/covid-vaccine-apt',{waitUntil: 'networkidle0'});

    if(storesToProcess.length > 0){

        console.log("PROCESS STORES:::")
        console.log("Current Working Directory...")
        console.log(process.cwd())
        
        

        storeNumberToProcess = storesToProcess[0]        
        store = storesObjectKeys[storeNumberToProcess]
        myEmitter.emit("searchStoreAvailability", store, page)                  

    } else {
        console.log("START:"+startTime)
        console.log("END:"+new Date())  
        console.log("Nothing to process, will try again in 10 minutes...")  
        await delay(1000 * 60 * 10) //wait 10 minutes and try again
        myEmitter.emit('processStores');          
    }

})
myEmitter.on('searchStoreAvailability', async (store, page) => {
    storeStartTime = new Date()
    storesToProcess = storesToProcess.slice(1)
    //    console.log(store)
    let storeNumber = store.storeNumber
    console.log(storeNumber)
    let zip = store.zipcode
    console.log(zip)


    await page.on('response', async (response) => { 
        
        if (response.url().startsWith('https://www.riteaid.com/services/ext/v2/vaccine/checkSlots?storeNumber=') && response.status() == 200){
            console.log(response.url())            
            console.log(response.status())      
            json = await response.json()

            let qsResult = querystring.parse(response.url().split('?')[1])
            let storeNumber = qsResult.storeNumber
            console.log('check slot! '+storeNumber);

            //Delete existing files
            let allFiles = fs.readdirSync(storesVaccineDir)
            let existingFiles = allFiles.filter((f) => { return (f.startsWith('riteaid_store_slots_summary_') && f.endsWith(storeNumber+'.json')) })
            console.log(existingFiles)
            for(let j=0; j<existingFiles.length; j++){
                console.log('delete '+ existingFiles[j])
                fs.unlinkSync(storesVaccineDir+existingFiles[j])
            }

          //  fs.writeFileSync(storesVaccineDir+'riteaid_store_slots_summary_'+new Date().getTime()+'_'+storeNumber+'.json', JSON.stringify(json, null, 2))



        }

        if (response.url().startsWith('https://www.riteaid.com/content/riteaid-web/en.ragetavailableappointmentslots.json?storeNumber=') && response.status() == 200){
            console.log(response.url())
            console.log(response.status())      
            json = await response.json()

            let qsResult = querystring.parse(response.url().split('?')[1])
            let storeNumber = qsResult.storeNumber
            console.log('check availability! '+storeNumber);            

            //Delete existing files
            let allFiles = fs.readdirSync(storesVaccineDir)
            let existingFiles = allFiles.filter((f) => { return (f.startsWith('riteaid_store_slots_availability_') && f.endsWith(storeNumber+'.json')) })
            console.log(existingFiles)
            for(let j=0; j<existingFiles.length; j++){
                console.log('delete '+ existingFiles[j])
                fs.unlinkSync(storesVaccineDir+existingFiles[j])
            }

            fs.writeFileSync(storesVaccineDir+'riteaid_store_slots_availability_'+new Date().getTime()+'_'+storeNumber+'.json', JSON.stringify(json, null, 2))

            try{
                console.log("Git pull...")
                await git.pull()
                console.log("Git pull...FINISHED")            
                /* Make change to git and push */
                console.log('Git add, commit, push...')
                await git.add('.')
                await git.commit('Sent Availability for Store:'+storeNumber)
                await git.push()
                console.log('Git add, commit, push...FINISHED')                            
            } catch (ex) {
                console.log("Try again... wait 1000")
                await delay(1000)
                console.log("Git pull...")
                await git.pull()
                console.log("Git pull...FINISHED")            
                /* Make change to git and push */
                console.log('Git add, commit, push...')
                await git.add('.')
                await git.commit('Sent Availability for Store:'+storeNumber)
                await git.push()
                console.log('Git add, commit, push...FINISHED')                            
            }                      

        }
       
        if (response.url().startsWith('https://www.riteaid.com/services/ext/v2/stores/getStores') && response.status() == 200){
            console.log(response.url())
            console.log(response.status())      
            json = await response.json()

            console.log('an searchStoreAvailability event occurred!'+zip);

            //Delete existing files
            let allFiles = fs.readdirSync(storesVaccineDir)
            let existingFiles = allFiles.filter((f) => { return (f.startsWith('riteaid_stores_') && f.endsWith(zip+'.json')) })
            console.log(existingFiles)
            for(let j=0; j<existingFiles.length; j++){
                console.log('delete '+ existingFiles[j])
                fs.unlinkSync(storesDir+existingFiles[j])
            }

//            fs.writeFileSync(storesDir+'riteaid_stores_'+zip+'.json', JSON.stringify(json, null, 2))

            
//              let storeNumber = json.Data.stores[0].storeNumber


                console.log('try to select storeNumber:'+storeNumber)
                let selectorStore = '.covid-store__store__anchor[data-loc-id="'+storeNumber+'"]'

                await page.waitForSelector(selectorStore)
                let selectStoreButton = await page.$(selectorStore)

                await page.$eval(selectorStore, (el) => {
                    const yOffset = -200; 
                    const element = el
                    const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
                    window.scrollTo({top: y, behavior: 'smooth'});
                })    
                console.log('before select click')
                //await page.click(selectorStore)
                await selectStoreButton.evaluate((e) => e.click());
                //await selectStoreButton.click()   
                console.log('after click select')             
                console.log('select continue button')
                let continueButton = await page.$('#continue')
                console.log('before scroll')            
                await page.$eval('#continue', (el) => {
                    const yOffset = -200; 
                    const element = el
                    const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
                    window.scrollTo({top: y, behavior: 'smooth'});
                })    
                console.log('after scroll') 

                //DELETE Existing Availability for Store Number and replace with empty slots
                let empty_slots = {
                    "Data": {
                      "slots": {
                        "1": [],
                        "2": []
                      }
                    },
                    "Status": "SUCCESS",
                    "ErrCde": null,
                    "ErrMsg": null,
                    "ErrMsgDtl": null
                }
                //Delete existing files
                let allFilesCheckEmpty = fs.readdirSync(storesVaccineDir)
                let existingFilesCheckEmpty = allFilesCheckEmpty.filter((f) => { return (f.startsWith('riteaid_store_slots_availability_') && f.endsWith(storeNumber+'.json')) })
                for(let j=0; j<existingFilesCheckEmpty.length; j++){
                    console.log('delete '+ existingFilesCheckEmpty[j])
                    fs.unlinkSync(storesVaccineDir+existingFilesCheckEmpty[j])
                }

                fs.writeFileSync(storesVaccineDir+'riteaid_store_slots_availability_'+new Date().getTime()+'_'+storeNumber+'.json', JSON.stringify(empty_slots, null, 2))

                try{
                    console.log("Git pull...")
                    await git.pull()
                    console.log("Git pull...FINISHED")            
                    /* Make change to git and push */
                    console.log('Git add, commit, push...')
                    await git.add('.')
                    await git.commit('Sent Empty Availability for Store:'+storeNumber)
                    await git.push()
                    console.log('Git add, commit, push...FINISHED')                            
                } catch (ex) {
                    console.log("Try again... wait 1000")
                    await delay(1000)
                    console.log("Git pull...")
                    await git.pull()
                    console.log("Git pull...FINISHED")            
                    /* Make change to git and push */
                    console.log('Git add, commit, push...')
                    await git.add('.')
                    await git.commit('Sent Empty Availability for Store:'+storeNumber)
                    await git.push()
                    console.log('Git add, commit, push...FINISHED')                            
                }


                delay(2000)               
                await continueButton.evaluate((e) => e.click());
                console.log('after click continue')                


            
              await delay(3000)  
              await page.close()    

              let currentTime = new Date()
              if(currentTime.getTime() > (awsUploadTime.getTime()+(1000*60*10))){
                  await reformatStoreDataIntoLocationAvailability(storesVaccineDir)
                  awsUploadTime = currentTime
              }
              
              
              myEmitter.emit('processStores');  
        }


        if (response.url().startsWith('https://www.riteaid.com/services/ext/v2/stores/getStores') && response.status() != 200){
            console.log(response.url())
            console.log(response.status())             
            console.log("NOT 200 ERROR START:"+startTime)
            console.log("NOT 200 ERROR END:"+new Date())      
            console.log("will try again in 5 minutes....")
            await delay(300000)
            await page.close()
            myEmitter.emit('processStores');     
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

    await delay(3000)
   
    await page.focus('.covid-eligibilty__check')

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
    

    continueButton.click()
    await delay(2000)
    let modalDialog = page.$('#error-modal .form-btns--continue')
    await page.$eval('#error-modal .form-btns--continue', (el) => {
        const yOffset = -200; 
        const element = el
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;    
        window.scrollTo({top: y, behavior: 'smooth'});
    })      

    await page.evaluate( () => {
        console.log('before click')        
        el = document.querySelector('#error-modal .form-btns--continue')
        console.log(el)
        el.click()        
        console.log('after click')
    })    

    await delay(2000)
  
    //select search and enter zip code
    let search = await page.$('#covid-store-search')
    await delay(2000)
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


})
let browser;

(async () => {
    console.log('zip codes:'+JSON.stringify(storesToProcess))
    
    browser = await puppeteer.launch({headless:false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});

    // add this handler before emitting any events
    
    
    process.on('uncaughtException', async function (err) {
        console.log('UNCAUGHT EXCEPTION - keeping process alive:', err); // err.message is "foobar"
        if(exceptionAttempts == 0){
            console.log('delay for a minute... and then try again... ')
            await delay(60000)
            myEmitter.emit('processStores');    
        } else {
            console.log("Hit an exception twice!!! And, sending an SMS....")
            sendSMS("Hit an Excpetion Twice!!!!")
        }
        exceptionAttempts++
    });
    
    

    myEmitter.emit('processStores');
//TESTING    reformatStoreDataIntoLocationAvailability(storesVaccineDir, false)


})();

/** Function Calls */
function sendSMS(message){
    client.messages
        .create({
            body: message,
            from: '+17629997107',
            to: '+16148357383'
        })
        .then(message => console.log(message.sid));
}
async function reformatStoreDataIntoLocationAvailability(dir, awsUpload = true){

    let storesObjectKeys = JSON.parse(fs.readFileSync('riteaid_stores.json'))

    let storeFiles = fs.readdirSync(dir)
    storeFiles = storeFiles.filter((z) => z.endsWith('.json'))

    let storesAllAvailability = []

    for(let h=0; h<storeFiles.length; h++){
        let storeAvailabilityFile = storeFiles[h]
        let store_unixtime = parseInt(storeFiles[h].split('_')[4])
        let storeNumber = parseInt(storeFiles[h].split('_')[5].split('.')[0])

        
        let storeAvailability = JSON.parse(fs.readFileSync(dir+storeAvailabilityFile))

        let s = storesObjectKeys[storeNumber]

        let start_date = null
        let end_date = null

        s.availability = storeAvailability
        s.availability_update_time = new Date().getTime()


        let storeDataFormat = {
                        //location_id: 123, // from https://app.vaccinateoh.org/api/locations
                        address: s.address+', '+s.city+', '+s.state+' '+s.zipcode,
                        start_date: new Date(),
                        end_date: new Date(),
                        clear_existing: true, // true if we should delete all previous availability within this range
                        availability: []
                    }

        dates = s.availability.Data.slots["1"]
        let store_availability = []

        for(let j=0; j<dates.length; j++){        
            let date = dates[j]
            if(end_date == null || new Date(date) > new Date(end_date)){
                end_date = new Date(date)
            }
            if(start_date == null || new Date(date) < new Date(start_date)){
                start_date = new Date(date)
            }        

            let datetime = new Date(date)
            let dateString = datetime.getFullYear()+"-"+String(datetime.getMonth()+1).padStart(2, '0')+"-"+String(datetime.getDate()).padStart(2, '0')
            let timeString = String(datetime.getHours()).padStart(2, '0')+":"+String(datetime.getMinutes()).padStart(2, '0')+":"+String(datetime.getSeconds()).padStart(2, '0')

            let available = {
                availability_time: dateString+' '+timeString
            }
            store_availability.push(available)      

        }
            
        storeDataFormat.availability = store_availability                
            
        storeDataFormat.start_date = start_date
        storeDataFormat.end_date = end_date
        storeDataFormat.original_data = s
        storeDataFormat.original_data_unix_time = store_unixtime
        storeDataFormat.origina_data_time = new Date(store_unixtime).toISOString()              

        storesAllAvailability.push(storeDataFormat)

        
    }


    /* Delete previous availability files */
    let files = fs.readdirSync(process.cwd())
    files = files.filter((f) => { return (f.indexOf('riteaid_availability_') > -1 ) })
    files.forEach((f) => fs.unlinkSync(f))

    /* Create/Write new availability file */
    let current_time = new Date().getTime();
    let filename = 'riteaid_availability_'+current_time+'.json'
    fs.writeFileSync(filename, JSON.stringify(storesAllAvailability))


    try{
        console.log("Git pull...")
        await git.pull()
        console.log("Git pull...FINISHED")            
        /* Make change to git and push */
        console.log('Git add, commit, push...')
        await git.add('.')
        await git.commit('Sent Full Availablity for S3 for Store:')
        await git.push()
        console.log('Git add, commit, push...FINISHED')                            
    } catch (ex) {
        console.log("Try again... wait 1000")
        await delay(1000)
        console.log("Git pull...")
        await git.pull()
        console.log("Git pull...FINISHED")            
        /* Make change to git and push */
        console.log('Git add, commit, push...')
        await git.add('.')
        await git.commit('Sent Full Availablity for S3 for Store:')
        await git.push()
        console.log('Git add, commit, push...FINISHED')                            
    }         

    /* Upload availability file to AWS S3 BUCKET */
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