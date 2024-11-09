import React, { useState, useEffect } from "react";
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

const MODEL_STORE_NAME = "face-api-models";
const MODEL_KEYS = [
  "ssdMobilenetv1",
  "faceRecognitionNet",
  "faceLandmark68Net",
];

const Register = ({
  authenticateFace,
  startVideo,
  videoRef,
  username,
  setUsername,
}) => {
  const [loading, setLoading] = useState(true);
  const [blinkCount, setBlinkCount] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    async function loadModels() {
      setLoading(true);
      try {
        const modelsFromDB = await loadModelsFromIndexedDB();
        if (!modelsFromDB) {
          await Promise.all([
            loadAndCacheModel(
              "ssdMobilenetv1",
              "/models/ssd_mobilenetv1_model-weights_manifest.json"
            ),
            loadAndCacheModel(
              "faceRecognitionNet",
              "/models/face_recognition_model-weights_manifest.json"
            ),
            loadAndCacheModel(
              "faceLandmark68Net",
              "/models/face_landmark_68_model-weights_manifest.json"
            ),
          ]);
        }
        console.log("Models loaded");
      } catch (error) {
        console.error("Error loading models:", error);
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, []);

  const loadAndCacheModel = async (modelKey, modelUrl) => {
    try {
      const response = await fetch(modelUrl);
      const blob = await response.blob();
      await saveModelToIndexedDB(modelKey, blob);
      await faceapi.nets[modelKey].loadFromUri(
        process.env.PUBLIC_URL + "/models"
      );
    } catch (error) {
      console.error(`Error loading or caching model ${modelKey}:`, error);
    }
  };

  async function loadModelsFromIndexedDB() {
    if (!("indexedDB" in window)) {
      console.warn("IndexedDB not supported.");
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(MODEL_STORE_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore("models");
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction("models", "readonly");
        const store = transaction.objectStore("models");

        const modelPromises = MODEL_KEYS.map((key) => {
          return new Promise((resolve) => {
            const getRequest = store.get(key);
            getRequest.onsuccess = () => {
              resolve(getRequest.result);
            };
            getRequest.onerror = () => {
              console.warn(`Failed to retrieve model ${key} from IndexedDB`);
              resolve(null);
            };
          });
        });

        Promise.all(modelPromises).then((models) => {
          if (models.some((model) => !model)) resolve(false);
          else resolve(true);
        });
      };

      request.onerror = () => reject("Failed to open IndexedDB.");
    });
  }

  async function saveModelToIndexedDB(modelKey, blob) {
    if (!("indexedDB" in window)) return;

    const dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(MODEL_STORE_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore("models");
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => reject("Failed to open IndexedDB.");
    });

    const db = await dbPromise;
    const transaction = db.transaction("models", "readwrite");
    const store = transaction.objectStore("models");

    store.put(blob, modelKey);
    await transaction.complete;
  }

  const detectBlinks = async () => {
    if (videoRef && !loading) {
      const video = document.getElementById("videoInput");
      const detections = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks();

      if (detections) {
        const leftEye = detections.landmarks.getLeftEye();
        const rightEye = detections.landmarks.getRightEye();

        const eyeAspectRatio = (eye) => {
          const width = Math.hypot(eye[3].x - eye[0].x, eye[3].y - eye[0].y);
          const height =
            Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y) +
            Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
          return width / (height / 2);
        };

        const leftEAR = eyeAspectRatio(leftEye);
        const rightEAR = eyeAspectRatio(rightEye);
        const EAR_THRESHOLD = 3.7;

        if (
          leftEAR > EAR_THRESHOLD &&
          rightEAR > EAR_THRESHOLD &&
          !isBlinking
        ) {
          setIsBlinking(true);
        } else if (
          leftEAR <= EAR_THRESHOLD &&
          rightEAR <= EAR_THRESHOLD &&
          isBlinking
        ) {
          setBlinkCount((count) => count + 1);
          setIsBlinking(false);
        }
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(detectBlinks, 200);
    return () => clearInterval(interval);
  }, [loading, videoRef, isBlinking]);

  useEffect(() => {
    if (blinkCount >= 2) {
      console.log("Blink count met: Button enabled");
    }
  }, [blinkCount]);

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
        await axios.post("http://localhost:5000/register", {
          username,
          embedding: userEmbedding,
        });
        authenticateFace(userEmbedding);
      }
    } catch (error) {
      console.error(error.response ? error.response.data : error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
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
            <Button
              variant="contained"
              fullWidth
              onClick={startVideo}
              sx={{ marginBottom: 2 }}
            >
              Start Video
            </Button>
            <div style={{ position: "relative" }}>
              <video
                id="videoInput"
                width="100%"
                height="360"
                autoPlay
                style={{ borderRadius: 8, marginBottom: 2 }}
                ref={(ref) =>
                  ref && ref.srcObject !== videoRef
                    ? (ref.srcObject = videoRef)
                    : null
                }
              />
            </div>
            {blinkCount < 2 && (
              <Typography variant="body1" sx={{ margin: 2 }}>
                Blink your eyes twice to register.
              </Typography>
            )}
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
