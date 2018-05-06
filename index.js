//Comes with Node
//Parses a message into headers and body but it does not parse the actual headers or the body themselves.
const http = require('http'),
  //Comes with Node
  //The path module provides utilities for working with file and directory paths.
  path = require('path'),
  //Allows for lowercased http.methods to be used, so get instead of GET
  methods = require('methods'),
  express = require('express'),
  //Express library middleware that parses the bodies of incoming requests before reaching the handlers, and makes them available under the req.body property.
  bodyParser = require('body-parser'),
  //Express library middleware for working with cookies and sessions
  session = require('express-session'),
  //Express library middleware that tells the server to allow requests from all origins
  cors = require('cors'),
  passport = require('passport'),
  //Express library middleware for errorhandling in a development environment only
  errorhandler = require('errorhandler'),
  mongoose = require('mongoose'),
  mongoURI = require('./config/keys').MONGO_URI;

//Boolean
const isProduction = process.env.NODE_ENV === 'production';

// Create global app object
const app = express();

//First middleware. Allows incoming requests from all origins
app.use(cors());

// Normal express config defaults
//Imports the morgan library and then invokes morgan with the 'dev' option passed in, which color codes the response statuses
app.use(require('morgan')('dev'));
//Parses the body of a request if it is urlencoded, and attaches the newly parsed object on the request under the req.body property. Extended: false only allows for property values to be strings or arrays.
//This will allow the server to interpret the query strings that were passed with the url.
app.use(bodyParser.urlencoded({ extended: false }));
//Parses the body of a request if it is json, and attaches the newly parsed object on the request under the req.body property.
//bodyParser.json() returns a function which gets passed into the app.use middleware.
app.use(bodyParser.json());

//Lets you use HTTP verbs such as PUT or DELETE in places where the client doesn't support it. It will transform a POST method into a PUT, so that the server will be able to handle the request properly.
app.use(require('method-override')());

mongoose.connect(mongoURI);

if (!isProduction) {
  app.use(errorhandler());
  mongoose.set('debug', true);
}

//include models before routes, so that the routes can use the models
require('./models/User');
require('./models/Comment');
require('./models/Article');

require('./config/passport');

//Pulls a main route file which will link all of the routes in sub-directories
app.use(require('./routes'));

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (!isProduction) {
  app.use(function(err, req, res, next) {
    console.log(err.stack);

    res.status(err.status || 500);

    res.json({
      errors: {
        message: err.message,
        error: err
      }
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    errors: {
      message: err.message,
      error: {}
    }
  });
});

const server = app.listen(process.env.PORT || 3030, function() {
  console.log('Listening on port ' + server.address().port);
});
