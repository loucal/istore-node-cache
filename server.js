var journey = require('journey');
var http = require('http');
var Db = require('mongodb').Db,
Connection = require('mongodb').Connection,
Server = require('mongodb').Server;

var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

console.log("Connecting to " + host + ":" + port);
var mongo = new Db('songs', new Server(host, port, {}), {native_parser:false});
mongo.open(function(err, db) {
  //
  // Create a Router
  //
  var router = new(journey.Router);

  // Create the routing table
  router.map(function () {
    this.root.bind(function (req, res) { res.send('This should be accessed by authorized applications only.') });
    this.get(/^song\/([0-9]+)$/).bind(function (req, res, id, params) {
      db.open(function(err, db) {
        res.send(200, {}, {});
      });
    });
    this.get('/ac').bind(function (req, resp, data) {
      if(data.term){
        searchTerm = data.term.replace(" ", "+");
        var iTunesOptions = {
          host: 'itunes.apple.com',
          port: 80,
          path: '/search?term=' + searchTerm + '&entity=musicArtist&attribute=artistTerm&limit=5'
        };
        var jsonResults;
        db.collection('itunes', function(err, collection) {
          collection.find({artistName:new RegExp(data.term,"i")}, function(err, cursor) {
            cursor.toArray(function(err,docs) {
              if(docs.length > 0) {
                resp.send(200,{},docs)
              } else {
                var jsonString = "";
                console.log(iTunesOptions.path)
                var req = http.request(iTunesOptions, function(res) {
                  console.log('Made Request - STATUS: ' + res.statusCode);
                  //console.log('HEADERS: ' + JSON.stringify(res.headers));
                  res.setEncoding('utf8');
                  res.on('data', function (chunk) {
                    //console.log('CHUNK:' + chunk)
                    jsonString += chunk;
                  });
                  res.on('end', function(){
                    var itunesJson = JSON.parse(jsonString)
                    db.collection('itunes', function(err, collection) {
                      for(var x in itunesJson.results) {
                        collection.insert(itunesJson.results[x]);
                      }
                    });
                    resp.send(200, {}, itunesJson.results);
                  });
                });
                req.end();
              }
            });
          });
        });
      } else {
        resp.send("need a term");
      }        
    });
  });

  require('http').createServer(function (request, response) {
    var body = "";

    request.addListener('data', function (chunk) { body += chunk });
    request.addListener('end', function () {

      router.handle(request, body, function (result) {
        response.writeHead(result.status, result.headers);
        response.end(result.body);
      });
    });
  }).listen(8080);
});