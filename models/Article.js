const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
//Package used to auto create URL slugs
const slug = require('slug');
var User = mongoose.model('User');

const ArticleSchema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: String,
    description: String,
    body: String,
    favoritesCount: { type: Number, default: 0 },
    tagList: [{ type: String }],
    //Array of comment ids
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    //Taps into the UserSchema to be able to grab information about the auther from their Model.
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

ArticleSchema.plugin(uniqueValidator, { message: 'is already taken' });

//Generates the slug
ArticleSchema.methods.slugify = function() {
  //Slug method is passed in the title, which it turns into a hyphen seperated slug
  //A 6 character string is then appended onto the end of the slug to ensure there is no naming collisons
  //The .random() method creates a psuedo random number, that number is then multiplied by 36^6, which is the number of possible character combinations in a 6 character string, since there are 36 characters possible for each index. Then a bitwise OR operator is used with a base of zero to truncate the number down into an integer. Then toString is called with a radix of 36 to create the final 6 character string that will be appended.
  this.slug = slug(this.title) + '-' + ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
};

//Updates the article's favorite count.
ArticleSchema.methods.updateFavoriteCount = function() {
  const article = this;

  //The .count() method counts the number of matching model instances on a model. It is passed a conditions object, which tells it to look in the favorites property of all User model instances, and search those arrays for ids that match the article._id. When the query is finished, the Promise is resolved with the count, which is then assigned to the favoritesCount property on the article.
  return User.count({ favorites: { $in: [article._id] } }).then(function(count) {
    article.favoritesCount = count;

    return article.save();
  });
};

//Packages up the information that will be sent back with the response.
ArticleSchema.methods.toJSONFor = function(user) {
  return {
    slug: this.slug,
    title: this.title,
    description: this.description,
    body: this.body,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    tagList: this.tagList,
    //Checks to see if a requesting user has been passed in, if it has, then it grabs the id from this specific article, and calls the isFavorite method from the user's model instance. That will then check to see if the matching id is held in its favorites array, if so it will return true, otherwise false.
    favorited: user ? user.isFavorite(this._id) : false,
    favoritesCount: this.favoritesCount,
    //Useses the toProfileJSONFor() method that is on the User Schema, and passes it the user information, that will return all of the author profile information for us.
    author: this.author.toProfileJSONFor(user)
  };
};

//Prior to saving a model instance to the database, check for a slug, if there isn't one, then call the slugify() method, to create one.
ArticleSchema.pre('validate', function(next) {
  if (!this.slug) {
    this.slugify();
  }

  next();
});

mongoose.model('Article', ArticleSchema);
