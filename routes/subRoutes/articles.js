const router = require('express').Router();
const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Article = mongoose.model('Article');
const Comment = mongoose.model('Comment');
const auth = require('../auth');

//Accepts any post request, checks for auth, looks up who is attempting to post the article by searching the DB by their id.
router.post('/', auth.required, function(req, res, next) {
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      //Creates a new Article Model instance/
      const article = new Article(req.body.article);

      article.author = user;

      //Saves the article
      return article.save().then(function() {
        //Responds to the client side, with the article information that was setup for the toJSONFor method on the article schema.
        return res.json({ article: article.toJSONFor(user) });
      });
    })
    .catch(next);
});

//The feed endpoint is very similar to the articles endpoint. It returns a list of articles along with the count, but it only needs to respond to the limit and offset query parameters. The query for articles will be based on who the user is following.

//See above route for clarification on methods and reasoning of code
router.get('/feed', auth.required, function(req, res, next) {
  let limit = 10;
  let offset = 0;

  if (typeof req.query.limit !== 'undefined') {
    limit = req.query.limit;
  }

  if (typeof req.query.offset !== 'undefined') {
    offset = req.query.offset;
  }

  User.findById(req.payload.id).then(function(user) {
    if (!user) {
      return res.sendStatus(401);
    }

    Promise.all([
      Article.find({ author: { $in: user.following } })
        .limit(Number(limit))
        .skip(Number(offset))
        .populate('author')
        .exec(),
      Article.count({ author: { $in: user.following } })
    ])
      .then(function(results) {
        const articles = results[0];
        const articlesCount = results[1];

        return res.json({
          articles: articles.map(function(article) {
            return article.toJSONFor(user);
          }),
          articlesCount: articlesCount
        });
      })
      .catch(next);
  });
});

router.param('article', function(req, res, next, slug) {
  Article.findOne({ slug: slug })
    //The Article model is depending on the User model for the author information, the populate method will fetch the data about the Author from the proper Model instance and populate it on the article model instance before returning the promise.
    .populate('author')
    .then(function(article) {
      if (!article) {
        return res.sendStatus(404);
      }

      req.article = article;

      return next();
    })
    .catch(next);
});

//Fetches a single Article, auth is optional
router.get('/:article', auth.optional, function(req, res, next) {
  //Promise.all() returns a single Promise that resolves when all of the promises in the iterable argument have resolved.
  Promise.all([
    //checks to see if there is information on the requesting user, so is the requesting user registered and signedin, or are they anonymous?
    req.payload ? User.findById(req.payload.id) : null,
    req.article.populate('author').execPopulate()
  ])
    .then(function(results) {
      //stores the requesting user's information in the user variable
      const user = results[0];

      //Returns the article.
      return res.json({ article: req.article.toJSONFor(user) });
    })
    .catch(next);
});

//Edits an article
router.put('/:article', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user) {
    //Checks to make sure that the user trying to edit the article is the author of the article.
    if (req.article.author._id.toString() === req.payload.id.toString()) {
      //Make some checks to see what fields the user is trying to update, if the values are undefined then those fields will not be updated.
      if (typeof req.body.article.title !== 'undefined') {
        req.article.title = req.body.article.title;
      }

      if (typeof req.body.article.description !== 'undefined') {
        req.article.description = req.body.article.description;
      }

      if (typeof req.body.article.body !== 'undefined') {
        req.article.body = req.body.article.body;
      }

      req.article
        .save()
        .then(function(article) {
          //sends back the updated article information
          return res.json({ article: article.toJSONFor(user) });
        })
        .catch(next);
    } else {
      //If not the author of the article, then a forbidden status code is sent back
      return res.sendStatus(403);
    }
  });
});

//Removes a specified article.
router.delete('/:article', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function() {
    if (req.article.author._id.toString() === req.payload.id.toString()) {
      return req.article.remove().then(function() {
        return res.sendStatus(204);
      });
    } else {
      return res.sendStatus(403);
    }
  });
});

// Favorite an article
router.post('/:article/favorite', auth.required, function(req, res, next) {
  //Stores the id of the article to be favorited inside a memory space.
  const articleId = req.article._id;
  //Looks for the User model instance for the user trying to favorite the article
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }
      //Uses the fovorite() method on the user model instance to ad the article's id to the favorites property array on that user's model instance.
      return user.favorite(articleId).then(function() {
        //Updates the favorite count for that article, so if a user just favorited the article, then it will have increased by one interger.
        return req.article.updateFavoriteCount().then(function(article) {
          //Sends the article info, with the newly updated count, back to the client.
          return res.json({ article: article.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

// Unfavorite an article
router.delete('/:article/favorite', auth.required, function(req, res, next) {
  const articleId = req.article._id;

  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      return user.unfavorite(articleId).then(function() {
        return req.article.updateFavoriteCount().then(function(article) {
          return res.json({ article: article.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

router.post('/:article/comments', auth.required, function(req, res, next) {
  //Grabs posting user's User model instance
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      const comment = new Comment(req.body.comment);
      comment.article = req.article;
      comment.author = user;

      return comment.save().then(function() {
        //Pushes the new comment onto the article's comments array
        req.article.comments.push(comment);
        //saves article and then sends the posted comment back in the response
        return req.article.save().then(function(article) {
          res.json({ comment: comment.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

router.get('/:article/comments', auth.optional, function(req, res, next) {
  //Returns a promise object
  Promise.resolve(req.payload ? User.findById(req.payload.id) : null)
    .then(function(user) {
      return (req.article
          //Populate allows you to reference documents in other collections
          //Population is the process of automatically replacing the specified paths in the document with document(s) from other collection(s)
          //Populate takes _ids that are stored in the article.comments property, and makes findById queries on those ids to get the actual model instances, or documents, in place of the ids.
          .populate({
            //Tells mongoose to populate the comments from the Article
            path: 'comments',
            //tells mongoose to populate the author data from each comment.
            populate: {
              path: 'author'
            },
            options: {
              //Sorts the comments in descending order, in regards to the createdAt date, later comments at the top, earlier at the bottom
              sort: {
                createdAt: 'desc'
              }
            }
          })
          .execPopulate()
          //Passes in the article after population
          .then(function(article) {
            //Server responds with an array of Comments
            //Comments are mapped over, then the toJSONFor method on the comments model instance is called to return the appropriate data for each comment.
            return res.json({
              comments: req.article.comments.map(function(comment) {
                return comment.toJSONFor(user);
              })
            });
          }) );
    })
    .catch(next);
});

router.param('comment', function(req, res, next, id) {
  //Queries for comment id to be deleted
  Comment.findById(id)
    .then(function(comment) {
      if (!comment) {
        return res.sendStatus(404);
      }

      //if found, addes to the request object to be used in the router.delete route.
      req.comment = comment;

      return next();
    })
    .catch(next);
});

router.delete('/:article/comments/:comment', auth.required, function(req, res, next) {
  //Checks to see if the user requesting to delete the comment is the author.
  if (req.comment.author.toString() === req.payload.id.toString()) {
    //Deletes the comment's _id off of the article's comments array
    req.article.comments.remove(req.comment._id);
    req.article
      .save()
      //Then deletes the actual comment model instance
      .then(
        Comment.find({ _id: req.comment._id })
          .remove()
          .exec()
      )
      .then(function() {
        res.sendStatus(204);
      });
  } else {
    res.sendStatus(403);
  }
});

//Creates a queryable endpoint where the user can pass paramaters via the url, to retrieve custom responses.
//Route is requested when the app first loads to hydrate the list of global articles
router.get('/', auth.optional, function(req, res, next) {
  let query = {};
  //Number of articles sent back in response, a limit of 20 is the default, but can be changed via the frontend request
  let limit = 20;
  //The number of articles to skip for query. This value is used for retrieving different pages of articles and defaults to 0 if it's not provided by the front end.
  let offset = 0;

  //If the frontend would like to overide the default limit
  if (typeof req.query.limit !== 'undefined') {
    limit = req.query.limit;
  }

  //If the frontend would like to overide the default offset
  if (typeof req.query.offset !== 'undefined') {
    offset = req.query.offset;
  }

  //Allows the user to filter the query result by tag, and then only the items with a matching tag will be returned.
  if (typeof req.query.tag !== 'undefined') {
    query.tagList = { $in: [req.query.tag] };
  }

  //The Promise.all() method takes an array of promises, which will then try to resolve the array of promises, and then pass an array of resolved values to the attached .then handler. Any values that are not wrapped in a promise will be considered resolved.
  //1st index, checks to see if the author query was used, if so it looks up the username of the author.
  //2nd index, checks to see if the favorited query was used, if so it queries for the user's info, by username
  Promise.all([req.query.author ? User.findOne({ username: req.query.author }) : null, req.query.favorited ? User.findOne({ username: req.query.favorited }) : null])
    //results from the promise
    .then(function(results) {
      //author to filter by
      const author = results[0];
      //user info, which we will pull the data from the favorited array
      const favoriter = results[1];

      //adds the author's id to the query
      if (author) {
        query.author = author._id;
      }

      //If user data was found
      if (favoriter) {
        //Looks for article ids in the user's favorites array
        query._id = { $in: favoriter.favorites };
      } else if (req.query.favorited) {
        query._id = { $in: [] };
      }

      //I needed to wrap this Promise.all() in the outer Promise.all() since we need to find the users from their usernames in the query parameters before we can run the query for articles.
      return Promise.all([
        Article.find(query)
          //Specifies the maximum number of documents the query will return.
          .limit(Number(limit))
          //Specifies the number of documents to skip.
          .skip(Number(offset))
          //sets the sort order
          .sort({ createdAt: 'desc' })
          //Fetches the actual documents that correspond to ids before returning the final result
          .populate('author')
          //executes the query
          .exec(),
        Article.count(query).exec(),
        //Is the requesting user signed in?
        req.payload ? User.findById(req.payload.id) : null
        //The promise resolves with an array of results, one for each index in the promise array
      ]).then(function(results) {
        //The articles from the first query
        const articles = results[0];
        //The number of articles from the 2nd query
        const articlesCount = results[1];
        //The requesting user's record, or null if they are signedout
        const user = results[2];

        return res.json({
          //maps over each article, and passes each one the requesting user's info, so that the favorited and following can be updated properly
          articles: articles.map(function(article) {
            return article.toJSONFor(user);
          }),
          //Sends back the article count
          articlesCount: articlesCount
        });
      });
    })
    .catch(next);
});

module.exports = router;
