var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var aws = require('aws-sdk');
var dbConfig = require('../config.json').dbConfig;
var multer = require('multer');
var async = require('async');
var multerS3 = require('multer-s3');
var moment = require('moment');
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

router.get('/create', function(req, res, next){
  res.render('inform_edit');
});
// 여행계획 조회
router.get('/', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log(error);
      res.sendStatus(500);
    }
    else {
      /*
        sido // 특별시,광역시, 도
        category // 테마
        query // 검색어
      */
      var sql, params;
      if (req.query.sido && req.query.query){
        sql = 'SELECT * FROM plan WHERE sido = ? and MATCH(title, contents) AGAINST("+?*" IN BOOLEAN MODE);';
        params = [req.query.sido, req.query.query];
      }
      else if (req.query.sido && req.query.category){
        sql = 'select * from plan where sido = ? and category = ?';
        params = [req.query.sido, req.query.category];
      }
      else {
        sql = 'select * from plan;';
      }
      connection.query(sql, params, function(error, rows){
        if (error){
          console.log(error);
          res.sendStatus(500);
        }
        else {
          res.send(rows);
        }
      });
    }

  });
});

// 특정 여행계획 전체조회
router.get('/:plan_id', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log(error);
      res.sendStatus(500);
    }
    else {
      var datas = {};
      async.waterfall([
        // 여행정보 가져오기
        function(callback){
          var sql = 'select p.id as plan_id, p.*, r.* from plan p, route r where p.id = ? and p.id = r.plan_id;';
          var params = [req.params.plan_id];
          connection.query(sql, params, function(error, rows){
            if (error)
              callback(error, 'select1');
            else {
              var routes = [];
              for (var i in rows)
                routes.push({
                  longitude : rows[i].longitude,
                  latitude : rows[i].latitude,
                  area : rows[i].area,
                  description : rows[i].description
                });
              datas.plan = {
                id : rows[0].plan_id,
                now_count : rows[0].now_count,
                title : rows[0].title,
                contents : rows[0].contents,
                fee : rows[0].fee,
                start_at : moment(rows[0].start_at).format("YYYY-MM-DD"),
                end_at : moment(rows[0].end_at).format("YYYY-MM-DD"),
                create_at : rows[0].create_at,
                image1 : rows[0].image1,
                image2 : rows[0].image2,
                image3 : rows[0].image3,
                image4 : rows[0].image4,
                sido : rows[0].sido,
                sigugun : rows[0].sigugun,
                category : rows[0].category,
                routes : routes
              };
              callback(null, rows[0].member_id);
            }
          });
        },
        // 가이드 정보 가져오기
        function(member_id, callback){
          var sql = 'select * from member where id = ?';
          var params = [member_id];
          connection.query(sql, params, function(error, rows){
            if (error)
              callback(error, 'select2');
            else{
              rows[0].gender = (rows[0].gender === 0) ? "남자" : "여자";
              datas.guide = {
                email : rows[0].email,
                name : rows[0].name,
                gender : rows[0].gender,
                country : rows[0].country,
                profile : rows[0].profile,
                memo : rows[0].memo,
                languages : rows[0].languages
              };
              callback(null);
            }
          });
        },
        // 참여자 가져오기
        function(callback){
          var sql = 'select m.name, m.profile from apply a, member m where a.plan_id = ? and a.member_id = m.id;';
          var params = [req.params.plan_id];
          connection.query(sql, params, function(error, rows){
            if (error)
              callback(error, 'select3');
            else{
              datas.apply = rows;
              callback(null, 'select3');
            }
          });
        }

      ],
        function(error, results){
          if (error){
            console.log(results+error);
            res.sendStatus(500);
          }
          else {
            res.render('inform', {datas : datas});
          }
        }
      );
    }

  });
});


// session 체크
router.use(function(req, res, next){
  if (req.session.user_id)
    next();
  else
    res.sendStatus(401);
});

// 여행계획 수정
router.put('/', function(req, res, next) {
});



// 여행계획 등록
var fields = upload.fields([{ name: 'image1', maxCount: 1 }, { name: 'image2', maxCount: 1 }, { name: 'image3', maxCount: 1 }, { name: 'image4', maxCount: 1 }]);
router.post('/', fields, function(req, res, next) {

  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {

      var image1 = (req.files.image1) ? req.files.image1[0].location : null;
      var image2 = (req.files.image2) ? req.files.image2[0].location : null;
      var image3 = (req.files.image3) ? req.files.image3[0].location : null;
      var image4 = (req.files.image4) ? req.files.image4[0].location : null;

      var sql = 'insert into plan(member_id, category, title, contents, start_at, end_at, fee, image1, image2, image3, image4, sido, sigugun, create_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,now())';
      var params = [req.session.user_id, req.body.category, req.body.title, req.body.contents, req.body.date.substring(0,10), req.body.date.substring(13,24), req.body.fee, image1, image2, image3, image4, req.body.sido[0], req.body.sigugun[0]];
      connection.query(sql, params,function(error, rows){
        if (error){
          console.log(error);
          res.sendStatus(500);
          connection.release();
        }
        else {
          var plan_id = rows.insertId;
          var sql = 'insert into route(plan_id, longitude, latitude, area, description) values ?';
          var params = [];
          for (var i in req.body.longitude){
            params.push([plan_id, req.body.longitude[i], req.body.latitude[i], req.body.area[i], req.body.description[i]]);
          }
          connection.query(sql, [params], function(error, rows){
            if (error){
              console.log(error);
              res.sendStatus(500);
              connection.release();
            }
            else {
              res.sendStatus(200);
              connection.release();
            }
          });
        }
      });
    }
  });
});



// 여행계획 신청
router.post('/:plan_id', function(req, res, next) {
  console.log(req.session, req.params);
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      var sql = 'insert into apply(member_id, plan_id) values(?,?)';
      var params = [req.session.user_id, req.params.plan_id];
      connection.query(sql, params,function(error, rows){
        if (error){
          console.log(error);
          res.sendStatus(500);
          connection.release();
        }
        else {
          connection.query('update plan set now_count = now_count + 1 where id = ?', [req.params.plan_id], function(error, rows){
            if (error){
              console.log(error);
              res.sendStatus(500);
              connection.release();
            }
            else {
              res.sendStatus(200);
              connection.release();
            }
          });
        }
      });
    }
  });
});

// 여행계획 신청취소
router.delete('/:plan_id', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      var sql = 'delete from apply where member_id = ? and plan_id = ?';
      var params = [req.session.user_id, req.params.plan_id];
      connection.query(sql, params,function(error, rows){
        if (error){
          console.log(error);
          res.sendStatus(500);
          connection.release();
        }
        else {
          connection.query('update plan set now_count = now_count - 1 where id = ?', [req.params.plan_id], function(error, rows){
            if (error){
              console.log(error);
              res.sendStatus(500);
              connection.release();
            }
            else {
              res.sendStatus(200);
              connection.release();
            }
          });
        }
      });
    }
  });
});


module.exports = router;
