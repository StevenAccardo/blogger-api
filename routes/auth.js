//Middleware that validates JsonWebTokens and sets req.user
const jwt = require('express-jwt');
const jwtSecretKey = require('../config/keys').JWT_SECRET_KEY;

//A helper function that the middleware uses to extract the JWT from the Authorization header
function getTokenFromHeader(req) {
  //.split() splits the authorization header by white space, and returns an array, then the first index is checked and compared.
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Token') {
    //returns the second index in the array, which is the actual jwt that was passed to the user.
    return req.headers.authorization.split(' ')[1];
  }

  return null;
}

//Two cases for handling JWT's. Required will be used when a user must be authenticated to hit a certain route. Optional will be used for any routes that are exposed to the public. If the user is authorized then those public routes can be more personalized via the information that is passed back.
const auth = {
  required: jwt({
    secret: jwtSecretKey,
    userProperty: 'payload',
    getToken: getTokenFromHeader
  }),
  optional: jwt({
    secret: jwtSecretKey,
    userProperty: 'payload',
    credentialsRequired: false,
    getToken: getTokenFromHeader
  })
};

module.exports = auth;
