'use strict'

const assert = require('assert')

const os = require('os')
const host = os.hostname()
const port = process.env.PORT || 18776
const express = require('express')

// to install -> $ yarn add philetus/express-xmlrpc
const xmlrpc = require('..') // require('express-xmlrpc')

const data = { test: 999 }

// use express to listen for incoming xmlrpc method requests
const app = express()

// xmlrpc message parsing middleware
// parses request body & sets request.xmlrpc.method & request.xmlrpc.params
app.use(xmlrpc.bodyParser)

// create xmlrpc api handler for express route
// gets method & parameters from request.body values set by middleware
//
// echo handler calls xmlrpc.serializeResponse() with return values
// to generate xml to pass to express res.send()
//
// to support more method signatures add more handler functions to api object
// passed to xmlrpc.apiHandler
app.post('/',
  xmlrpc.apiHandler({
    echo: function (req, res, next) {
      console.log(`method: '${req.body.method}'`)
      console.log(`params: '${JSON.stringify(req.body.params)}'`)
      console.log(`context: '${JSON.stringify(this)}'`)
      try {
        assert.equal(this.test, 999)
        const responseXml = xmlrpc.serializeResponse(req.body.params[0])
        console.log('response:', responseXml)
        res.send(responseXml)
      } catch (error) {
        const faultXml = xmlrpc.serializeFault(
          -32500, 'test error: ' + error.toString())
        console.log('fault:', faultXml)
        res.send(faultXml)
      }
    }},
  data) // context object to pass to api method calls
)

// listen for xmlrpc method calls at ros master uri
const server = app.listen(port)

// create client to send method call
const client = xmlrpc.createClient({ host: host, port: port })

// sends a method call to the XML-RPC server
client.methodCall('echo', [data], (error, value) => {
  try {
    console.log(`error: '${error}'`)
    console.log(`value: '${JSON.stringify(value)}'`)
    assert.equal(value.test, 999)
    console.log('express-xmlrpc test successful')
  } catch (error) {
    console.log('express-xmlrpc test failed with error:', error)
  }
  server.close()
})
