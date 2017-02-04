var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
var dbConfig = require('../config.json').dbConfig;

var pool = mysql.createPool({
   host : dbConfig.host,
   port : dbConfig.port,
   user : dbConfig.user,
   password : dbConfig.password,
   database : dbConfig.database,
   connectionLimit : dbConfig.connectionLimit,
});

// 일반 로그인
router.post('/in', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      connection.query('select id, password, name from member where email = ?', [req.body.email],function(error, rows){
        if (error){
          console.log("Connection Error" + error);
          res.sendStatus(500);
          connection.release();
        }
        else {
          if (rows.length > 0){
            bcrypt.compare(req.body.password, rows[0].password, function(error, result){
              if (result){
                req.session.user_id = rows[0].id;
                req.session.name = rows[0].name;
                var msg = req.session.user_id + "번 회원 " + req.session.name + "님 로그인";
                console.log(msg);
                res.render('index', { title: 'Express' });
              }
              else {
                res.status(400).send({errorMessage : "패스워드 틀렸다."}); // 비밀번호 틀림
              }
              connection.release();
            });
          }
          else {
            res.status(400).send({errorMessage : "아이디 없다."}); // 아이디 없음
            connection.release();
          }
        }
      });
    }
  });
});

// 로그아웃
router.post('/out', function(req, res, next) {
  var msg = req.session.user_id + "번 회원 " + req.session.name + "님 로그아웃";
  req.session.destroy(function(err){
    if (err){
      console.log(err);
      res.sendStatus(500);
    }
    else{
      res.status(200).send(msg);
    }
  });
});


module.exports = router;
