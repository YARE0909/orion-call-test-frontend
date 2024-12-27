/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import Peer, { MediaConnection } from "peerjs";
import { io } from "socket.io-client";

const VideoCall: React.FC = () => {
  const [userId] = useState<string>(`Host-${Math.floor(Math.random() * 1000)}`);
  const [, setPeerId] = useState<string>('');
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const currentUserVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerInstance = useRef<Peer | null>(null);
  const [callList, setCallList] = useState<string[]>([]);
  const mediaConnectionRef = useRef<MediaConnection | null>(null); // Ref for the current call

  const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL, {
    query: {
      userId
    }
  });

  const joinCall = (roomId: string) => {
    socket.emit("join-call", JSON.stringify({ roomId }));
  }

  const endCall = (roomId: string) => {
    socket.emit("end-call", JSON.stringify({ roomId }));

    // Close the PeerJS call if it's active
    if (mediaConnectionRef.current) {
      mediaConnectionRef.current.close();
      mediaConnectionRef.current = null;
    }

    // Close current video streams
    if (currentUserVideoRef.current) {
      currentUserVideoRef.current.srcObject = null;
    }
  }

  const holdCall = (roomId: string) => {
    socket.emit("hold-call", JSON.stringify({ roomId }));

    // Close the PeerJS call if it's active
    if (mediaConnectionRef.current) {
      mediaConnectionRef.current.close();
      mediaConnectionRef.current = null;
    }

    // Close current video streams
    if (currentUserVideoRef.current) {
      currentUserVideoRef.current.srcObject = null;
    }
  }

  const resumeCall = (roomId: string) => {
    socket.emit("resume-call", JSON.stringify({ roomId }));
  }

  useEffect(() => {
    const peer = new Peer(userId);

    socket.emit("get-call-list");

    socket.on("call-list-update", (data) => {
      console.log(data);
      setCallList(data);
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

          // Save the current call to ref for later closing
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
  }, [userId]);

  return (
    <div className="w-full h-screen bg-black text-white flex flex-row-reverse">
      <div className="w-1/4 h-screen border-l-2 border-l-gray-500 overflow-y-auto p-4">
        <h2 className="text-xl font-semibold mb-3">Call List</h2>
        <ul className="space-y-4">
          {callList.map((call: any) => (
            <li key={call.roomId} className="bg-black border-2 p-4 rounded-lg shadow-md flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-medium text-lg">{call.from}</span>
                <span className="text-gray-600">{call.status}</span>
              </div>

              <div className="flex gap-3">
                {call.status === "inProgress" && (
                  <button
                    className="bg-yellow-500 text-white py-1 px-4 rounded hover:bg-yellow-600"
                    onClick={() => holdCall(call.roomId)}
                  >
                    Hold Call
                  </button>
                )}
                {call.status === "pending" && (
                  <button
                    className="bg-green-500 text-white py-1 px-4 rounded hover:bg-green-600"
                    onClick={() => joinCall(call.roomId)}
                  >
                    Join Call
                  </button>
                )}
                {call.status === "onHold" && (
                  <button
                    className="bg-blue-500 text-white py-1 px-4 rounded hover:bg-blue-600"
                    onClick={() => resumeCall(call.roomId)}
                  >
                    Resume Call
                  </button>
                )}
                <button
                  className="bg-red-500 text-white py-1 px-4 rounded hover:bg-red-600"
                  onClick={() => endCall(call.roomId)}
                >
                  End Call
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-3/4 h-screen relative p-4">
        <div className="flex flex-col items-center absolute bottom-10 right-10">
          <video ref={currentUserVideoRef} autoPlay muted className="border-4 border-gray-300 rounded-lg shadow-lg w-64 h-48 object-cover" />
        </div>
        <div className="w-full h-full flex flex-col">
          <video ref={remoteVideoRef} autoPlay className="w-full h-full border-4 border-gray-300 rounded-lg shadow-lg object-cover" />
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
