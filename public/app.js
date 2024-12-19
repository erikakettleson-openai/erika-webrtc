const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const sendEventBtn = document.getElementById("sendEventBtn");
const updateInstructionsBtn = document.getElementById("updateInstructionsBtn");
const eventTextInput = document.getElementById("eventTextInput");
const instructionTextInput = document.getElementById("instructionTextInput");
const imageUpload = document.getElementById("imageUpload");
const uploadImageBtn = document.getElementById("uploadImageBtn");
const uploadedImage = document.getElementById("uploadedImage");
const eventsContainer = document.getElementById("eventsContainer");

let pc; // WebRTC PeerConnection
let dataChannel; // WebRTC Data Channel
let localStream;

async function init() {
  try {
    statusEl.textContent = "Fetching session...";
    // Step 1: Fetch ephemeral key from server
    const tokenResponse = await fetch("http://localhost:3000/session");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // Step 2: Set up WebRTC connection
    pc = new RTCPeerConnection();

    // Handle remote audio track
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    pc.ontrack = (e) => audioEl.srcObject = e.streams[0];
    document.body.appendChild(audioEl);

    // Step 3: Capture user audio
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(localStream.getTracks()[0], localStream);

    // Step 4: Create Data Channel for sending/receiving messages
    dataChannel = pc.createDataChannel("oai-events");

    dataChannel.addEventListener("message", (e) => {
      const realtimeEvent = JSON.parse(e.data);
      console.log("Received event:", realtimeEvent);

      if (realtimeEvent.type === "response.audio_transcript.delta") {
        return;
      }

      // Display the event on the page at the top
      const eventElement = document.createElement("pre");
      eventElement.className = "json-format";
      eventElement.textContent = `Received event: ${JSON.stringify(realtimeEvent, null, 2)}`;
      eventsContainer.insertBefore(eventElement, eventsContainer.firstChild);
    });

    // Step 5: SDP Negotiation
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const baseUrl = "https://api.openai.com/v1/realtime";
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = { type: "answer", sdp: await sdpResponse.text() };
    await pc.setRemoteDescription(answer);

    statusEl.textContent = "Connected to Realtime API!";
  } catch (err) {
    console.error("Error initializing connection:", err);
    statusEl.textContent = "Error connecting!";
  }
}

function startRecording() {
  init();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  sendEventBtn.disabled = false;
  eventTextInput.disabled = false;
  imageUpload.disabled = false;
  uploadImageBtn.disabled = false;
}

function stopRecording() {
  // Clean up WebRTC connection
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  statusEl.textContent = "Connection closed.";
  startBtn.disabled = false;
  stopBtn.disabled = true;
  sendEventBtn.disabled = true;
  eventTextInput.disabled = true;
  imageUpload.disabled = true;
  uploadImageBtn.disabled = true;
}

function sendClientEvent() {
  const textValue = eventTextInput.value;
  if (dataChannel && dataChannel.readyState === "open") {
    const clientEvent = {
      event_id: "event_onsendEventBtnclick",
      type: "conversation.item.create",
      previous_item_id: null,
      item: {
        id: "msg_001",
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: textValue
          }
        ]
      }
    };
    dataChannel.send(JSON.stringify(clientEvent));
    console.log("Client event sent with text:", textValue);
  } else {
    console.error("Data channel is not open");
  }
}

function uploadImage() {
  const file = imageUpload.files[0];
  if (!file) {
    console.error("No image selected");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    const imageData = event.target.result;
    uploadedImage.src = imageData;
    uploadedImage.style.display = 'block';
    console.log("Image uploaded:", imageData);

    fetch("http://localhost:3000/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageData })
    })
    .then(response => response.json())
    .then(data => {
      console.log("Response from server:", data);
      const responseElement = document.createElement('p');
      const imageDescription = data.choices && data.choices.length > 0 
        ? data.choices[0].message.content 
        : "No description available.";
      responseElement.textContent = `Server response: ${imageDescription}`;
      uploadedImage.parentNode.appendChild(responseElement);

      // Send the image description as an event
      if (dataChannel && dataChannel.readyState === "open") {
        const imageEvent = {
          event_id: "event_omimageupload",
          type: "response.create",
          "response": {
              "instructions": `Please assist the user by describing this image: ${imageDescription}`,
          }
        };
        dataChannel.send(JSON.stringify(imageEvent));
        console.log("Image description event sent:", imageDescription);
      } else {
        console.error("Data channel is not open");
      }
    })
    .catch(error => {
      console.error("Error sending image to server:", error);
    });
  };
  reader.readAsDataURL(file);
}

function updateInstructions() {
  const newInstructions = instructionTextInput.value;
  if (dataChannel && dataChannel.readyState === "open") {
    const updateEvent = {
      event_id: "event_123",
      type: "session.update",
      session: {
        instructions: newInstructions,
        // Other session parameters can be included here if desired
      }
    };
    dataChannel.send(JSON.stringify(updateEvent));
    console.log("Session update event sent with new instructions:", newInstructions);
  } else {
    console.error("Data channel is not open");
  }
}

// Button Event Listeners
startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
sendEventBtn.addEventListener("click", sendClientEvent);
uploadImageBtn.addEventListener("click", uploadImage);
updateInstructionsBtn.addEventListener("click", updateInstructions);