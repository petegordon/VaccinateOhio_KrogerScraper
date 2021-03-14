let fs = require('fs')

zipDir = "ZipLocationsVaccines/"
let zipFiles = fs.readdirSync(zipDir)
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
fs.writeFileSync('kroger_availability_'+new Date().getTime()+'.json', JSON.stringify(storeAvailability))


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



