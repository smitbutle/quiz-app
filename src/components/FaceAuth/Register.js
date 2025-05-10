import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Alert,
  Snackbar,
  Grid,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  useTheme,
  alpha
} from "@mui/material";
import {
  Face as FaceIcon,
  Camera as CameraIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import axios from "axios";
import * as faceapi from "face-api.js";
import { URL } from '../../consts';

const EAR_THRESHOLD = 3.7;
const BLINK_INTERVAL = 200;

const Register = ({ authenticateFace, startVideo, videoRef, username, setUsername }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [cameraAccess, setCameraAccess] = useState(null); // null: not checked, true: granted, false: denied

  const steps = ['Enter Details', 'Start Camera', 'Face Verification'];

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

  const handleStartVideo = async () => {
    try {
      await startVideo();
      setCameraAccess(true);
      setActiveStep(2); // Move to face verification when camera starts successfully
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraAccess(false);
      setError("Camera access denied. Please allow camera access to continue.");
    }
  };

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

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={validateUsername}
                error={!!usernameError}
                helperText={usernameError}
                variant="outlined"
                InputProps={{
                  startAdornment: <FaceIcon sx={{ mr: 1, color: 'primary.main' }} />
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={validateEmail}
                error={!!emailError}
                helperText={emailError}
                variant="outlined"
                InputProps={{
                  startAdornment: <InfoIcon sx={{ mr: 1, color: 'primary.main' }} />
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    I consent to the use of my face data for authentication purposes.
                  </Typography>
                }
              />
            </Grid>
          </Grid>
        );
      case 1:
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {cameraAccess === false ? (
              <>
                <ErrorIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
                <Typography variant="h6" color="error" gutterBottom>
                  Camera Access Denied
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  To continue with face registration, you need to allow camera access.
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Please follow these steps:
                </Typography>
                <Box sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto', mb: 3 }}>
                  <Typography variant="body2" component="ol" sx={{ pl: 2 }}>
                    <li>Click the camera icon in your browser's address bar</li>
                    <li>Select "Allow" for camera access</li>
                    <li>Refresh the page</li>
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleStartVideo}
                  startIcon={<CameraIcon />}
                  sx={{ mt: 2 }}
                >
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <Typography variant="h6" gutterBottom>
                  Camera Access Required
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  To register your face, we need access to your camera.
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  You'll be prompted to allow camera access. This is necessary for:
                </Typography>
                <Box sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto', mb: 3 }}>
                  <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
                    <li>Face detection</li>
                    <li>Liveness detection</li>
                    <li>Creating your face profile</li>
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleStartVideo}
                  startIcon={<CameraIcon />}
                  sx={{ mt: 2 }}
                >
                  Start Camera
                </Button>
              </>
            )}
          </Box>
        );
      case 2:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <video
              id="videoInput"
              width="100%"
              height="360"
              autoPlay
              style={{
                borderRadius: 8,
                marginBottom: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              ref={(ref) => ref && ref.srcObject !== videoRef ? (ref.srcObject = videoRef) : null}
            />
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              {blinkCount < 2 ? (
                <>
                  <CircularProgress size={20} />
                  <Typography variant="body1" color="text.secondary">
                    Blinked {blinkCount}/2 times
                  </Typography>
                </>
              ) : (
                <>
                  <CheckCircleIcon color="success" />
                  <Typography variant="body1" color="success.main">
                    Ready to register!
                  </Typography>
                </>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Please blink twice to verify you are a real person
            </Typography>
          </Box>
        );
      default:
        return null;
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!validateEmail() || !validateUsername() || !consent) {
        if (!consent) setOpenSnackbar(true);
        return;
      }
    } else if (activeStep === 1) {
      if (!videoRef) {
        setError("Please start the camera first");
        return;
      }
    } else if (activeStep === 2) {
      if (blinkCount < 2) {
        setError("Please complete the blink verification");
        return;
      }
      // If blink verification is complete, proceed with registration
      handleRegister();
      return;
    }
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  return (
    <Box sx={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center",
      minHeight: '100vh',
      py: 4,
      background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.05)} 30%, ${alpha(theme.palette.primary.light, 0.05)} 90%)`
    }}>
      <Paper 
        elevation={3}
        sx={{ 
          width: '100%',
          maxWidth: 800,
          p: 4,
          borderRadius: 2,
          background: 'white'
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: "bold",
            textAlign: "center",
            mb: 4,
            pb: 2,
            borderBottom: `2px solid ${theme.palette.divider}`,
            color: theme.palette.primary.main
          }}
        >
          Face Registration
        </Typography>

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {getStepContent(activeStep)}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
                variant="outlined"
              >
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleRegister}
                  disabled={loading || blinkCount < 2}
                  startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                >
                  Register
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={activeStep === 1 && !videoRef}
                >
                  Next
                </Button>
              )}
            </Box>
          </>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ mt: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <Snackbar
          open={openSnackbar}
          autoHideDuration={3000}
          onClose={() => setOpenSnackbar(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setOpenSnackbar(false)} 
            severity="warning" 
            sx={{ width: '100%' }}
          >
            You must consent to use face data for registration.
          </Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
};

export default Register;
