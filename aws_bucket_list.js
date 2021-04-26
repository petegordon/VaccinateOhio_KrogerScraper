require('dotenv').config()
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: process.env.AWS_REGION});

// Create S3 service object
s3 = new AWS.S3({apiVersion: '2006-03-01'});

// Create the parameters for calling listObjects
var bucketParams = {
  Bucket : process.env.AWS_S3_BUCKET
};

// Call S3 to obtain a list of the objects in the bucket
s3.listObjects(bucketParams, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data);
    //let result = data.Contents.filter((c)=> {return ((new Date() - c.LastModified) < 1000*60*15) })
    //vaccinespotter_availability
    let result = data.Contents.filter((c) => {return (c.LastModified.indexOf('2021-04-23') > 0 && c.Key.indexOf('vaccinespotter') >= 0)})
    console.log(result)
  }

  

});