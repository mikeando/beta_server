var http = require('http');
var url = require('url');
var querystring = require('querystring');
var channels = require('./components/channels');

// For now we'll accept connections via http...
// And we'll listen for messages that should be sent back to the user
// Based on their username

// The list of pending messages to give to the user
var msg_queue = {}
msg_queue.users = {}
msg_queue.add_message = function(user_id, message )
{
  if ( !(user_id in this.users)) { this.users[user_id]=[]; }
  if ( ! this.users.hasOwnProperty(user_id) ) { throw new Error("Invalid user_id"); }
  this.users[user_id].push(message);
}
msg_queue.get_messages = function( user_id )
{
  if( !( user_id in this.users)) { return []; }
  if ( ! this.users.hasOwnProperty(user_id) ) { throw new Error("Invalid user_id"); }
  var retval = this.users[user_id];
  this.users[user_id] = [];
  return retval;
}

channels.subscribe('AUTH', function(channel,data)
{
  var value = JSON.parse( data.toString() );
  // TODO: Check its a message that should go to a player.
  msg_queue.add_message( value.id, value );
} )


function onRequest( request, response ) {

  var data_chunks = [];

  request.addListener("data", function(chunk) {
    data_chunks.push( chunk )
  } );

  request.addListener("end", function(chunk) {
    var data = Buffer.concat(data_chunks);

    var url_info = url.parse( request.url, true );
    var post_data = {}

    if( data.length > 0 )
    {
      post_data = querystring.parse( data.toString("ascii") );
    }

    if( url_info.pathname == "/auth" )
    {
      var args = null;
      if ( "args" in post_data ) { args = post_data.args; }
      else if ( "args" in url_info.query ) { args = url_info.query.args; }
      else
      {
        //TODO: Check this error code
        response.writeHead(400, {"Content-Type":"application/json"} );
        response.write( JSON.stringify( {"error":"/auth expects base64 encoded args argument"} ) );
        response.end();
        return;
      }

      try {
        //NOTE: This should accept both url safe base64 and traditional base64.
        //NOTE: Node doesn't seem to care if you have the "==" padding to 4
        //      bytes at the end either.  So we dont need to manually pad out the
        //      correct number of bytes.
        args.replace(/-/g,'+').replace(/_/g,'/');
        args = JSON.parse(Buffer( args, "base64").toString("utf8"));
      }
      catch(e)
      {
         if( e instanceof(SyntaxError) )
         {
           //TODO: Check this error code
           response.writeHead(300, {"Content-Type":"application/json"} );
           response.write( JSON.stringify( {"error":"Invalid args argument"} ) );
           response.end();
           return;
         }
      }

      if( ! ("name" in args ) )
      { 
        //TODO: Check this error code
        response.writeHead(300, {"Content-Type":"application/json"} );
        response.write( JSON.stringify( {"error":"Expected name [string] in args"} ) );
        response.end();
        return;
      }

      if( ! ("password" in args ) )
      { 
        //TODO: Check this error code
        response.writeHead(300, {"Content-Type":"application/json"} );
        response.write( JSON.stringify( {"error":"Expected password [string] in args"} ) );
        response.end();
        return;
      }

      // TODO: Do some real auth here.
      if( args.name !== "monkey" || args.password !== "gorgonzola" )
      {
        //TODO: Check this error code
        response.writeHead(300, {"Content-Type":"application/json"} );
        response.write( JSON.stringify( {"error":"Authorization failed"} ) );
        response.end();
        return;
      }

      response.writeHead(200, {"Content-Type":"application/json"});
      var user_id = "_some_opaque_user_id_";
      var result = { "id":user_id, "auth_token":"_some_opaque_auth_token" }
      result.messages = msg_queue.get_messages( user_id );
      response.write( JSON.stringify( result  ) );

      channels.send( "AUTH", JSON.stringify({ "id":user_id, "mesg":"I is teh roxxor" } ) )
    }
    else if( request.url == "/poll" )
    {
      // TODO: Check that we got an auth_token
      console.log("Got poll request ... just faking it");
      response.writeHead(200, {"Content-Type":"application/json"});
      // TODO: Get real messages
      response.write( JSON.stringify( { "messages":msg_queue.get_messages( "_some_opaque_user_id_" ) } ) );
    }
    else
    {
      console.log("Unknown request...");
      response.writeHead(400,{"Content-Type":"application/json"});
      response.write( JSON.stringify( {"error":"Invalid request url"} ) );
    }


    response.end();
  } );

}

http.createServer(onRequest).listen(8083)
