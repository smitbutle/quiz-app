import React, { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import {
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Paper,
} from "@mui/material";
import axios from "axios";

const Register = (props) => {
  const [username, setUsername] = useState("");
  const [embedding, setEmbedding] = useState(null);
  const [videoRef, setVideoRef] = useState(null);
  const [loading, setLoading] = useState(true);
  const [livenessDetected, setLivenessDetected] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [EAR_THRESHOLD, setEARThreshold] = useState(null);
  const isCalibratingRef = useRef(true);
  const calibrationData = useRef([]);
  const calibrationStartTimeRef = useRef(Date.now());
  const CALIBRATION_DURATION = 3000; // 3 seconds calibration time

  // One-time loading of face-api.js models
  useEffect(() => {
    async function loadModels() {
      setLoading(true);
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(process.env.PUBLIC_URL + "/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri(process.env.PUBLIC_URL + "/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri(process.env.PUBLIC_URL + "/models"),
        ]);
      } catch (error) {
        console.error("Error loading models:", error);
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, []);

  
  // Monitor the video stream for liveness detection and calibration
  useEffect(() => {
  
    let isBlinking = false;
    let interval;
    if (videoRef) {
      interval = setInterval(async () => {
        const video = document.getElementById("videoInput");

        const detections = await faceapi
          .detectSingleFace(video)
          .withFaceLandmarks();

        if (detections) {
          const leftEye = detections.landmarks.getLeftEye();
          const rightEye = detections.landmarks.getRightEye();

          // Simple blink detection based on eye landmarks
          const eyeAspectRatio = (eye) => {
            const width = Math.hypot(
              eye[3].x - eye[0].x,
              eye[3].y - eye[0].y
            );
            const height =
              Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y) +
              Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
            return width / (height / 2);
          };

          const leftEAR = eyeAspectRatio(leftEye);
          const rightEAR = eyeAspectRatio(rightEye);
          const EAR_THRESHOLD = 3.7; // Threshold for detecting a blink

          console.log(leftEAR, rightEAR, EAR_THRESHOLD);


          if (leftEAR > EAR_THRESHOLD && rightEAR > EAR_THRESHOLD) {
            // Eyes are closed
            setLivenessDetected(true);
            console.log("eyes closed");

            if (!isBlinking) {
              // If a blink wasn't already in progress, start it
              isBlinking = true;
            }
          } else {
            // Eyes are open
            console.log("eyes open");

            if (isBlinking) {
              // If a blink was in progress, increment the blink count
              setBlinkCount(blinkCount => blinkCount + 1)
              // console.log("Blink count: ", blinkCount);
              isBlinking = false; // Reset blink status
            }
          }
        }
      }, 200);
    }
    return () => clearInterval(interval);
  }, [videoRef]);

  // Handle registration process
  const handleRegister = async () => {
    setLoading(true);
    try {
      const video = document.getElementById("videoInput");
      const detections = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detections) {
        const userEmbedding = detections.descriptor;
        setEmbedding(userEmbedding);
        await axios.post("http://localhost:5000/register", {
          username,
          embedding: userEmbedding,
        });
        alert("Registration successful!");
        props.authenticateFace(userEmbedding);
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        alert("User has already registered.");
      } else {
        console.error("Error during registration:", error);
        alert("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Start the video stream
  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} }).then((stream) => {
      setVideoRef(stream);
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Paper sx={{ padding: 4, maxWidth: 480, textAlign: "center" }}>
        <Typography variant="h5">Register</Typography>
        {loading ? (
          <CircularProgress sx={{ margin: 3 }} />
        ) : (
          <>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{ marginTop: 2, marginBottom: 2 }}
            />
            <Button variant="contained" fullWidth onClick={startVideo} sx={{ marginBottom: 2 }}>
              Start Video
            </Button>
            <div style={{ position: "relative" }}>
              <video
                id="videoInput"
                width="100%"
                height="360"
                autoPlay
                style={{ borderRadius: 8, marginBottom: 2 }}
                ref={(ref) => (ref && ref.srcObject !== videoRef ? (ref.srcObject = videoRef) : null)}
              />
            </div>
            <Typography variant="body1" sx={{ margin: 2 }}>
            </Typography>

            {blinkCount < 2 &&
              <Typography variant="body1" sx={{ margin: 2 }}>
                Blink your eyes twice to register.
              </Typography>
            }
            
            <Button
              variant="contained"
              fullWidth
              onClick={handleRegister}
              disabled={blinkCount < 2}
              sx={{
                backgroundColor: blinkCount >= 2 ? "#1976d2" : "#9e9e9e",
                color: "#fff",
                marginTop: 2,
              }}
            >
              Register
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default Register;
