zmq = require("zmq")

sub_z = zmq.socket("sub")
push_z = zmq.socket("push")

sub_z.connect("tcp://localhost:5577")
push_z.connect("tcp://localhost:5578")
sub_z.subscribe('')

sub_z.on('message',
		function(data)
		{
			console.log("Got me a \"" + data.toString()+"\"")
			sub_z.close()
		}
	 )

push_z.send("Some kind of message")
push_z.close()
