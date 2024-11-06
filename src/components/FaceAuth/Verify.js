import React, { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { Button, TextField, Box, Typography, CircularProgress, Paper } from '@mui/material';
import axios from 'axios';

const Verify = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  // One time executes and loads the model from the server
  useEffect(() => {
    async function loadModels() {
      setLoading(true);
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models')
        ]);
      } catch (error) {
        console.error('Error loading models:', error);
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, []);

  const handleVerify = async () => {
    const video = document.getElementById('videoInput');
    const detections = await faceapi.detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detections) {
      const currentEmbedding = detections.descriptor;

      try {
        const response = await axios.post('http://localhost:5000/verify', {
          username,
          currentEmbedding,
        });
        if (response.data.isVerified) {
          alert('Face verified successfully!');
        } else {
          alert('Face verification failed.');
        }
      } catch (error) {
        console.error('Error during verification:', error);
        alert('Verification error.');
      }
    } else {
      console.error('No face detected');
    }
  };

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then((stream) => {
        const video = document.getElementById('videoInput');
        video.srcObject = stream;
        video.play();
      })
      .catch((err) => {
        console.error('Error accessing webcam:', err);
      });
  };

  return (
    <Paper sx={{ padding: 4, maxWidth: 480, textAlign: 'center' }}>
      <Typography variant="h5">Verify</Typography>
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
          <video
            id="videoInput"
            width="100%"
            height="360"
            autoPlay
            style={{ borderRadius: 8, marginBottom: 2 }}
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleVerify}
            sx={{ backgroundColor: '#1976d2', color: '#fff', marginTop: 2 }}
          >
            Verify
          </Button>
        </>
      )}
    </Paper>
  );
};

export default Verify;
