'use strict'

// express-xmlrpc - xml-rpc middleware for express
// xml-rpc spec: http://www.xmlrpc.com/spec

const Deserializer = require('./lib/deserializer.js')
const Serializer = require('./lib/serializer.js')
const Client = require('./lib/client.js')

// log message hooks
const loggingHooks = {
  deserializeError: (error) => {
    console.error('failed to deserialize method call from body:', error);
  },
  incomingRequest: (req) => {
    console.log(`calling method '${req.body.method}`
      + `(${JSON.stringify(req.body.params)})'`);
  },
  requestError: (req, error) => {
    console.error(`error calling method '${req.body.method}:`, error);
  }
};

// allow applications to replace the hooks
exports.setLoggingHooks = (hooks) => {
  Object.assign(loggingHooks, hooks);
}

// for serializing xmlrpc responses inside api methods
exports.serializeResponse = Serializer.serializeMethodResponse // (params)
exports.serializeFault = Serializer.serializeFault // (code, msg)

// client to make xmlrpc method calls
exports.createClient = (options) => new Client(options, false)

// middleware to parse body of xmlrpc method call & add to request
// * method -> req.body.method
// * parameters -> req.body.params
exports.bodyParser = (req, res, next) => {
  const deserializer = new Deserializer()
  deserializer.deserializeMethodCall(req, (error, method, params) => {
    if (error !== null) {
      req.body = null
      loggingHooks.deserializeError(error);
      next()
    } else {
      req.body = {
        method: method,
        params: params,
      }
      next()
    }
  })
}

// generate route handler for xmlrpc method reqests from api & context
// api is an object with method names mapped to handler functions:
// { methodName: methodNameHandler[(request, response, next)], .. }
// context is an optional context object to be mapped to this inside of call
exports.apiHandler = (api, context, onError, onMiss) => {
  return async (req, res, next) => {

    // if xml wasnt successfully parsed respond with fault
    if (!req.body) {
      res.send(
        exports.serializeFault(-32700, 'parse error: not well formed'))
    }

    if (req.body.method in api) {
      loggingHooks.incomingRequest(req);

      try {
        const method = api[req.body.method]

        // rejected promises wont be caught unless they are awaited
        await method.call(context, req, res, next)

      } catch (error) {

        // if error handler was given call it with error, req & res
        if (onError) {
          onError.call(context, error, req, res, next)

        // otherwise log & send generic xmlrpc fault
        } else {
          loggingHooks.requestError(req, error);

          res.send(
            exports.serializeFault(
              -32500, `error calling method '${req.body.method}'`))
          next(error)
        }
      }

    } else {

      // if miss handler was given call it
      if (onMiss) {
        onMiss.call(context, req, res, next)

      // otherwise send generic xmlrpc fault
      } else {
        res.send(
          exports.serializeFault(
            -32601, `requested method '${req.body.method}' not found`))
      }
    }
  }
}
