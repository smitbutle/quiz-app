import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as faceapi from "face-api.js";
import Layout from '../Layout';
import Loader from '../Loader';
import Main from '../Main';
import Quiz from '../Quiz';
import Result from '../Result';
import axios from 'axios';
import { Box, Card, CardContent, Typography } from "@mui/material";
import { shuffle } from '../../utils';
import Register from '../FaceAuth/Register';
import { URL } from '../../consts';

// Constants
const MODEL_URL = process.env.PUBLIC_URL + '/models';
const DETECTION_INTERVAL = 2000;
const MAX_EMBEDDINGS = 5;

// Video component for face detection
const VideoFeed = React.memo(({ videoRef, numberOfFaces, isQuizStarted }) => (
  <Box sx={{ width: "20%", display: "flex", flexDirection: "column", alignItems: "center" }}>
    <Card sx={{ width: "100%", borderRadius: 2, boxShadow: 3, overflow: "hidden" }}>
      <CardContent>
        <Box sx={{ position: "relative", width: "100%" }}>
          <video
            id="videoInput"
            width="100%"
            autoPlay
            style={{ borderRadius: 8, objectFit: "cover" }}
            ref={(ref) => (ref && ref.srcObject !== videoRef ? (ref.srcObject = videoRef) : null)}
          />
        </Box>
        {isQuizStarted && (
          <Typography 
            variant="h7" 
            color={numberOfFaces === 0 ? "error" : numberOfFaces === 1 ? "success" : "error"}
          >
            {numberOfFaces === 0 
              ? "Face not detected."
              : numberOfFaces === 1 
                ? "Face detected."
                : "Multiple face detected, this incident will be reported."}
          </Typography>
        )}
      </CardContent>
    </Card>
  </Box>
));

// Main content component
const MainContent = React.memo(({ 
  isQuizStarted, 
  isQuizCompleted, 
  loading, 
  data, 
  countdownTime, 
  startQuiz, 
  endQuiz 
}) => (
  <Box sx={{ flex: 1, marginRight: 3, width: "80%" }}>
    {!loading && !isQuizStarted && !isQuizCompleted && (
      <Main startQuiz={startQuiz} />
    )}
    {!loading && isQuizStarted && (
      <Quiz data={data} countdownTime={countdownTime} endQuiz={endQuiz} />
    )}
  </Box>
));

const App = () => {
  // State management
  const [state, setState] = useState({
    loading: false,
    loadingMessage: null,
    data: null,
    countdownTime: null,
    isQuizStarted: false,
    isQuizCompleted: false,
    isFaceRegistered: false,
    resultData: null,
    videoRef: null,
    faceDetected: false,
    username: "",
    attempt_id: "",
    numberOfFaces: 0,
    reportData: null
  });

  // Memoized arrays for face detection
  const embeddingsPacketArray = useMemo(() => [], []);
  const timeStapArray = useMemo(() => [], []);

  // Update state helper
  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Load models
  const loadModels = useCallback(async () => {
    updateState({ loading: true });
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      ]);
      console.log("Models loaded successfully");
    } catch (error) {
      console.error("Error loading models:", error);
      throw error;
    } finally {
      updateState({ loading: false });
    }
  }, [updateState]);

  // Video handling functions
  const startVideo = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then((stream) => {
        updateState({ videoRef: stream });
        console.log('video started', stream.id);
      })
      .catch(error => {
        console.error('Error accessing camera:', error);
      });
  }, [updateState]);

  const stopVideo = useCallback(() => {
    if (state.videoRef) {
      state.videoRef.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping video track:', e);
        }
      });
    }
    updateState({ videoRef: null });
  }, [state.videoRef, updateState]);

  // API calls
  const startTest = useCallback(async (username, testName) => {
    try {
      const response = await axios.post(`${URL}/starttest`, {
        username,
        test_name: testName
      });
      updateState({ attempt_id: response.data.test_id });
    } catch (error) {
      console.error('Error starting test:', error.response?.data || error.message);
      throw error;
    }
  }, [updateState]);

  const submitAttempt = useCallback(async (username, testId, embeddingsArray, timeStapArray) => {
    try {
      await axios.post(`${URL}/submitattempt`, {
        username,
        test_id: testId,
        embeddingsArray,
        timeStapArray
      });
    } catch (error) {
      console.error('Error submitting attempt:', error.response?.data || error.message);
      throw error;
    }
  }, []);

  const getReport = useCallback(async (username, testId) => {
    try {
      const response = await axios.post(`${URL}/getreport`, {
        username,
        test_id: testId
      });
      updateState({ reportData: response.data });
    } catch (error) {
      console.error('Error getting report:', error.response?.data || error.message);
      throw error;
    }
  }, [updateState]);

  // Quiz control functions
  const startQuiz = useCallback((data, countdownTime) => {
    updateState({
      loading: true,
      loadingMessage: {
        title: 'Loading your quiz...',
        message: "It won't be long!",
      }
    });
    
    startTest(state.username, "Math Exam");
    updateState({ countdownTime });
    
    setTimeout(() => {
      updateState({
        data,
        isQuizStarted: true,
        loading: false
      });
    }, 1000);
  }, [state.username, startTest, updateState]);

  const endQuiz = useCallback((resultData) => {
    stopVideo();
    updateState({
      loading: true,
      loadingMessage: {
        title: 'Fetching your results...',
        message: 'Just a moment!',
      }
    });
    
    getReport(state.username, state.attempt_id);

    setTimeout(() => {
      updateState({
        isQuizStarted: false,
        isQuizCompleted: true,
        resultData,
        loading: false
      });
    }, 2000);
  }, [state.username, state.attempt_id, stopVideo, getReport, updateState]);

  const replayQuiz = useCallback(() => {
    updateState({
      loading: true,
      loadingMessage: {
        title: 'Getting ready for round two.',
        message: "It won't take long!",
      }
    });

    const shuffledData = shuffle(state.data);
    shuffledData.forEach(element => {
      element.options = shuffle(element.options);
    });

    setTimeout(() => {
      updateState({
        data: shuffledData,
        isQuizStarted: true,
        isQuizCompleted: false,
        resultData: null,
        loading: false
      });
      startVideo();
    }, 1000);
  }, [state.data, startVideo, updateState]);

  const resetQuiz = useCallback(() => {
    updateState({
      loading: true,
      loadingMessage: {
        title: 'Loading the home screen.',
        message: 'Thank you for playing!',
      }
    });

    setTimeout(() => {
      updateState({
        data: null,
        countdownTime: null,
        isQuizStarted: false,
        isQuizCompleted: false,
        resultData: null,
        loading: false
      });
      startVideo();
    }, 1000);
  }, [startVideo, updateState]);

  const authenticateFace = useCallback(() => {
    updateState({ isFaceRegistered: true });
  }, [updateState]);

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Face detection effect
  useEffect(() => {
    let interval;
    if (state.videoRef && !state.loading && state.isFaceRegistered)
      interval = setInterval(async () => {
        try {
          const video = document.getElementById("videoInput");
          const detections = await faceapi
            .detectAllFaces(video)
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (detections) {
            // Capture and store image
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg');
            const timestamp = new Date().getTime();
            
            // Store in localStorage with timestamp as key
            localStorage.setItem(`face_auth_${timestamp}`, imageData);

            if (detections.length > 1) {
              embeddingsPacketArray.push("X");
              timeStapArray.push(timestamp);
              updateState({ numberOfFaces: detections.length });
            } else if (detections.length === 1) {
              embeddingsPacketArray.push(detections[0].descriptor);
              timeStapArray.push(timestamp);
              updateState({ numberOfFaces: 1 });
            } else {
              embeddingsPacketArray.push(null);
              timeStapArray.push(timestamp);
              updateState({ numberOfFaces: 0 });
            }

            if (embeddingsPacketArray.length === MAX_EMBEDDINGS) {
              await submitAttempt(state.username, state.attempt_id, embeddingsPacketArray, timeStapArray);
              embeddingsPacketArray.length = 0;
              timeStapArray.length = 0;
            }
          }
        } catch (error) {
          console.error('Error in face detection:', error);
        }
      }, DETECTION_INTERVAL);
    return () => clearInterval(interval);
  }, [state.videoRef, state.loading, state.isFaceRegistered, state.username, state.attempt_id, submitAttempt, updateState]);

  return (
    <Layout>
      {state.loading && <Loader {...state.loadingMessage} />}

      {!state.loading && !state.isQuizStarted && !state.isQuizCompleted && !state.isFaceRegistered && (
        <Register 
          authenticateFace={authenticateFace} 
          startVideo={startVideo} 
          videoRef={state.videoRef} 
          username={state.username} 
          setUsername={(username) => updateState({ username })} 
        />
      )}

      {state.isFaceRegistered && (
        <Box sx={{ display: "flex", flexDirection: "row", width: "100vw", padding: 3 }}>
          <MainContent
            isQuizStarted={state.isQuizStarted}
            isQuizCompleted={state.isQuizCompleted}
            loading={state.loading}
            data={state.data}
            countdownTime={state.countdownTime}
            startQuiz={startQuiz}
            endQuiz={endQuiz}
          />

          {!state.isQuizCompleted && !state.loading && (
            <VideoFeed
              videoRef={state.videoRef}
              numberOfFaces={state.numberOfFaces}
              isQuizStarted={state.isQuizStarted}
            />
          )}
        </Box>
      )}

      {!state.loading && state.isQuizCompleted && (
        <Result 
          {...state.resultData} 
          replayQuiz={replayQuiz} 
          resetQuiz={resetQuiz} 
          reportData={state.reportData} 
        />
      )}
    </Layout>
  );
};

export default App;
