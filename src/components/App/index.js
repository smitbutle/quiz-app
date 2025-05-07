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
import { URL } from '../../consts';


const MODEL_STORE_NAME = "face-api-models";
const MODEL_KEYS = [
  "ssdMobilenetv1",
  "faceRecognitionNet",
  "faceLandmark68Net",
];

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
  const [numberOfFaces, setNumberOfFaces] = useState(0);



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

      const loadModels = async () => {
        setLoading(true)
        const MODEL_URL = process.env.PUBLIC_URL + '/models'
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        setLoading(false)
      };
      loadModels();
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
          console.log("Models loaded and cached.");
        } else {
          console.log("Models loaded from IndexedDB.");
        }
      } catch (error) {
        console.error("Error loading models:", error);
      } finally {
        setLoading(false);
      }
    }
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
          // console.log(`Track ID: ${track.id}, Kind: ${track.kind}, Ready State: ${track.readyState}`);
          track.stop();
          // console.log(`After stopping, Ready State: ${track.readyState}`);
        }
        catch (e) { console.log(e) }
      });
    };

    setVideoRef(null);
  };

  async function startTest(username, testName) {
    try {
      const response = await axios.post(`${URL}/starttest`, {
        username,
        test_name: testName
      });
      // console.log(response.data);
      // Output: { message: 'Test started successfully', test_id: <generated_test_id> }
      setAttemptId(response.data.test_id);

    } catch (error) {
      console.error(error.response ? error.response.data : error.message);
    }
  }

  async function submitAttempt(username, testId, embeddingsArray, timeStapArray) {
    try {
      const response = await axios.post(`${URL}/submitattempt`, {
        username,
        test_id: testId,
        embeddingsArray,
        timeStapArray
      });
      // console.log(response.data); // Output: { success: true, results: [{ embedding: ..., score: ... }, ...] }
    } catch (error) {
      console.error(error.response ? error.response.data : error.message);
    }
  }

  const [reportData, setReportData] = useState(null);

  async function getReport(username, testId) {
    try {
      const response = await axios.post(`${URL}/getreport`, {
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
  const timeStapArray = [];

  useEffect(() => {
    let interval;
    if (videoRef && !loading && isFaceRegistered) {
      interval = setInterval(async () => {
        const video = document.getElementById("videoInput");

        const detections = await faceapi
          .detectAllFaces(video)
          .withFaceLandmarks()
          .withFaceDescriptors();

        // Check if more than one face is detected
        if (detections) {

          if (detections.length > 1) {
            console.log("More than one face detected");
            embeddingsPacketArray.push("X");
            timeStapArray.push(new Date().getTime());
            setNumberOfFaces(detections.length);
          } else if (detections.length === 1) {
            console.log("Only one face detected");
            embeddingsPacketArray.push(detections[0].descriptor);
            timeStapArray.push(new Date().getTime());
            setNumberOfFaces(1);

          } else {
            console.log("No faces detected");
            embeddingsPacketArray.push(null);
            timeStapArray.push(new Date().getTime());
            setNumberOfFaces(0);
          }
        }

        if (embeddingsPacketArray.length === 5) {
          submitAttempt(username, attempt_id, embeddingsPacketArray, timeStapArray);
          embeddingsPacketArray.length = 0;
          timeStapArray.length = 0;
        }

      }, 2000);
    }
    return () => clearInterval(interval);
  }, [videoRef, loading]);

  const buzz = () => {
    const audioCtx = new window.AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();

    setTimeout(() => {
      oscillator.stop();
      audioCtx.close();
    }, 1000);
  };

  // Buzzer only goes on when no face or multiple faces detected
  // It just buzzes for 1 second and goes silent
  // When face is detected no buzzer but the above process continues thereafter for violation
  useEffect(() => {
    if (isQuizStarted && (numberOfFaces === 0 || numberOfFaces > 1)) {
      buzz();
    }
  }, [isQuizStarted, numberOfFaces]);

  return (
    <Layout>
      {/* Display Loader while loading */}
      {loading && <Loader {...loadingMessage} />}

      {/* Display Register component if not loading and not registered */}
      {!loading && !isQuizStarted && !isQuizCompleted && !isFaceRegistered && (
        <Register authenticateFace={authenticateFace} startVideo={startVideo} videoRef={videoRef} username={username} setUsername={setUsername} />
      )}

      {/* Display main quiz content if face is registered */}
      {isFaceRegistered && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
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
                  {isQuizStarted ? (numberOfFaces === 0 ? (
                    <Typography variant="h7" color="error">
                      Face not detected.
                    </Typography>
                  ) : (
                    numberOfFaces === 1 ? (
                      <Typography variant="h7" color="success">
                        Face detected.
                      </Typography>
                    ) : (
                      <Typography variant="h7" color="error">
                        Multiple face detected, this incident will be reported.
                      </Typography>
                    )
                  )) :
                    <Typography variant="h7" color="success">
                    </Typography>}
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      )}

      {/* Display Result component if quiz is completed */}
      {!loading && isQuizCompleted && (
        <Result {...resultData} replayQuiz={replayQuiz} resetQuiz={resetQuiz} reportData={reportData} />
      )}
    </Layout>

  );
};

export default App;
