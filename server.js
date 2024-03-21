const fs = require("fs")
const csvParser = require("csv-parser")
const axios = require("axios")
const cheerio = require("cheerio");
var express = require('express');
var app = express();
var http = require('follow-redirects').http;
var { Parser } = require('json2csv')
var request = require('request');
const { text } = require("stream/consumers");
var https = require('follow-redirects').https;
let port = process.env.PORT || 9000
var parsedData = [{ _0: 153887, _2: 'https://scoopcoupons.com/store/55peaks-coupons/', _3: "https://t.co/bpxm8PiWd6" }];
var filePath = "https://scoopcoupons.com/sam.csv";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


const ScrapClient = axios.create({
    maxBodyLength: Infinity,
    httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
});

app.get('/', async function (req, res) {
    await parseCSVFile(filePath, res,req)
})


app.listen(port);

async function parseCSVFile(filePath, res,req) {


    await axios.get(filePath, { responseType: 'stream' }).then(function (response) {
        let csvData = response.data
        //   console.log(csvData); // this is a stream now..

        csvData.pipe(csvParser({ headers: true }))
            .on('data', function (data) {
                   parsedData.push(data)

            })
            .on('end', function () {
                 //  console.log("param",req.query)
                 console.log('CSV data parsed');
                 if (!req.query.offset) {
                     res.status(200).send("Please give offset")
                     return false;
                 }
                 var offset = parseInt(req.query.offset)
                 console.log("offset",offset)
 
                 if (offset == 1) {
                     //   parsedData.splice(0, 2000)  
                     parsedData.splice(100, 173749)  // Change this to get more store
                 } else {
                     parsedData.splice(0, (offset - 1) * 100)
                     parsedData.splice(100, parsedData.length-1)  // Change this to get more store
                 }
                 console.log(parsedData.length)
                 test(res, offset);
                

            })
            .on('error', function () {
                console.log("Error parsing CSV data");
            })
    })

};

const isValidUrl = urlString => {
    try {
        return Boolean(new URL(urlString));
    }
    catch (e) {
        return false;
    }
}





function test(res,offset) {
    var promise = parsedData.map(async (item, index) => {
        var url = item._3;
        //   console.log(index)
        if (/(http(s?)):\/\//i.test(url)) {

            if (isValidUrl(decodeURIComponent(url))) {
                url = new URL(decodeURIComponent(url))
                var client = http;
                client = (url.protocol == "https:") ? https : client;
                //console.log(url.href)
                return await checkWebsite(url, client, item)


            }


        }


    })
    var fields_data = [];
    Promise.all(promise).then(function (values) {
      //  console.log(values);
        values.map((item1) => {
            if (item1) {
                if (item1.status && (item1.title || item1.desc)) {
                    fields_data.push({ store_id: item1.store._0, store_url: item1.store._2, store_aff_url: item1.store._3,site_url:item1.site_url ? item1.site_url:"",store_scrap_title: item1.title ? item1.title : "", store_scrap_desc: item1.desc ? item1.desc : "" })

                }
            }
        });
        let data = JSON.stringify({
            "offset": offset,
            "data": fields_data
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://scoopcoupons.com/wp-json/wp/v2/push-seo',
            headers: {
                'Content-Type': 'application/json'
            },
            data: data
        };

        axios.request(config)
            .then((response) => {
                res.status(200).send("File Uploaded- https://scoopcoupons.com/seos/store-"+offset+".csv")
            })
            .catch((error) => {
                res.status(200).send("Something went wrong.")

            });
    });
}


function checkWebsite(url, client, store) {

    return new Promise((resolve, reject) => {


        // let config = {
        //     method: 'get',
        //     maxBodyLength: Infinity,
        //     url: url.href,
        //     httpsAgent: new https.Agent({ keepAlive: true,rejectUnauthorized: false }),
        // };
       
        ScrapClient.get(url.href)
            .then((response) => {
                
                if (response.request.path == "/") {
                    var desc = "";
                    var title = "";
                    if (response.data) {
                        if (JSON.stringify(JSON.stringify(response.data)).includes("Sorry, this store is currently unavailable.") || JSON.stringify(JSON.stringify(response.data)).includes("This store does not exist.")) {
                            //  console.log(store)
                            resolve({ "status": false, "url": store });
                            return false;
                        }
                        const $ = cheerio.load(response.data);

                        desc = $("meta[name='description']").attr("content");
                        title = $('head > title').text();

                    }
                    resolve({ "status": true, "store": store, "desc": desc, "title": title,'site_url':response.request.res.responseUrl });
                } else {
                    var new_url = response.request.res.responseUrl.replace(response.request.path, "");
                    ScrapClient.get(new_url)
                        .then((response) => {
                            var desc = "";
                            var title = "";
                            if (response.data) {
                                if (JSON.stringify(JSON.stringify(response.data)).includes("Sorry, this store is currently unavailable.") || JSON.stringify(JSON.stringify(response.data)).includes("This store does not exist.")) {
                                    //  console.log(store)
                                    resolve({ "status": false, "url": store });
                                    return false;
                                }
                                const $ = cheerio.load(response.data);

                                desc = $("meta[name='description']").attr("content");
                                title = $('head > title').text();

                            }
                            resolve({ "status": true, "store": store, "desc": desc, "title": title,'site_url':response.request.res.responseUrl });
                        })
                }
            })
            .catch((error) => {
              //  console.log(error)
                var desc = "";
                var title = "";
                if (error.data) {
                    if (JSON.stringify(JSON.stringify(error.data)).includes("Sorry, this store is currently unavailable.") || JSON.stringify(JSON.stringify(error.data)).includes("This store does not exist.")) {
                        //  console.log(store)
                        resolve({ "status": false, "url": store });
                        return false;
                    }
                    const $ = cheerio.load(error.data);

                    desc = $("meta[name='description']").attr("content");
                    title = $('head > title').text();
                    resolve({ "status": true, "store": store, "desc": desc, "title": title });
                    return false;
                }
                resolve({ "status": false });

            });




    })
}