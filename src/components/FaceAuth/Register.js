import React, { useState, useEffect } from "react";
import { Box, Paper, Typography, TextField, Button, CircularProgress, Checkbox, FormControlLabel, Tooltip, Alert, Snackbar } from "@mui/material";
import axios from "axios";
import * as faceapi from "face-api.js";
import { URL } from '../../consts';
import * as ecies from 'ecies-parity';
import * as CryptoJS from 'crypto-js';
import base64 from 'base-64';

const Register = ({ authenticateFace, startVideo, videoRef, username, setUsername }) => {
  const [loading, setLoading] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);

  useEffect(() => {
    let isBlinking = false;
    let interval;
    if (videoRef && !loading) {
      interval = setInterval(async () => {
        const video = document.getElementById("videoInput");
        const detections = await faceapi.detectSingleFace(video).withFaceLandmarks();

        if (detections) {
          const leftEye = detections.landmarks.getLeftEye();
          const rightEye = detections.landmarks.getRightEye();

          // Simple blink detection based on eye landmarks
          const eyeAspectRatio = (eye) => {
            const width = Math.hypot(eye[3].x - eye[0].x, eye[3].y - eye[0].y);
            const height = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y) + Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
            return width / (height / 2);
          };

          const leftEAR = eyeAspectRatio(leftEye);
          const rightEAR = eyeAspectRatio(rightEye);
          const EAR_THRESHOLD = 3.7; // Threshold for detecting a blink

          if (leftEAR > EAR_THRESHOLD && rightEAR > EAR_THRESHOLD) {
            if (!isBlinking) {
              isBlinking = true;
            }
          } else {
            if (isBlinking) {
              setBlinkCount((blinkCount) => blinkCount + 1);
              isBlinking = false; // Reset blink status
            }
          }
        }
      }, 200);
    }
    return () => clearInterval(interval);
  }, [loading, videoRef]);

  // Handle field validations
  const validateEmail = () => {
    if (!email) {
      setEmailError("Email is required.");
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validateUsername = () => {
    if (!username) {
      setUsernameError("Username is required.");
      return false;
    } else if (username.length < 3) {
      setUsernameError("Username must be at least 3 characters long.");
      return false;
    }
    setUsernameError("");
    return true;
  };


  const hashModelFile = async (filePath, algorithm = 'SHA-256') => {
    const file = await fetch(process.env.PUBLIC_URL + '/' + filePath); // Load file
    const buffer = await file.arrayBuffer(); // Read file as ArrayBuffer
    const hashBuffer = await crypto.subtle.digest(algorithm, buffer); // Use Web Crypto API
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert to array of bytes
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join(''); // Convert to hex
    console.log(hashHex);
    return hashHex;
  };

  const encrypt_using_server_public_key = async (userEmbedding) => {
    try {
        console.log("Embedding: ", userEmbedding);

        // Fetch the public key from the server
        const response = await axios.get(`${URL}/getpubkey`);

        if (response.status !== 200 || !response.data.publicKey) {
            console.error("Error fetching public key:", response);
            return ""; // Fallback in case of error
        }

        const publicKeyHex = response.data.publicKey.trim(); // Trim extra spaces
        console.log("Public Key: ", publicKeyHex);

        // 1️⃣ Generate a random 256-bit AES key
        const aesKey = CryptoJS.lib.WordArray.random(32); // 32 bytes = 256 bits

        // 2️⃣ Encrypt the AES key using ECC (ECIES)
        const encryptedAesKey = ecies.encrypt(Buffer.from(publicKeyHex, 'hex'), Buffer.from(aesKey.toString(CryptoJS.enc.Hex), 'hex'));
        const encryptedAesKeyBase64 = base64.encode(encryptedAesKey); // Convert to base64

        // 3️⃣ Generate a random IV (nonce) for AES-GCM
        const iv = CryptoJS.lib.WordArray.random(12); // 12 bytes IV for AES-GCM

        // 4️⃣ Encrypt user embedding using AES-GCM
        const cipher = CryptoJS.AES.encrypt(CryptoJS.lib.WordArray.create(userEmbedding), aesKey, { iv: iv, mode: CryptoJS.mode.GCM });

        // 5️⃣ Convert IV and encrypted data to base64
        const ivBase64 = base64.encode(Buffer.from(iv.toString(CryptoJS.enc.Hex), 'hex'));
        const encryptedEmbeddingBase64 = base64.encode(Buffer.from(cipher.ciphertext.toString(CryptoJS.enc.Hex), 'hex'));

        return { encrypted_aes_key: encryptedAesKeyBase64, iv: ivBase64, embedding: encryptedEmbeddingBase64 };

    } catch (error) {
        console.error("Error during encryption:", error);
        return null;
    }
};

  const handleRegister = async () => {
    if (!validateEmail() || !validateUsername()) return;
    if (!consent) {
      setOpenSnackbar(true);
      return;
    }
  
    setLoading(true);
    try {
      const video = document.getElementById("videoInput");
      const detections = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
  
      if (detections) {
        const userEmbedding = detections.descriptor;
  
        //  Encrypt the user embedding using the new function
        const encryptedData = await encrypt_using_server_public_key(userEmbedding);
  
        if (!encryptedData) {
          alert("Encryption failed. Try again.");
          return;
        }
  
        await axios.post(`${URL}/register`, {
          username,
          email,
          encrypted_aes_key: encryptedData.encrypted_aes_key, // Encrypted AES key
          iv: encryptedData.iv, // IV (nonce)
          embedding: encryptedData.embedding, // Encrypted embedding
          hash: {
            m1: await hashModelFile('models/face_landmark_68_model-shard1'),
            m2: await hashModelFile('models/face_recognition_model-shard1'),
            m3: await hashModelFile('models/face_recognition_model-shard2'),
            m4: await hashModelFile('models/ssd_mobilenetv1_model-shard1'),
            m5: await hashModelFile('models/ssd_mobilenetv1_model-shard2'),
            w1: await hashModelFile('models/face_landmark_68_model-weights_manifest.json'),
            w2: await hashModelFile('models/face_recognition_model-weights_manifest.json'),
            w3: await hashModelFile('models/ssd_mobilenetv1_model-weights_manifest.json')
          }
        });
  
        authenticateFace(userEmbedding); // This should use the raw embedding, not encrypted one
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        alert("User already registered");
      } else {
        console.error("An error occurred during registration:", error);
        alert("An error occurred during registration. Please try again.");
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
