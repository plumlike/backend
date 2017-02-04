var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
var dbConfig = require('../config.json').dbConfig;
var aws = require('aws-sdk');
var multer = require('multer');
var async = require('async');
var multerS3 = require('multer-s3');
var router = express.Router();

aws.config.loadFromPath('./awsConfig.json');

var s3 = new aws.S3();

var upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'tripear',
    acl: 'public-read',
    key: function (req, file, cb) {
      cb(null, Date.now() + '.' + file.originalname.split('.').pop());
    }
  })
});


var pool = mysql.createPool({
   host : dbConfig.host,
   port : dbConfig.port,
   user : dbConfig.user,
   password : dbConfig.password,
   database : dbConfig.database,
   connectionLimit : dbConfig.connectionLimit,
});


// 회원가입
//upload.fields([{ name: 'certificate', maxCount: 1 }, { name: 'profile', maxCount: 1 }])
router.post('/', upload.fields([{ name: 'certificate', maxCount: 1 }, { name: 'profile', maxCount: 1 }]), function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log(error);
      res.sendStatus(500);
    }
    else {
      bcrypt.hash(req.body.password, null, null, function(error, password){
        if (error){
          console.log(error);
          res.sendStatus(500);
        }
        else {
          var certificate = (req.files.certificate) ? req.files.certificate[0].location : null;
          var profile = (req.files.profile) ? req.files.profile[0].location : null;
          var sql = 'insert into member(email, password, name, gender, type, country, memo, certificate, profile, languages, create_at) values(?,?,?,?,?,?,?,?,?,?,now())';
          var params = [req.body.email, password, req.body.name, req.body.gender, 0, req.body.country, req.body.memo, certificate, profile, req.body.languages];
          connection.query(sql, params, function(error, rows) {
            if (error){
              console.log(error);
              res.sendStatus(500);
            }
            else {
                res.sendStatus(200);
            }
          });
        }
      });
    }
  });
});



router.use(function(req, res, next){
  if (req.session.user_id)
    next();
  else
    res.sendStatus(401);
});

// 회원정보 조회
router.get('/', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log(error);
      res.sendStatus(500);
    }
    else {
      var sql = 'select * from member where id = ?';
      var params = [req.session.user_id];
      connection.query(sql, params, function(error, rows){
        if (error){
            console.log(error);
            res.sendStatus(500);
        }
        else{
          res.send({
            email : rows[0].email,
            name : rows[0].name,
            gender : rows[0].gender,
            country : rows[0].country,
            profile : rows[0].profile,
            certificate : rows[0].certificate,
            memo : rows[0].memo,
            languages : rows[0].languages
          });
        }
      });
    }
  });
});


// 회원정보 수정
router.put('/', function(req, res, next) {
});


// 자격증 제출
router.post('/certificate', upload.single('certificate'), function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log(error);
      res.sendStatus(500);
    }
    else {
      var sql = 'update member set certificate = ? where id = ?';
      var params = [req.file.location, req.session.user_id];
      connection.query(sql, params, function(error, rows) {
        if (error){
          console.log(error);
          res.sendStatus(500);
        }
        else {
          res.sendStatus(200);
        }
      });
    }
  });
});


module.exports = router;
