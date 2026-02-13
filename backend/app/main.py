import json
import shutil
import uuid
from app.parsers.video_parser.helpers import run_video_pipeline, send_results
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List
import os,tempfile
from app.parsers.resume_parser import ResumeParser
from app.models import ResumeData, ParseResponse
from app.utils.file_handler import save_upload_file, validate_file

import logging


import asyncio
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay
from pydantic import BaseModel


from whisperlivekit import AudioProcessor, TranscriptionEngine


pcs: Dict[str, RTCPeerConnection] = {}
relay = MediaRelay()

ws_clients: Dict[str, WebSocket] = {}


logging.getLogger("whisperlivekit").setLevel(logging.ERROR)
logging.getLogger("uvicorn").setLevel(logging.ERROR)
logging.getLogger("uvicorn.access").setLevel(logging.ERROR)


class Offer(BaseModel):
    sdp: str
    type: str
    session_id: str | None = None

app = FastAPI(
    title="Resume Parser API",
    description="API for parsing resumes and extracting structured data",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_ORIGINS = {"http://localhost:3000"}


# Initialize parser
resume_parser = ResumeParser()

@app.get("/")
async def root():
    return {"message": "Interviewer", "status": "active"}

@app.post("/parse-resume/", response_model=ParseResponse)
async def parse_resume(file: UploadFile = File(...),filePath: str = Form(...)  ):
    """
    Parse a resume file (PDF or DOCX) and extract structured information
    """

    print(filePath)
    # Validate file
    if not validate_file(file):
        raise HTTPException(status_code=400, detail="Invalid file format. Only PDF and DOCX are supported.")
    
    try:
        # Read file content
        contents = await file.read()
        
        # Parse resume
        parsed_data = resume_parser.parse(contents, file.filename,"")
        
        print("data read")
        return ParseResponse(
            success=True,
            filename=file.filename,
            data=parsed_data
        )
    
    except Exception as e:
        print( 'why?')
        raise HTTPException(status_code=500, detail=f"Error parsing resume: {str(e)}")
    
    finally:
        await file.close()

@app.post("/parse-resumes-batch/", response_model=List[ParseResponse])
async def parse_resumes_batch(files: List[UploadFile] = File(...)):
    """
    Parse multiple resume files in batch
    """
    results = []
    
    for file in files:
        try:
            if not validate_file(file):
                results.append(ParseResponse(
                    success=False,
                    filename=file.filename,
                    error="Invalid file format"
                ))
                continue
            
            contents = await file.read()
            parsed_data = resume_parser.parse(contents, file.filename)
            
            results.append(ParseResponse(
                success=True,
                filename=file.filename,
                data=parsed_data
            ))
        
        except Exception as e:
            results.append(ParseResponse(
                success=False,
                filename=file.filename,
                error=str(e)
            ))
        
        finally:
            await file.close()
    
    return results

@app.post("/webrtc/offer")
async def webrtc_offer(offer:Offer):
    session_id = offer.session_id or str(uuid.uuid4())

    print("session_id:",session_id)

    pc = RTCPeerConnection()

    pcs[session_id] = pc

    @pc.on("track")
    def on_track(track):

        relayed = relay.subscribe(track)

        if track.kind == "audio":
            print("here")
            # asyncio.create_task(run_audio_pipeline(session_id, relayed))
        
        elif track.kind == "video":
            asyncio.create_task(run_video_pipeline(session_id, relayed))
        
    await pc.setRemoteDescription(RTCSessionDescription(sdp=offer.sdp, type=offer.type))

    answer = await pc.createAnswer()

    await pc.setLocalDescription(answer)

    return {
        "session_id": session_id,
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
    }

transcription_engine = None
@app.websocket("/asr")
async def asr(ws: WebSocket):
    await ws.accept()

    ap = AudioProcessor(transcription_engine=TranscriptionEngine(model="base", diarization=False, lan="en"))
    gen = await ap.create_tasks()

    task = asyncio.create_task(send_results(ws,gen))

    try:
        while True:
            chunk = await ws.receive_bytes()
            await ap.process_audio(chunk)

    except WebSocketDisconnect:
        logging.info("Client disconnected")

    except Exception:
        logging.exception("WS crashed while processing audio")

    finally:
        task.cancel()
        try:
            await ws.close()
        except Exception:
            pass

@app.websocket("/ws/results/{session_id}")
async def ws_results(ws: WebSocket, session_id: str):
    origin = ws.headers.get("origin")
    if origin not in ALLOWED_ORIGINS:
        await ws.close(code=1008)  # policy violation
        return
    await ws.accept()
    ws_clients[session_id] = ws
    try:
        # Keep open; optionally receive control messages
        while True:
            _ = await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if ws_clients.get(session_id) is ws:
            ws_clients.pop(session_id, None)


# @app.websocket("/ws/interview")
# async def interview_ws(ws: WebSocket):
#     await ws.accept()
#     try: 
#         while True:
#             data = await ws.receive_json()



# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
