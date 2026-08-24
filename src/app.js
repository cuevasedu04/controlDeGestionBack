/**
 * **************************************
 * REST API EXPRESS - MYSQL
 * **************************************
 */

/* required imports */
var cors = require('cors');
var winston = require('./config/winston');
var https = require("https");

const express = require("express");
const app = express();
const fs = require("fs");
const path = require('path');
const responseInterceptor = require("./utils/responseInterceptor");

/*app settings*/
const config = require("./config/config");
app.set("port", config.PORT);
app.set("json spaces", 2);


/* CONFIGURACION HTTPS */
/* var configHTTPS = {
    key: fs.readFileSync(path.resolve('./src/server.key')),
    cert: fs.readFileSync(path.resolve('./src/ServerCertificate.crt'))
} */

//Middleware
app.options('*', cors());
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json({ limit: "50mb" }));


app.use((req, res, next) => {

    /* setting HTTP Headers */
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    /** develpoment logs about input request (Methods, endpoints, DATA, <<we'll call postData>>) 
     * *Hint: uncomment to see all requests to API, Add as a string the endpoints to the if condition to exclude.  
    */

    
        /* if ((!req.url.includes("/asunto/")) || (!req.url.includes("/asunto/endpointExample"))) {
            console.log('Entry message |  Endpoint: ' + req.url + ' - Ip Request: ' + req.ip + ' - HTTP Method: ' + req.method + ' - \\n Body Request: ' + req.body);
        }  */
   

    let response = res.send;
    res.send = function (data) {
        response.apply(res, arguments);
        /* Show response logs by the API Endpoint 
        * *Hint: uncomment to see all requests to API, Add string endpoints to the if condition to exclude.
        */
        if (!req.url.includes("consultarAsuntosUR")   &&  !req.url.includes("consultarDetalleAsunto") &&  !req.url.includes("consultarExpedienteAsunto")) {
            console.log('Response message : ' + data)
        }
    }
    next();
});

//app.use(responseInterceptor);

/* API's directory to save all files 
* (Those are private files)
*/
app.use('/documentos', express.static(__dirname + '/documentos')); 


/**
 * Here you add all the Endpoints
 * route:   ./api/folderEndpoint/endpoint
 * 
 * *hint: You only add one Endpoint for each sub-methods into the entity.
 */
app.use("/test", require("./api/test/test"));
app.use("/token", require("./api/token/token"));
app.use("/catalogo", require("./api/catalog/catalog"));
app.use("/user", require("./api/user/user"));
app.use("/asunto", require("./api/asunto/asunto"));
app.use("/turnado", require("./api/turnado/turnado"));
app.use("/acuerdo", require("./api/acuerdo/acuerdo"));


/**
 * Administrator's Endpoint 
**/
/* app.use("/admin", require("./api/admin/admin")); */

/**
 * Redirect empty or unknown endpoints. 
 * you can set default site string. 
*/
app.get('*', function (req, res) {
    res.redirect("https://anam.gob.mx");
});
app.get('/', function (req, res) {
    res.redirect("https://anam.gob.mx")
});


/*
 * Initializing the HTTP Server
 * Choose the environment and set develpment or production. 
 * 
 */


if (config.NODE_ENV == config.ENUM_NODE_ENV.Development) {
    app.listen(app.get("port"), () => {
        console.log("Starting HTTP server on: ", app.get("port"));
    });
}


if (config.NODE_ENV == config.ENUM_NODE_ENV.Production) {
    app.listen(app.get("port"), () => {
        console.log("Starting HTTP server on: ", app.get("port"));
    });

    /*/https */
    /* var httpsServer = https.createServer(configHTTPS, app);

    httpsServer.listen(app.get("port"), () => {
        console.log("Inicio de servidor Https", app.get("puerto"));
    }); */
}
