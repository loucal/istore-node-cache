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
  
  function call_itunes_and_respond(term, type, response) {
    var iTunesOptions = { host: 'itunes.apple.com', port: 80 };
    if (type === "a") {
      iTunesOptions.path = '/search?term=' + term.replace(" ", "+", "g") + '&entity=musicArtist&attribute=artistTerm&limit=5'
      var c = 'artists'
      var matchJson = {_id:term.toLowerCase()}
    } else if (type === "s") {
      //do song path
      var c = 'songs'
      var matchJson = {_id:term}
    }
    var jsonResults;
    db.collection(c, function(err, collection) {
      collection.find(matchJson, function(err, cursor) {
        cursor.toArray(function(err,docs) {
          if(docs.length > 0) {
            response.send(200,{},docs)
          } else {
            var jsonString = "";
            console.log(iTunesOptions.path)
            var req = http.request(iTunesOptions, function(res) {
              console.log('Made Request - STATUS: ' + res.statusCode);
              res.setEncoding('utf8');
              res.on('data', function (chunk) {
                jsonString += chunk;
              });
              res.on('end', function(){
                var itunesJson = JSON.parse(jsonString)
                db.collection(c, function(err, collection) {
                  for(var x in itunesJson.results) {                    
                    itunesJson.results[x]._id = itunesJson.results[x].artistName.toLowerCase()
                    collection.insert(itunesJson.results[x]);
                  }
                });
                response.send(200, {}, itunesJson.results);
              });
            });
            req.end();
          }
        });
      });
    });
  }
  
  var router = new(journey.Router);

  // Create the routing table
  router.map(function () {
    this.root.bind(function (req, res) { res.send('This should be accessed by authorized applications only.') });
    this.get(/^song\/([0-9]+)$/).bind(function (req, res, id, params) {
      db.collection('songs', function(err, collection) {
        collection.find()
        res.send(200, {}, {});
      });
    });
    this.get('/artist').bind(function (req, resp, data) {
      if(data.term){
        call_itunes_and_respond(data.term, "a", resp)
      } else {
        resp.send("need a term");
      }        
    });
  });

  require('http').createServer(function(request, response) {
    var body = "";

    request.addListener('data', function(chunk) { body += chunk });
    request.addListener('end', function() {

      router.handle(request, body, function(result) {
        response.writeHead(result.status, result.headers);
        response.end(result.body);
      });
    });
  }).listen(8080);
});
