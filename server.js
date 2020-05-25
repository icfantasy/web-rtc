const express = require('express');
const app = express();

var http = require('http').createServer(app).listen(process.env.PORT||3000, function() {
	console.log('Application running on port '+this.address().port);
});

var io = require('socket.io').listen(http);

app.use(express.static(__dirname + '/static/'));

app.get('/',function(req,res) {
  res.sendFile(__dirname+'/static/index.html');
});

app.get('/room',function(req,res) {
  res.sendFile(__dirname+'/static/room/index.html');
});

app.get('/networking',function(req,res) {
  res.sendFile(__dirname+'/static/networking/index.html');
});

var userlist = {};
io.sockets.on('connection',function(socket) {
	console.log('A user has connected!');

	socket.on('new user',function(data,callback) {
		if (data.username in userlist) {
			callback(false);
		} else {
			console.log('user wants to connect as ' + data);
			console.log('connect ' + Object.values(userlist).filter(item => item.roomname === data.roomname));
			if (Object.values(userlist).filter(item => item.roomname === data.roomname).length < 2 ) {
				callback(true);
				socket.username = data.username;
				socket.roomname = data.roomname;
				userlist[socket.username] = socket;
				socket.connect = true;
				if (data.search && !data.pairid) search(socket);
			}
			else {
				callback(false);
			}
		}
		console.log('connect ' + Object.values(userlist).map(item => item.username));
	});

	socket.on('disconnect', function(data) {
		console.log('disconnect ' + socket.username);

		if (!socket.username) return;

		socket.connect = false;
		delete userlist[socket.username];
		if (socket.pairid) {
			search(userlist[socket.pairid]);
		}
	});

	socket.on('search', function() {
		search(socket);
	});

	function uuidv4() {
		return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}

	function search(cur) {
		console.log('search');

		cur.search = true;
		cur.pairid = undefined;
		
		const available_users = Object.values(userlist).filter(user => user.search && user.username !== cur.username && user.connect);
		if (available_users && available_users.length >= 1) {
			const randId = Math.floor(Math.random() * available_users.length);
			const roomname = "observable-" + uuidv4();

			if (cur.connect && available_users[randId].connect) {
				console.log(randId);
				cur.search = false;
				cur.roomname = roomname;
				cur.pairid = available_users[randId].username;
				cur.emit('connect-to', roomname);

				available_users[randId].search = false;
				available_users[randId].roomname = roomname;
				available_users[randId].pairid = cur.username;
				available_users[randId].emit('connect-to', roomname);
			}
		}
	}
});