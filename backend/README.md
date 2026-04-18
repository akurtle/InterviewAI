run using 

uvicorn app.main:app --host 127.0.0.1 --port 8000

TURN / ICE configuration

Copy `.env.example` to `.env` and set `WEBRTC_ICE_SERVERS` to a JSON array.
Include a TURN relay with UDP, TCP, and TLS transports for production networks,
for example:

`[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:turn.example.com:3478?transport=udp","turn:turn.example.com:3478?transport=tcp","turns:turn.example.com:5349?transport=tcp"],"username":"turn-username","credential":"turn-password"}]`
