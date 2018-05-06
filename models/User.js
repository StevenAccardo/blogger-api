const mongoose = require('mongoose');
//Adds pre-save validation for unique fields, and will create more detailed error handling, so you will get an error message when making a duplicate field, instead of the default mongoDB error, EE11000.
const uniqueValidator = require('mongoose-unique-validator');
//Node native library that will help us validate and generate hashes. The crypto module provides cryptographic functionality that includes a set of wrappers for OpenSSL's hash, HMAC, cipher, decipher, sign, and verify functions.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jwtSecretKey = require('../config/keys').JWT_SECRET_KEY;

//Creates schema for the User model
const UserSchema = new mongoose.Schema(
  {
    //Index: true is added to optimize queries that use those fields
    //Only allows for alphanumeric values as username
    username: { type: String, lowercase: true, unique: true, required: [true, "can't be blank"], match: [/^[a-zA-Z0-9]+$/, 'is invalid'], index: true },
    //Small regex validation check, ensure an @ and . are in email.
    email: { type: String, lowercase: true, unique: true, required: [true, "can't be blank"], match: [/\S+@\S+\.\S+/, 'is invalid'], index: true },
    bio: String,
    image: { type: String, default: 'https://yt3.ggpht.com/a-/AJLlDp3pDQMFfJwDmdDpTWMfrFhDUmrpY-Xy6sagUw=s900-mo-c-c0xffffffff-rj-k-no' },
    //stores the _id which references the model instance on the User model
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    //stores the _id which references the model instance on the Article model
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
    hash: String,
    salt: String
  },
  {
    //Creates a createdAt and updatedAt field on our models that contain timestamps which will get automatically updated when our model instance changes.
    timestamps: true
  }
);

//Adds the plugin to the schema, and passes in the error message if the field is not unique. The unique: true properties are then added to the fields we want to be unique.
UserSchema.plugin(uniqueValidator, { message: 'is already taken.' });

UserSchema.methods.setPassword = function(password) {
  //A salt is just a random string of characters that gets added to a password before hashing to prevent against the use of rainbow tables, and general attempts to decode user's passwords.
  //hash(passsword + salt)
  //The randomBytes is a wrapper around OpenSSL's RAND_bytes() function, which creates psuedo-random, cryptographically strong, bytes for high integrity needs. The integer passed in is the number of bytes to generate. The bytes are returned as a Buffer.
  //A Buffer is a temporary, fixed storage for bytes while they wait to be processed.
  //The bytes in the Buffer are then turned into a string with a radix of 16, or hexidecimal.
  this.salt = crypto.randomBytes(16).toString('hex');
  //5 args: the password, the salt, the hash iteration(how many times to hash the password), the length, and the algrorithm to use.
  //The pbkdf2Sync method also returns a Buffer, which is then converted to hexidecimal and stored in the hash property on the schema.
  this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};

//Takes a user entered password from an incoming http request, runs it through the same salting and hashing process as the password stored in a User model instance, and then compares them to see if they match. If they do, it returns true.
//You can not unhash a password, so the only way to determine if the password is correct is to run the same hash on the new password and compare it to the one stored for that user in the User model instance.
UserSchema.methods.validPassword = function(password) {
  const hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
  return this.hash === hash;
};

//Creates a JWT to be send back to the authenticated user, so they can make future requests to protected data.
UserSchema.methods.generateJWT = function() {
  //Create a Date object at the current date, according to the system settings for timezone offset
  const today = new Date();

  //Create a new date object with today's date
  const exp = new Date(today);
  //getDate() grabs the number of days from the the today object, then 60 days are added to that number, then setDate adds that many days to the month that is specified in the exp object.
  //today === Fri Apr 20 2018 15:56:03 GMT-0700 (PDT)
  //exp === Fri Apr 20 2018 15:56:03 GMT-0700 (PDT)
  //today.getDate() === 20
  //today.getDate() + 60 === 80
  exp.setDate(today.getDate() + 60); // => Fri Apr 0 2018 15:56:03 GMT-0700 (PDT) + 80 days === Tue Jun 19 2018 15:39:14 GMT-0700 (PDT)

  return jwt.sign(
    {
      //Pulls the _id from the model instance
      id: this._id,
      //Pulls the username from the model instance
      username: this.username,
      //sets the expiration date of the jwt.It takes the unix time, and divides it by 1000 to strip away the milliseconds.
      exp: parseInt(exp.getTime() / 1000)
    },
    jwtSecretKey
  );
};

//Adds a user's id to the follow array
UserSchema.methods.follow = function(id) {
  //If this user is not already following that user, add their id to the follow array.
  if (this.following.indexOf(id) === -1) {
    this.following.push(id);
  }

  return this.save();
};

UserSchema.methods.unfollow = function(id) {
  this.following.remove(id);
  return this.save();
};

//checks whether a user is following another user
UserSchema.methods.isFollowing = function(id) {
  return this.following.some(function(followId) {
    return followId.toString() === id.toString();
  });
};

//Favorites an article and adds that id to the favorites array
UserSchema.methods.favorite = function(id) {
  //indexOf returns -1 if id is not present within the favorites array
  if (this.favorites.indexOf(id) === -1) {
    this.favorites.push(id);
  }
  return this.save();
};

//UnFavorites an article and removes that id from the favorites array
UserSchema.methods.unfavorite = function(id) {
  this.favorites.remove(id);
  return this.save();
};

//Checks to see if a user has favorited the article before, so that can be passed on to the client side, in order for it to know whether it should allwo the user to favorite the article, or not.
UserSchema.methods.isFavorite = function(id) {
  //The article id in question is passed in to the outer function
  //The .some() method is used. It iterates through each element, aka favoriteId, until one matches the criteria in the function.
  return this.favorites.some(function(favoriteId) {
    //If any of the favoriteIds match the id in question then the .some() method will return true, otherwise false.
    return favoriteId.toString() === id.toString();
  });
};

UserSchema.methods.toAuthJSON = function() {
  return {
    username: this.username,
    email: this.email,
    token: this.generateJWT(),
    bio: this.bio,
    image: this.image || 'https://yt3.ggpht.com/a-/AJLlDp3pDQMFfJwDmdDpTWMfrFhDUmrpY-Xy6sagUw=s900-mo-c-c0xffffffff-rj-k-no'
  };
};

//sends back unsensitive user information to create a publicly accessible profile. Also passes in the requesting user's info, so it can be determined if the requesting user follows the user for who's profile information is being pullled.
UserSchema.methods.toProfileJSONFor = function(user) {
  return {
    username: this.username,
    bio: this.bio,
    image: this.image || 'https://yt3.ggpht.com/a-/AJLlDp3pDQMFfJwDmdDpTWMfrFhDUmrpY-Xy6sagUw=s900-mo-c-c0xffffffff-rj-k-no',
    //checks whether the requesting follower is following the user who onws the profile that is being requested
    following: user ? user.isFollowing(this._id) : false
  };
};

//Registers the schema with mongoose. The User model can then be accessed anywhere in our application by calling mongoose.model('User');
mongoose.model('User', UserSchema);
