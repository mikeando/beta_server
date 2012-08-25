var zmq = require('zmq')
var http = require('http')

// For now we'll accept connections via http...
// And we'll listen for messages that should be sent back to the user
// Based on their username

//TODO: Hide the ZMQ implementation inside an object to make later changes
//      easier.  and to enable sharing of implementation between applications.

var z_push = zmq.socket("push")
var z_sub = zmq.socket("sub")

z_sub.connect("tcp://localhost:5577")
z_push.connect("tcp://localhost:5578")

// For now take all messages - we'll filter them ourself.
z_sub.subscribe('')

// The list of pending messages to give to the user
// TODO : Make this a real class
var msg_queue = []

// We've got a response
z_sub.on('message',
function(data)
{
  var value = JSON.parse( data.toString() )
  console.log("Got me a "+data.toString() )
  // TODO: Check its a message that should go to a player.
  // TODO: Store it in the msg queue
  msg_queue.push( value )
})



function onRequest( request, response ) {
  if( request.url == "/auth" )
  {
    console.log("Got auth request ... just faking it");
    response.writeHead(200, {"Content-Type":"application/json"});
    response.write( JSON.stringify( { "id":"_some_opaque_user_id_", "auth_token":"_some_opaque_auth_token" } ) );
    z_push.send( JSON.stringify( { "auth":"_some_opaque_user_id_" } ) )
    // TODO: Do some real auth here.
    // TODO: Check if you've got any messages queued up for the user
  }
  else if( request.url == "/poll" )
  {
    // TODO: Check that we got an auth_token
    console.log("Got poll request ... just faking it");
    response.writeHead(200, {"Content-Type":"application/json"});
    // TODO: Get real messages
    response.write( JSON.stringify( { "messages":msg_queue } ) );
    msg_queue = []
  }
  else
  {
    console.log("Unknown request...");
    response.writeHead(400,{"Content-Type":"application/json"});
    response.write( JSON.stringify( {"error":"Invalid request url"} ) );
  }
}

http.createServer(onRequest).listen(8083)
