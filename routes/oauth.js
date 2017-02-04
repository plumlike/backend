var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var dbConfig = require('../config.json').dbConfig;
var async = require('async');
var request = require('request');


var pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    connectionLimit: dbConfig.connectionLimit,
});


var client_id = 'EHpo3R3lnuULINBK0AU9';
var client_secret = 'Ptpkeh3HNW';
var state = "RANDOM_STATE";
var redirectURI = encodeURI("http://localhost:3000/oauth/naver/callback");
var api_url = "";
// 네이버 로그인
router.get('/naver', function(req, res) {
    api_url = 'https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=' + client_id + '&redirect_uri=' + redirectURI + '&state=' + state;
    console.log(api_url);
    res.writeHead(200, {
        'Content-Type': 'text/html;charset=utf-8'
    });
    res.end("<a href='" + api_url + "'><img height='50' src='/images/naver_green.PNG'/></a>");
});

router.get('/naver/callback', function(req, res) {
    async.waterfall([
            function(callback) {
                code = req.query.code;
                state = req.query.state;
                api_url = 'https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=' + client_id + '&client_secret=' + client_secret + '&redirect_uri=' + redirectURI + '&code=' + code + '&state=' + state;
                var options = {
                    url: api_url,
                    headers: {
                        'X-Naver-Client-Id': client_id,
                        'X-Naver-Client-Secret': client_secret
                    }
                };
                request.get(options, function(error, response, body) {
                    access_token = 'Bearer ' + JSON.parse(body).access_token;
                    if (!error && response.statusCode == 200) {
                        callback(null, access_token);
                    } else {
                        callback(error, 'resultA');
                    }
                });
            },
            function(access_token, callback) {
                var options = {
                    url: 'https://openapi.naver.com/v1/nid/me',
                    headers: {
                        'Authorization': access_token
                    }
                };
                request.get(options, function(error, response, body) {
                    body = JSON.parse(body);
                    body.response.gender = (body.response.gender == 'M') ? 0 : 1;
                    if (!error && response.statusCode == 200) {

                        callback(null, body);
                    } else {
                        callback(error, 'resultB');
                    }
                });
            },
            function(body, callback) {
                pool.getConnection(function(error, connection){
                  if (error){
                    callback(error, 'resultC');
                  }
                  else {
                    connection.query('select id, name, naver_id from member where email = ?', [body.response.email], function(error, rows){
                      if (error){
                        callback(error, 'resultC');
                        connection.release();
                      }
                      else {
                        if (rows.length > 0){
                          if (rows[0].naver_id){
                            req.session.user_id = rows[0].id;
                            req.session.name = body.response.name;
                            callback(null, 'resultC');
                            connection.release();
                          }
                          else {
                            connection.query('update member set naver_id = ? where id = ?', [body.response.id, rows[0].id], function(error, rows){
                              if (error){
                                callback(error, 'resultC');
                                connection.release();
                              }
                              else {
                                  req.session.user_id = rows[0].id;
                                  req.session.name = body.response.name;
                                  callback(null, 'resultC');
                                  connection.release();
                              }
                            });
                          }
                        }
                        else {
                          connection.query('insert into member(email, name, gender, type, create_at, naver_id) values(?,?,?,?,now(),?)', [body.response.email, body.response.name, body.response.gender, 0, body.response.id], function(error, rows){
                            if (error){
                              callback(error, 'resultC');
                              connection.release();
                            }
                            else {
                              req.session.user_id = rows[0].insertId;
                              req.session.name = body.response.name;

                              callback(null, 'resultC');
                              connection.release();
                            }
                          });
                        }
                      }
                    });
                  }
                });
            }
        ],
        function(err, results) {
          if (err){
            console.log(results+err);
            res.sendStatus(500);
          }
          else {
            var msg = req.session.user_id + "번 회원 " + req.session.name + "님 로그인";
            console.log(msg);
            res.render('index', { title: 'Express' });
          }
        }
    );
});



module.exports = router;
