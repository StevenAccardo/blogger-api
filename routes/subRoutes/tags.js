const router = require('express').Router();
const mongoose = require('mongoose');
const Article = mongoose.model('Article');

router.get('/', function(req, res, next) {
  //Uses the find and distinct methods to retrieve all of the distinct tags throughout all of the articles.
  Article.find()
    .distinct('tagList')
    .then(function(tags) {
      return res.json({ tags: tags });
    })
    .catch(next);
});

module.exports = router;
