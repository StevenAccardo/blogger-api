const router = require('express').Router();
router.use('/', require('./users'));
router.use('/profiles', require('./profiles'));
router.use('/articles', require('./articles'));
router.use('/tags', require('./tags'));

//When a middleware is defined with four arguments, it will be treated as an error handler (the first argument is always the error object).
//This sits after all of the API routes and is used for catching ValidationErrors thrown by mongoose.
router.use(function(err, req, res, next) {
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      errors: Object.keys(err.errors).reduce(function(errors, key) {
        errors[key] = err.errors[key].message;

        return errors;
      }, {})
    });
  }

  return next(err);
});

module.exports = router;
