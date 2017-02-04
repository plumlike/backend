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
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      res.render('index', { title: 'Express' });
    }
  });
});

module.exports = router;
