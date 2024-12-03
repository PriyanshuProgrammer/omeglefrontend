import React, { useEffect, useRef, useState } from "react";
import {io} from 'socket.io-client'


function App(){
    
    const [username, setusername] = useState("")
    const [socket, setsocket] = useState(null)
    const [localstream, setlocalstream] = useState(null)
    const videoref = useRef(null)
    const remotevideo = useRef(null)

    useEffect(()=>{
        const socketserver = io("https://omeglebackend.onrender.com")
        setsocket(socketserver)
        
        const constraints = {
            audio:false,
            video:true
        }

        let mediastream = null

        navigator.mediaDevices.getUserMedia(constraints)
        .then((stream)=>{
            if(stream){
                setlocalstream(stream)
                mediastream = stream
                stream.onremovetrack = ()=>{
                    console.log("track removed")
                }
                videoref.current.srcObject = stream
            }
        }).catch((err)=>{
            console.log("Stream error")
        })
 
        const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
        const pc = new RTCPeerConnection(configuration)

        // sending the tracks
        setTimeout(() => {
            mediastream.getTracks().forEach((track)=>{
                pc.addTrack(track,mediastream)
            })
            
        }, 2000);
        
        // receving the audio stream from the remote peer
        pc.ontrack = (ev) => {
            console.log(ev)
            const track  = ev.track;
            const stream = ev.streams[0];
            if(track.kind == 'video'){
                remotevideo.current.srcObject = stream
            }

        };

        socketserver.on("new-ice-candidate",async (icecandidate)=>{
            if(icecandidate){
                try{
                    await pc.addIceCandidate(icecandidate)
                    console.log("got the ice candidate")
                }
                catch(e){
                    console.log("Error in receiving ice candidate")
                }
            }
        })

        socketserver.on("offer",async function(offer){
            if(offer){
                console.log("got the offer")
                const desc = new RTCSessionDescription(offer)
                await pc.setRemoteDescription(desc)
            }
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socketserver.emit("answer",answer)
        })

        return ()=>{
            let tracks = mediastream.getTracks()
            tracks.forEach((track)=>{
                track.stop()
            })
        }
    },[])

    async function makecall(){
        const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
        const pc = new RTCPeerConnection(configuration);

        // sending audio stream to the remote peer
        localstream.getTracks().forEach((track)=>{
            pc.addTrack(track,localstream)
        })

        pc.ontrack = (ev) => {
            console.log(ev)
            const track  = ev.track;
            const stream = ev.streams[0];
            if(track.kind == 'video'){
                remotevideo.current.srcObject = stream
            }

        };

        pc.addEventListener('icecandidate',(event)=>{
            if(event.candidate){
                console.log("send the ice candidate")
                socket.emit("new-ice-candidate",event.candidate)
            }
        })

        socket.on("answer",async function(answer){
            if(answer){
                console.log("got the answer")
                const desc = new RTCSessionDescription(answer)
                await pc.setRemoteDescription(desc)
            }
        })


        pc.addEventListener("connectionstatechange", event=>{
            if(pc.connectionState == 'connected'){
                console.log("Peers Connected")
            }
        })

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit("offer",offer)
    }
    

    return (
        <>
            <video autoPlay playsInline ref={videoref}  style={{width:"300px",height:"auto",border:"2px solid black"}}></video>
            <video autoPlay playsInline ref={remotevideo}  style={{width:"300px",height:"auto",border:"2px solid black"}}></video>
            <input type="text" onChange={(el)=>{setusername(el.target.value)}}/>
            <button onClick={makecall}>makecall</button>
        </>
    )
}

export default App