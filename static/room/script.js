var socket = io({transports: ['websocket'], upgrade: false});
function uuidv4() {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

let roomId = uuidv4();

const roomLink = window.location.href.match('room/[\?]id=([0-9a-z\-]+)');
if (roomLink) {
  roomId = roomLink[1];
}
else {
  const url = '/room/?id=' + roomId;
  window.location = url;
}

let roomName = "observable-" + roomId;
let userName = uuidv4();
let room, peerConnection;

socket.emit('new user', { username: userName, roomname: roomName }, function(data) {
  if (data) {
    console.log('ChatApp v0.0.2 - Welcome, ' + userName);
    setTimeout(() => {
      startDrone();
    }, 1000);
  } else {
    document.getElementById("current-state").innerHTML = "The room is full...";
  }
});

function startDrone() {
  document.getElementById("current-state").innerHTML = "waiting...";
  let drone = new ScaleDrone("yiS12Ts5RdNhebyM", {
    data: {
      name: userName
    }
  });

  const configuration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  };

  drone.on("error", error => {
    console.log(error);
  });

  drone.on("reconnect", () => {
    console.log("reconnected");
  });

  drone.on("open", error => {
    if (error) return console.error(error);

    room = drone.subscribe(roomName);
    room.on("open", error => {
      if (error) {
        onError(error);
      }
    });

    room.on("members", members => {
      console.log("MEMBERS", members);
      const isOfferer = members.length === 2;
      startWebRTC(isOfferer);
    });

    room.on("member_join", member => {
      document.getElementById("current-state").innerHTML = "";
    });

    room.on("member_leave", member => {
      document.getElementById("current-state").innerHTML = "waiting...";
    });

  });

  function startWebRTC(isOfferer) {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        SendMetaMessage({ candidate: event.candidate });
      }
    };

    if (isOfferer) {
      peerConnection.onnegotiationneeded = () => {
        peerConnection
          .createOffer()
          .then(localDescCreated)
          .catch(onError);
      };
    }

    peerConnection.ontrack = event => {
      const stream = event.streams[0];
      if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
        remoteVideo.srcObject = stream;
      }
    };

    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: true
      })
      .then(stream => {
        localVideo.srcObject = stream;
        stream
          .getTracks()
          .forEach(track => peerConnection.addTrack(track, stream));
      }, onError);

    room.on("data", (message, client) => {

      if (client.id === drone.clientId) {
        return;
      }

      if (message.sdp) {
        peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.sdp),
          () => {
            if (peerConnection.remoteDescription.type === "offer") {
              peerConnection
                .createAnswer()
                .then(localDescCreated)
                .catch(onError);
            }
          },
          onError
        );
      } else if (message.candidate) {
        peerConnection.addIceCandidate(
          new RTCIceCandidate(message.candidate),
          onSuccess,
          onError
        );
      }
    });
  }
  function localDescCreated(desc) {
    peerConnection.setLocalDescription(
      desc,
      () => SendMetaMessage({ sdp: peerConnection.localDescription }),
      onError
    );
  }

  function onSuccess() {}
  function onError(error) {
    console.log(error);
  }

  function SendMetaMessage(message) {
    drone.publish({
      room: roomName,
      message
    });
  }
}