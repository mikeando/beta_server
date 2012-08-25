var zmq = require('zmq')
var http = require('http')

// For now we'll accept connections via http...
// And we'll listen for messages that should be sent back to the user
// Based on their username

var channels = {};
channels._zmq = {};
channels._zmq.sockets = {};
channels._zmq.sockets.push =  zmq.socket("push");
channels._zmq.sockets.sub  = zmq.socket("sub");

channels._zmq.sockets.sub.connect("tcp://localhost:5577");
channels._zmq.sockets.push.connect("tcp://localhost:5578");

channels.subscriptions = {};

channels.subscribe = function( channel_name, fn )
{
  //NOTE: Channel names are 4 ascii characters
  if( channel_name.length !== 4 ) { throw new Error("Channel names must be 4 characters long"); }

  if( !( channel_name in this.subscriptions ) )
  {
    this._zmq.sockets.sub.subscribe( channel_name );
    this.subscriptions[channel_name] = [];
  }

  if( ! this.subscriptions.hasOwnProperty(channel_name) )
  {
    throw new Error("Invalid channel_name");
  }

  this.subscriptions[channel_name].push(fn);
};

// We've got a response
channels._zmq.sockets.sub.on('message',
    function(data)
    {
      var channel_name = data.toString("ascii",0,4);
      var channel_data = data.slice(4);

      console.log("NAME : "+channel_name );
      console.log("DATA : "+channel_data.toString("utf-8") )

      //TODO: Work out what to do is the subscription functions throw an error.
      //      Note that storing the errors in an array and rethrowing once done
      //      loses the stack trace making them very hard to locate.

      if( channels.subscriptions.hasOwnProperty( channel_name ) )
      {
        for( var i =0 ; i<channels.subscriptions[channel_name].length; ++i )
        {
            channels.subscriptions[channel_name][i](channel_name,channel_data)
        }
      }
    }
);

channels.send = function(channel_name,mesg)
{
  //NOTE: Channel names are 4 ascii characters
  if( channel_name.length !== 4 ) { throw new Error("Channel names must be 4 characters long"); }
  channels._zmq.sockets.push.send(channel_name+mesg)
}

// The list of pending messages to give to the user
// TODO : Make this a real class
var msg_queue = []

// For now take all messages - we'll filter them ourself.
channels.subscribe('AUTH', function(channel,data)
{
  var value = JSON.parse( data.toString() );
  console.log("Got me a "+data.toString() );
  // TODO: Check its a message that should go to a player.
  // TODO: Store it in the msg queue
  msg_queue.push( value );
} )


function onRequest( request, response ) {
  if( request.url == "/auth" )
  {
    console.log("Got auth request ... just faking it");
    response.writeHead(200, {"Content-Type":"application/json"});
    response.write( JSON.stringify( { "id":"_some_opaque_user_id_", "auth_token":"_some_opaque_auth_token" } ) );
    channels.send( "AUTH", JSON.stringify({ "auth":"_some_opaque_user_id_" } ) )
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
