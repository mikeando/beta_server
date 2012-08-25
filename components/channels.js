var zmq = require('zmq')

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

module.exports = channels;
