var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var dbConfig = require('../config.json').dbConfig;

var pool = mysql.createPool({
   host : dbConfig.host,
   port : dbConfig.port,
   user : dbConfig.user,
   password : dbConfig.password,
   database : dbConfig.database,
   connectionLimit : dbConfig.connectionLimit,
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
