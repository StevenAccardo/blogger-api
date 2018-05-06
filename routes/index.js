const router = require('express').Router();

router.use('/', require('./subRoutes'));

module.exports = router;
