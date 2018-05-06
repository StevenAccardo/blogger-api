//DETERMINES WHICH ENVIRONMENT THE SERVER IS OPERATING IN, TO DETERMINE HOW TO HANDLE SECRET KEYS

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./prod');
} else {
  module.exports = require('./dev');
}
