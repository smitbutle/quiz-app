import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Paper, Typography, TextField, Button, CircularProgress, Checkbox, FormControlLabel, Tooltip, Alert, Snackbar } from "@mui/material";
import axios from "axios";
import * as faceapi from "face-api.js";
import { URL } from '../../consts';

const EAR_THRESHOLD = 3.7;
const BLINK_INTERVAL = 200;

const Register = ({ authenticateFace, startVideo, videoRef, username, setUsername }) => {
  const [loading, setLoading] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [error, setError] = useState(null);

  // Memoized validation functions
  const validateEmail = useCallback(() => {
    if (!email) {
      setEmailError("Email is required.");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  }, [email]);

  const validateUsername = useCallback(() => {
    if (!username) {
      setUsernameError("Username is required.");
      return false;
    }
    if (username.length < 3) {
      setUsernameError("Username must be at least 3 characters long.");
      return false;
    }
    setUsernameError("");
    return true;
  }, [username]);

  // Memoized eye aspect ratio calculation
  const calculateEyeAspectRatio = useCallback((eye) => {
    const width = Math.hypot(eye[3].x - eye[0].x, eye[3].y - eye[0].y);
    const height = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y) + 
                  Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    return width / (height / 2);
  }, []);

  // Memoized model file hashing
  const hashModelFile = useCallback(async (filePath, algorithm = 'SHA-256') => {
    try {
      const file = await fetch(process.env.PUBLIC_URL + '/' + filePath);
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error(`Error hashing model file ${filePath}:`, error);
      throw error;
    }
  }, []);

  // Memoized model hashes
  const modelHashes = useMemo(() => ({
    m1: 'models/face_landmark_68_model-shard1',
    m2: 'models/face_recognition_model-shard1',
    m3: 'models/face_recognition_model-shard2',
    m4: 'models/ssd_mobilenetv1_model-shard1',
    m5: 'models/ssd_mobilenetv1_model-shard2',
    w1: 'models/face_landmark_68_model-weights_manifest.json',
    w2: 'models/face_recognition_model-weights_manifest.json',
    w3: 'models/ssd_mobilenetv1_model-weights_manifest.json'
  }), []);

  useEffect(() => {
    let isBlinking = false;
    let interval;

    const detectBlink = async () => {
      try {
        const video = document.getElementById("videoInput");
        if (!video) return;

        const detections = await faceapi.detectSingleFace(video).withFaceLandmarks();
        if (!detections) return;

        const leftEye = detections.landmarks.getLeftEye();
        const rightEye = detections.landmarks.getRightEye();

        const leftEAR = calculateEyeAspectRatio(leftEye);
        const rightEAR = calculateEyeAspectRatio(rightEye);

        if (leftEAR > EAR_THRESHOLD && rightEAR > EAR_THRESHOLD) {
          if (!isBlinking) {
            isBlinking = true;
          }
        } else if (isBlinking) {
          setBlinkCount(prev => prev + 1);
          isBlinking = false;
        }
      } catch (error) {
        console.error("Error in blink detection:", error);
      }
    };

    if (videoRef && !loading) {
      interval = setInterval(detectBlink, BLINK_INTERVAL);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [loading, videoRef, calculateEyeAspectRatio]);

  const handleRegister = async () => {
    if (!validateEmail() || !validateUsername()) return;
    if (!consent) {
      setOpenSnackbar(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const video = document.getElementById("videoInput");
      const detections = await faceapi.detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (!detections) {
        throw new Error("No face detected. Please ensure your face is clearly visible.");
      }

      const userEmbedding = detections.descriptor;
      const hashes = await Promise.all(
        Object.entries(modelHashes).map(async ([key, path]) => ({
          [key]: await hashModelFile(path)
        }))
      );

      const hashObject = hashes.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      await axios.post(`${URL}/register`, {
        username,
        email,
        embedding: userEmbedding,
        hash: hashObject
      });

      authenticateFace(userEmbedding);
    } catch (error) {
      console.error("Registration error:", error);
      if (error.response?.status === 401) {
        setError("Username already registered");
      } else if (error.response?.status === 402) {
        setError("Hash mismatch, please refresh the page to fetch latest models");
      } else {
        setError(error.message || "An error occurred during registration. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Paper sx={{ margin: 6, padding: 4, textAlign: "center", alignItems: "center", border: "1px solid #888888", }}>

        <Typography
          variant="h4"
          sx={{
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: 4,
            paddingBottom: 4,
            borderBottom: "2px solid #888888",
            // color: "#1976d2",
          }}
        >
          Register
        </Typography>

        {loading ? (
          <CircularProgress sx={{ margin: 3 }} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "row", gap: 4 }}>
            {/* Left side: User info fields */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              {/* <Tooltip title="This application requires IndexedDB, Webcam access, and Fullscreen mode.">
                  <Typography color="textSecondary" sx={{ marginBottom: 2, textAlign: "left" }}>
                  Requirements:
                </Typography>
              </Tooltip> */}

              <Box>
                <TextField
                  fullWidth
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={validateUsername}
                  error={!!usernameError}
                  helperText={usernameError}
                  sx={{ marginBottom: 2 }}
                />

                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={validateEmail}
                  error={!!emailError}
                  helperText={emailError}
                  sx={{ marginBottom: 2 }}
                />
              </Box>

              <Box>
                <FormControlLabel
                  control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
                  label="I consent to the use of my face data for authentication purposes."
                  sx={{ marginBottom: 2, textAlign: "left" }}
                />

                <Button variant="contained" fullWidth onClick={startVideo} sx={{ marginBottom: 2 }}>
                  Start Video
                </Button>

              </Box>
            </Box>

            {/* Right side: Video and blink detection */}
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <video
                id="videoInput"
                width="100%"
                height="360"
                autoPlay
                style={{ borderRadius: 8, marginBottom: 2 }}
                ref={(ref) => ref && ref.srcObject !== videoRef ? (ref.srcObject = videoRef) : null}
              />

              <Typography variant="body1" sx={{ marginBottom: 2 }}>
                {blinkCount < 2 ? `Blinked ${blinkCount}/2 times` : "Ready to register!"}
              </Typography>

              <Button
                variant="contained"
                fullWidth
                onClick={handleRegister}
                disabled={blinkCount < 2 || !consent || !!usernameError || !!emailError}
                sx={{
                  backgroundColor: blinkCount >= 2 && consent && !usernameError && !emailError ? "#1976d2" : "#9e9e9e",
                  color: "#fff",
                  marginBottom: 2
                }}
              >
                {blinkCount < 2 ? "Waiting for blinks..." : "Register"}
              </Button>
            </Box>
          </Box>
        )}

        {/* Snackbar alert for missing consent */}
        <Snackbar
          open={openSnackbar}
          autoHideDuration={3000}
          onClose={() => setOpenSnackbar(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setOpenSnackbar(false)} severity="warning" sx={{ width: '100%' }}>
            You must consent to use face data for registration.
          </Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
};

export default Register;
