import React, { useState, useEffect } from 'react';
import * as faceapi from "face-api.js";
import Layout from '../Layout';
import Loader from '../Loader';
import Main from '../Main';
import Quiz from '../Quiz';
import Result from '../Result';

import { Box, Card, CardContent, Typography, IconButton } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import { shuffle } from '../../utils';
import Register from '../FaceAuth/Register';

const App = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(null);
  const [data, setData] = useState(null);
  const [countdownTime, setCountdownTime] = useState(null);
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [isFaceRegistered, setIsFaceRegistered] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [videoRef, setVideoRef] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // const [livenessDetected, setLivenessDetected] = useState(false);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} }).then((stream) => {
      setVideoRef(stream);
    });
  };

  const startQuiz = (data, countdownTime) => {
    setLoading(true);
    setLoadingMessage({
      title: 'Loading your quiz...',
      message: "It won't be long!",
    });
    setCountdownTime(countdownTime);

    setTimeout(() => {
      setData(data);
      setIsQuizStarted(true);
      setLoading(false);
    }, 1000);
  };

  const endQuiz = resultData => {
    setLoading(true);
    setLoadingMessage({
      title: 'Fetching your results...',
      message: 'Just a moment!',
    });

    setTimeout(() => {
      setIsQuizStarted(false);
      setIsQuizCompleted(true);
      setResultData(resultData);
      setLoading(false);
    }, 2000);
  };

  const replayQuiz = () => {
    setLoading(true);
    setLoadingMessage({
      title: 'Getting ready for round two.',
      message: "It won't take long!",
    });

    const shuffledData = shuffle(data);
    shuffledData.forEach(element => {
      element.options = shuffle(element.options);
    });

    setData(shuffledData);

    setTimeout(() => {
      setIsQuizStarted(true);
      setIsQuizCompleted(false);
      setResultData(null);
      setLoading(false);
    }, 1000);
  };

  const resetQuiz = () => {
    setLoading(true);
    setLoadingMessage({
      title: 'Loading the home screen.',
      message: 'Thank you for playing!',
    });

    setTimeout(() => {
      setData(null);
      setCountdownTime(null);
      setIsQuizStarted(false);
      setIsQuizCompleted(false);
      setResultData(null);
      setLoading(false);
    }, 1000);
  };

  const authenticateFace = async () => {
    setIsFaceRegistered(true);
    startVideo();
  }



  useEffect(() => {
    let interval;
    if (videoRef) {
      // interval2 = setInterval(async () => {}, 500);
      interval = setInterval(async () => {
        const video = document.getElementById("videoInput");

        const detections = await faceapi
          .detectSingleFace(video)
          .withFaceLandmarks();

        if (detections) {
          setFaceDetected(true);
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

          console.log(leftEAR, rightEAR);

          // if (leftEAR > EAR_THRESHOLD && rightEAR > EAR_THRESHOLD) {
          //   // setLivenessDetected(true);
          //   console.log("eyes closed");
          // } else {
          // }
        } else {
          setFaceDetected(false);
        }

      }, 2000);
    }
    return () => clearInterval(interval);
  }, [videoRef]);



  return (
    <Layout>
      {/* Display Loader while loading */}
      {loading && <Loader {...loadingMessage} />}

      {/* Display Register component if not loading and not registered */}
      {!loading && !isQuizStarted && !isQuizCompleted && !isFaceRegistered && (
        <Register authenticateFace={authenticateFace} />
      )}

      {/* Display main quiz content if face is registered */}
      {isFaceRegistered && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            height: "100vh", // Full viewport height
            padding: 3,
          }}
        >
          {/* Left section for main content */}
          <Box sx={{ flex: 1, marginRight: 3 }}>
            {!loading && !isQuizStarted && !isQuizCompleted && (
              <Main startQuiz={startQuiz} />
            )}
            {!loading && isQuizStarted && (
              <Quiz data={data} countdownTime={countdownTime} endQuiz={endQuiz} />
            )}
          </Box>

          {/* Right section for the camera feed */}
          <Box
            sx={{
              width: 480, // Fixed width for the camera feed section
              minWidth: 320,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Card
              sx={{
                width: "100%",
                borderRadius: 2,
                boxShadow: 3,
                overflow: "hidden",
              }}
            >
              <CardContent>
                <Box sx={{ position: "relative", width: "100%", height: 240 }}>
                  <video
                    id="videoInput"
                    width="100%"
                    height="100%"
                    autoPlay
                    style={{ borderRadius: 8, objectFit: "cover" }}
                    ref={(ref) =>
                      ref && ref.srcObject !== videoRef
                        ? (ref.srcObject = videoRef)
                        : null
                    }
                  />
                </Box>

                {/* Display detection status */}
                {!faceDetected ? (
                  <Typography variant="h7" color="error">
                    Face not detected, this incident will be reported.
                  </Typography>
                ) : (
                  <Typography variant="h6" gutterBottom color="success">
                    Face detected.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Display Result component if quiz is completed */}
      {!loading && isQuizCompleted && (
        <Result {...resultData} replayQuiz={replayQuiz} resetQuiz={resetQuiz} />
      )}
    </Layout>

  );
};

export default App;
