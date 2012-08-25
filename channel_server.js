zmq = require("zmq")

pub_z = zmq.socket("pub")
pull_z = zmq.socket("pull")

console.log("Staring channel server")
console.log("Accepting subscriptions on tcp://*:5577")
pub_z.bind("tcp://*:5577")
console.log("Accepting notifications on tcp://*:5578")
pull_z.bind("tcp://*:5578")

pull_z.on('message',
		function(data)
		{
			pub_z.send(data)	
		}
	 )



