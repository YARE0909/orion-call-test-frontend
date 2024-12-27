import { useEffect, useRef, useState } from "react";
import Peer, { MediaConnection } from "peerjs";
import { io } from "socket.io-client";

const VideoCall: React.FC = () => {
  const [userId] = useState<string>(`Guest-${Math.floor(Math.random() * 1000)}`);
  const [, setPeerId] = useState<string>('');
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const currentUserVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerInstance = useRef<Peer | null>(null);
  const mediaConnectionRef = useRef<MediaConnection | null>(null); // Ref to store the current call
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [callOnHold, setCallOnHold] = useState<boolean>(false);
  const [inCall, setInCall] = useState<boolean>(false);
  const [callStatus, setCallStatus] = useState<string>('notInCall');

  const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL, {
    query: {
      userId
    }
  });

  const call = (remotePeerId: string) => {
    console.log("Calling peer with ID: ", remotePeerId);
    // Use modern getUserMedia method
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((mediaStream: MediaStream) => {
        if (currentUserVideoRef.current) {
          currentUserVideoRef.current.srcObject = mediaStream;
          currentUserVideoRef.current.play();
        }

        const peerCall = peerInstance.current?.call(remotePeerId, mediaStream);
        if (peerCall) {
          mediaConnectionRef.current = peerCall; // Store the current call in the ref
          peerCall.on('stream', (remoteStream: MediaStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play();
            }
          });
        }
      })
      .catch((err) => {
        console.error("Error accessing media devices.", err);
      });
  };

  const initiateCall = () => {
    const roomId = `room-${Math.floor(Math.random() * 1000)}`;
    setCurrentRoomId(roomId);
    setInCall(true);
    setCallStatus('calling');
    socket.emit("initiate-call", JSON.stringify({ roomId }));
  };

  useEffect(() => {
    const peer = new Peer(userId);

    socket.on("call-joined", (data) => {
      console.log({ currentRoomId });
      console.log(data.roomId);
      if (data.roomId === currentRoomId) {
        console.log(data.to);
        call(data.to);
        setCallStatus('inProgress');
      }
    });

    socket.on("call-on-hold", (data) => {
      if (data.roomId === currentRoomId) {
        setCallOnHold(true);
        setCallStatus('onHold');
      }
    });

    socket.on("call-resumed", (data) => {
      if (data.roomId === currentRoomId) {
        console.log({ data });
        setCallOnHold(false);
        call(data.to);
        setCallStatus('inProgress');
      }
    });

    socket.on("call-ended", (data) => {
      if (data.roomId === currentRoomId) {
        console.log(data);

        // Close the active PeerJS call when the call-ended event is triggered
        if (mediaConnectionRef.current) {
          mediaConnectionRef.current.close();
          mediaConnectionRef.current = null;
        }
        // Close current video streams
        if (currentUserVideoRef.current) {
          currentUserVideoRef.current.srcObject = null;
        }

        setInCall(false);
        setCallStatus('notInCall');
      }
    });

    peer.on('open', (id: string) => {
      setPeerId(id);
    });

    peer.on('call', (call: MediaConnection) => {
      // Use modern getUserMedia method for answering the call
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((mediaStream: MediaStream) => {
          if (currentUserVideoRef.current) {
            currentUserVideoRef.current.srcObject = mediaStream;
            currentUserVideoRef.current.play();
          }

          call.answer(mediaStream);
          call.on('stream', (remoteStream: MediaStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play();
            }
          });

          // Store the incoming call in the ref
          mediaConnectionRef.current = call;
        })
        .catch((err) => {
          console.error("Error accessing media devices.", err);
        });
    });

    peerInstance.current = peer;

    return () => {
      peerInstance.current?.destroy();
    };
  }, [userId, currentRoomId]);

  return (
    <div className="w-full h-screen bg-black flex flex-col text-white">
      <div className="w-full h-16 border-b-2 border-b-gray-500 p-4 flex items-center justify-center">
        <h1 className="text-4xl font-bold">Guest</h1>
      </div>
      {callOnHold && <h2>Call on hold</h2>}
      {!inCall && callStatus === "notInCall" && (
        <div className="w-full h-full flex items-center justify-center">
          <button className="border-2 p-2 rounded-md" onClick={initiateCall}>Call Virtual Receptionist</button>
        </div>
      )}
      {inCall && callStatus === "inProgress" && (
        <div className="w-full h-full relative p-4">
          <div className="flex flex-col items-center absolute bottom-10 right-10">
            <video ref={currentUserVideoRef} autoPlay muted className="border-4 border-gray-300 rounded-lg shadow-lg w-64 h-48 object-cover" />
          </div>
          <div>
            <video ref={remoteVideoRef} autoPlay className="w-full h-full border-4 border-gray-300 rounded-lg shadow-lg object-cover" />
          </div>
        </div>
      )}
      {
        callStatus === 'calling' && (
          <div className="w-full h-full flex items-center justify-center">
            <h1 className="font-bold text-xl">Calling Virtual Receptionist...</h1>
          </div>
        )
      }
      {
        callStatus === 'onHold' && (
          <div className="w-full h-full flex items-center justify-center">
            <h1 className="font-bold text-xl">Call on hold</h1>
          </div>
        )
      }
    </div>
  );
};

export default VideoCall;
