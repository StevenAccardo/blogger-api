//Configures the Passport.js middleware

const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const User = mongoose.model('User');

passport.use(
  new localStrategy(
    //Strips the email and password off of the req.body
    {
      usernameField: 'user[email]',
      passwordField: 'user[password]'
    },
    function(email, password, done) {
      User.findOne({ email: email })
        .then(function(user) {
          if (!user || !user.validPassword(password)) {
            return done(null, false, { errors: { 'email or password': 'is invalid' } });
          }

          return done(null, user);
        })
        .catch(done);
    }
  )
);
