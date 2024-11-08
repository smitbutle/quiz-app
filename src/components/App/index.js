import React, { useState, useEffect } from 'react';
import * as faceapi from "face-api.js";
import Layout from '../Layout';
import Loader from '../Loader';
import Main from '../Main';
import Quiz from '../Quiz';
import Result from '../Result';
import axios from 'axios';
import { Box, Card, CardContent, Typography, IconButton } from "@mui/material";

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
  const [username, setUsername] = useState("");
  const [attempt_id, setAttemptId] = useState("");

  // const [livenessDetected, setLivenessDetected] = useState(false);
  useEffect(() => {
    const loadModels = async () => {
      setLoading(true)
      const MODEL_URL = process.env.PUBLIC_URL + '/models'
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      setLoading(false)
    };
    loadModels();
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} }).then((stream) => {
      setVideoRef(stream);
      console.log('video started', stream.id);
    });
  };

  const stopVideo = () => {
    console.log('stopping video');
    if (videoRef) {

      videoRef.getTracks().forEach((track) => {
        try {
          console.log(`Track ID: ${track.id}, Kind: ${track.kind}, Ready State: ${track.readyState}`);
          track.stop();
          console.log(`After stopping, Ready State: ${track.readyState}`);
        }
        catch (e) { console.log(e) }
        });
    };

    setVideoRef(null);
  };

  async function startTest(username, testName) {
    try {
      const response = await axios.post('http://localhost:5000/starttest', {
        username,
        test_name: testName
      });
      console.log(response.data);
      // Output: { message: 'Test started successfully', test_id: <generated_test_id> }
      setAttemptId(response.data.test_id);

    } catch (error) {
      console.error(error.response ? error.response.data : error.message);
    }
  }

  async function submitAttempt(username, testId, embeddingsArray) {
    try {
      const response = await axios.post('http://localhost:5000/submitattempt', {
        username,
        test_id: testId,
        embeddingsArray
      });
      console.log(response.data); // Output: { success: true, results: [{ embedding: ..., score: ... }, ...] }
    } catch (error) {
      console.error(error.response ? error.response.data : error.message);
    }
  }

  const [reportData, setReportData] = useState(null);

async function getReport(username, testId) {
  try {
    const response = await axios.post('http://localhost:5000/getreport', {
      username,
      test_id: testId
    });
    setReportData(response.data);
    
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
  }
}
  const startQuiz = (data, countdownTime) => {
    setLoading(true);
    setLoadingMessage({
      title: 'Loading your quiz...',
      message: "It won't be long!",
    });
    startTest(username, "Math Exam");
    setCountdownTime(countdownTime);
    setTimeout(() => {
      setData(data);
      setIsQuizStarted(true);
      setLoading(false);
    }, 1000);
  };

  const endQuiz = resultData => {

    stopVideo();
    setLoading(true);
    getReport(username, attempt_id);
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
      startVideo();
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
      startVideo();
    }, 1000);
  };


  const authenticateFace = async () => {
    setIsFaceRegistered(true);
  }
  

  const embeddingsPacketArray = [];

  useEffect(() => {
    let interval;
    if (videoRef && !loading) {
      interval = setInterval(async () => {
        const video = document.getElementById("videoInput");

        const detections = await faceapi
          .detectSingleFace(video)
          .withFaceLandmarks().withFaceDescriptor();

        if (detections) {
          setFaceDetected(true);
          embeddingsPacketArray.push(detections.descriptor);
          
        } else {
          embeddingsPacketArray.push(null);
          setFaceDetected(false);
        }

        if (embeddingsPacketArray.length === 5) {
          submitAttempt(username, attempt_id, embeddingsPacketArray);
          embeddingsPacketArray.length = 0;
        }
        
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [videoRef, loading]);



  return (
    <Layout>
      {/* Display Loader while loading */}
      {loading && <Loader {...loadingMessage} />}

      {/* Display Register component if not loading and not registered */}
      {!loading && !isQuizStarted && !isQuizCompleted && !isFaceRegistered && (
        <Register authenticateFace={authenticateFace} startVideo={startVideo} videoRef={videoRef} username={username} setUsername={setUsername}/>
      )}

      {/* Display main quiz content if face is registered */}
      {isFaceRegistered && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            // height: "100vh", // Full viewport height
            width: "100vw", // Full viewport width
            padding: 3,
          }}
        >
          {/* Left section for main content */}
          <Box sx={{ flex: 1, marginRight: 3, width: "80%" }}>
            {!loading && !isQuizStarted && !isQuizCompleted && (
              <Main startQuiz={startQuiz} />
            )}
            {!loading && isQuizStarted && (
              <Quiz data={data} countdownTime={countdownTime} endQuiz={endQuiz} />
            )}
          </Box>

          {!isQuizCompleted && !loading && (
            <Box
              sx={{
                width: "20%", 
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
                  <Box sx={{ position: "relative", width: "100%" }}>
                    <video
                      id="videoInput"
                      width="100%"
                      autoPlay
                      style={{ borderRadius: 8, objectFit: "cover" }}
                      ref={(ref) =>
                        (ref && ref.srcObject !== videoRef ? (ref.srcObject = videoRef) : null)}
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
          )}
        </Box>
      )}

      {/* Display Result component if quiz is completed */}
      {!loading && isQuizCompleted && (
        <Result {...resultData} replayQuiz={replayQuiz} resetQuiz={resetQuiz} reportData={reportData}/>
      )}
    </Layout>

  );
};

export default App;
