
const embeddings = []

const sendEmbeddingsToServer = async () => {
    try {
        // Send the embeddings array to the server
        const response = await fetch("/bulkverify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ embeddings })
        });

        if (response.ok) {
            console.log("Embeddings sent successfully");
        } else {
            console.log("Failed to send embeddings");
        }
    } catch (error) {
        console.log("Error sending embeddings:", error);
    }
};


const createEmbeddingsPacket = async () => {
    try {
        const video = document.getElementById("videoInput");
        const detections = await faceapi
            .detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detections) {
            // Add the embedding to the array
            embeddings.push(detections.descriptor);

            // Check if we have collected 5 embeddings
            if (embeddings.length === 5) {
                await sendEmbeddingsToServer(); // Send to server
                embeddings.length = 0; // Clear the array after sending
            }
        }
    } catch (error) {
        console.log("Error during registration:", error);
    }
};

