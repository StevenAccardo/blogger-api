const router = require('express').Router();
const mongoose = require('mongoose');
const User = mongoose.model('User');
const auth = require('../auth');

//Populates the request object with the user's data before sending it to the route endpoint
router.param('username', function(req, res, next, username) {
  User.findOne({ username: username })
    .then(function(user) {
      if (!user) {
        return res.sendStatus(404);
      }

      req.profile = user;

      return next();
    })
    .catch(next);
});

router.get('/:username', auth.optional, function(req, res, next) {
  if (req.payload) {
    //This is grabbing the requesting user's model instance, not the user who's username was passed in.
    User.findById(req.payload.id).then(function(user) {
      //If the dB can't find the model instance
      if (!user) {
        return res.json({ profile: req.profile.toProfileJSONFor(false) });
      }
      //Sends back the profile data for the requested user, with the correct following information, since the requesting user has a profile as well
      return res.json({ profile: req.profile.toProfileJSONFor(user) });
    });
  } else {
    //Sends back the profile data for the requested user, without the correct following information, since the requesting user DOES NOT have profile. This is public info, so a user doesn't have to be registered to see it.
    return res.json({ profile: req.profile.toProfileJSONFor(false) });
  }
});

router.post('/:username/follow', auth.required, function(req, res, next) {
  //Grabs the id of the user to be followed
  const profileId = req.profile._id;

  //Finds the requesting user's information
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      //Adds the profileId to the requesting user's follow array
      return user.follow(profileId).then(function() {
        //Sends back the profile that the request to follow was placed on
        return res.json({ profile: req.profile.toProfileJSONFor(user) });
      });
    })
    .catch(next);
});

router.delete('/:username/follow', auth.required, function(req, res, next) {
  const profileId = req.profile.id;

  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      //unfollows the user
      return user.unfollow(profileId).then(function() {
        return res.json({ profile: req.profile.toProfileJSONFor(user) });
      });
    })
    .catch(next);
});

module.exports = router;
