let fs = require('fs')

zipDir = "ZipLocationsVaccines/"
let zipFiles = fs.readdirSync(zipDir)
zipFiles = zipFiles.filter((z) => z.endsWith('.json'))

let storeAvailability = []

for(let h=0; h<zipFiles.length; h++){
    let zip = zipFiles[h]

    let stores = JSON.parse(fs.readFileSync(zipDir+zip))
    let start_date = null
    let end_date = null

    for(let i=0; i<stores.length; i++){

        let start_date = null
        let end_date = null

        let s = stores[i]

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

        storeAvailability.push(storeDataFormat)
    }

}
fs.writeFileSync('kroger_dups_availability_'+new Date().getTime()+'.json', JSON.stringify(storeAvailability))


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



