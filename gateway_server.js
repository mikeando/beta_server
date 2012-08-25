var http = require('http');
var url = require('url');
var request = require('request');
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

//TODO: Make these nicer
player_registry = {}
player_registry_rev = {}

channels.subscribe('AUTH', function(channel,data)
{
  var value = JSON.parse( data.toString() );
  // TODO: Check its a message that should go to a player.
  msg_queue.add_message( value.id, value );
} )

function getArgs()
{
  var args = null;
  if ( "args" in this.post_data )
  {
    args = this.post_data.args;
  }
  else if ( "args" in this.url_info.query )
  {
     args = this.url_info.query.args;
  }
  else
  {
    throw new Error("No args argument provided");
  }

  try
  {
    //NOTE: This should accept both url safe base64 and traditional base64.
    //NOTE: Node doesn't seem to care if you have the "==" padding to 4
    //      bytes at the end either.  So we dont need to manually pad out the
    //      correct number of bytes.
    args.replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(Buffer( args, "base64").toString("utf8"));
  }
  catch(e)
  {
    throw new Error("Invalid args argument");
  }
}

function onAuth( response )
{

  if( ! ("name" in this.args ) )
  { 
    //TODO: Check this error code
    this.response.writeHead(300, {"Content-Type":"application/json"} );
    this.response.write( JSON.stringify( {"error":"Expected name [string] in args"} ) );
    this.response.end();
    return;
  }

  if( ! ("password" in this.args ) )
  { 
    //TODO: Check this error code
    this.response.writeHead(300, {"Content-Type":"application/json"} );
    this.response.write( JSON.stringify( {"error":"Expected password [string] in args"} ) );
    this.response.end();
    return;
  }

  // Get the user with the given name
  var name = this.args.name;
  var password = this.args.password;
  var this_ = this;

  request(
      'https://drmikeando.iriscouch.com/roardemo/_design/users/_view/name?' +
          querystring.stringify( {"key":JSON.stringify( name ) } ),
          function( error, rr, body) { onDBResult.call(this_, error, rr, body, password); }
      );
}

//TODO: Need to handle case where error is passed
function onDBResult( error, rr, body, password )
{
  var body_json = JSON.parse(body);
  console.log(body_json);
  if(!body_json)
   {
    //TODO: Check this error code
    this.response.writeHead(300, {"Content-Type":"application/json"} );
    this.response.write( JSON.stringify( {"error":"CouchDB JSON Error"} ) );
    this.response.end();
    return;
   }
  if(
      body_json.rows.length == 0 ||
      body_json.rows[0].value.password !== password
    )
  {
    //TODO: Check this error code
    this.response.writeHead(300, {"Content-Type":"application/json"} );
    this.response.write( JSON.stringify( {"error":"Authorization failed"} ) );
    this.response.end();
    console.log( body_json.rows[0].value.password , "=/=", password );
    return;
  }

  this.response.writeHead(200, {"Content-Type":"application/json"});
  var user_id = body_json.rows[0].value.user_id;

  var this_ = this;
  require('crypto').randomBytes(48, function(ex, buf)
  {
    var auth_token = buf.toString('base64').replace(/\//g,'_').replace(/\+/g,'-');
    var result = { "id":user_id, "auth_token":auth_token }
    result.messages = msg_queue.get_messages( user_id );
    this_.response.write( JSON.stringify( result  ) );
    this_.response.end()

    channels.send( "AUTH", JSON.stringify({ "id":user_id, "mesg":"I is teh roxxor" } ) );
    if ( user_id in player_registry_rev ) { delete player_registry[ player_registry_rev[user_id] ]; }
    player_registry[auth_token] = user_id;
    player_registry_rev[user_id] = auth_token;

    console.log( player_registry );
    console.log( player_registry_rev );
  });
}

function onPoll()
{
  // TODO: Check that we got an auth_token
  console.log("Got poll request ... just faking it");
  this.response.writeHead(200, {"Content-Type":"application/json"});
  // TODO: Get real messages
  this.response.write( JSON.stringify( { "messages":msg_queue.get_messages( "_some_opaque_user_id_" ) } ) );
  this.response.end();
}

function onUnknown()
{
  console.log("Unknown request...");
  this.response.writeHead(400,{"Content-Type":"application/json"});
  this.response.write( JSON.stringify( {"error":"Invalid request url"} ) );
  this.response.end();
}

function onRequestEnd( req, response, data_chunks )
{
    var req_obj = {}

    req_obj.url_info = url.parse( req.url, true );
    req_obj.post_data = {}

    var data = Buffer.concat(data_chunks);

    if( data.length > 0 )
    {
      req_obj.post_data = querystring.parse( data.toString("ascii") );
    }

    req_obj.args = getArgs.call(req_obj)
    req_obj.response = response;

    if( req_obj.url_info.pathname == "/auth" ) { onAuth.call( req_obj ); }
    else if( req_obj.url_info.pathname  == "/poll" )      { onPoll.call( req_obj ); }
    else                               { onUnknown.call( req_obj ); }
}

function onRequest( req, response )
{
  var data_chunks = [];

  req.addListener("data", function(chunk) {
    data_chunks.push( chunk )
  } );

  req.addListener("end", function() {
    onRequestEnd( req, response, data_chunks );
  } );
}

http.createServer(onRequest).listen(8083)
