let backendBaseUrl = "http://localhost:8000";
let selectedRoleType = "root"; // 'root' | 'admin' | 'normal'
let authToken = null;
let currentSession = null;

// Ensure default auth mode layout
document.body.className = "auth-mode";

// UI Elements
const mainContainer = document.getElementById("mainContainer");
const alertBox = document.getElementById("alertBox");
const stepSubtitle = document.getElementById("stepSubtitle");

// Step 1
const step1 = document.getElementById("step1");
const backendUrlInput = document.getElementById("backendUrl");
const btnConnect = document.getElementById("btnConnect");

// Step 2
const step2 = document.getElementById("step2");
const tabRoot = document.getElementById("tabRoot");
const tabAdmin = document.getElementById("tabAdmin");
const tabNormal = document.getElementById("tabNormal");
const orgInputGroup = document.getElementById("orgInputGroup");
const loginOrgInput = document.getElementById("loginOrg");
const loginUsernameInput = document.getElementById("loginUsername");
const loginPasswordInput = document.getElementById("loginPassword");
const btnBackToStep1 = document.getElementById("btnBackToStep1");
const btnLogin = document.getElementById("btnLogin");

// Step 3 (Admin)
const step3 = document.getElementById("step3");
const sessionUserSpan = document.getElementById("sessionUser");
const sessionOrgSpan = document.getElementById("sessionOrg");
const sessionRoleSpan = document.getElementById("sessionRole");
const btnLogout = document.getElementById("btnLogout");

const createUserSection = document.getElementById("createUserSection");
const createUserHeading = document.getElementById("createUserHeading");
const createUserSubtext = document.getElementById("createUserSubtext");
const createUserForm = document.getElementById("createUserForm");
const targetOrgGroup = document.getElementById("targetOrgGroup");
const newUserOrgInput = document.getElementById("newUserOrg");
const newUserNameInput = document.getElementById("newUserName");
const newUserPasswordInput = document.getElementById("newUserPassword");

const uploadSection = document.getElementById("uploadSection");
const uploadForm = document.getElementById("uploadForm");
const uploadFileInput = document.getElementById("uploadFileInput");
const btnUpload = document.getElementById("btnUpload");

// Fullscreen Chatbot Elements (Normal User)
const fullscreenChat = document.getElementById("fullscreenChat");
const chatNavUser = document.getElementById("chatNavUser");
const chatNavOrg = document.getElementById("chatNavOrg");
const btnChatLogout = document.getElementById("btnChatLogout");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatPromptInput = document.getElementById("chatPromptInput");
const btnSendPrompt = document.getElementById("btnSendPrompt");

function showAlert(message, type = "error") {
  alertBox.className = `alert ${type}`;
  alertBox.textContent = message;
  alertBox.classList.remove("hidden");
}

function clearAlert() {
  alertBox.className = "alert hidden";
  alertBox.textContent = "";
}

function normalizeUrl(url) {
  let cleaned = url.trim();
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "http://" + cleaned;
  }
  return cleaned.replace(/\/+$/, "");
}

// Step 1: Connect to Backend
btnConnect.addEventListener("click", async () => {
  clearAlert();
  const rawUrl = backendUrlInput.value;
  if (!rawUrl) {
    showAlert("Please enter a backend server address.");
    return;
  }

  const url = normalizeUrl(rawUrl);
  btnConnect.disabled = true;
  btnConnect.textContent = "Connecting...";

  try {
    const res = await fetch(`${url}/`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    backendBaseUrl = url;
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
    stepSubtitle.textContent = "Step 2: Sign In";
  } catch (err) {
    showAlert(`Could not connect to backend at ${url}. Ensure server is running and reachable.`);
  } finally {
    btnConnect.disabled = false;
    btnConnect.textContent = "Connect & Continue \u2192";
  }
});

// Role Tabs Selection
function setRoleType(type) {
  selectedRoleType = type;
  [tabRoot, tabAdmin, tabNormal].forEach((tab) => tab.classList.remove("active"));
  clearAlert();

  if (type === "root") {
    tabRoot.classList.add("active");
    orgInputGroup.classList.add("hidden");
    loginUsernameInput.value = "admin";
  } else if (type === "admin") {
    tabAdmin.classList.add("active");
    orgInputGroup.classList.remove("hidden");
    loginUsernameInput.value = "";
  } else {
    // Normal User
    tabNormal.classList.add("active");
    orgInputGroup.classList.remove("hidden");
    loginUsernameInput.value = "";
  }
}

tabRoot.addEventListener("click", () => setRoleType("root"));
tabAdmin.addEventListener("click", () => setRoleType("admin"));
tabNormal.addEventListener("click", () => setRoleType("normal"));

btnBackToStep1.addEventListener("click", () => {
  clearAlert();
  step2.classList.add("hidden");
  step1.classList.remove("hidden");
  stepSubtitle.textContent = "Step 1: Backend Configuration";
});

// Step 2: Sign In
btnLogin.addEventListener("click", async () => {
  clearAlert();
  const organisation = selectedRoleType === "root" ? "root" : loginOrgInput.value.trim();
  const userName = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  if (!organisation) {
    showAlert("Please enter your organisation name.");
    return;
  }
  if (!userName || !password) {
    showAlert("Please enter both username and password.");
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Signing In...";

  try {
    const res = await fetch(`${backendBaseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organisation, userName, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Login failed");
    }

    authToken = data.accessToken;

    // Fetch user details from protected route
    const profileRes = await fetch(`${backendBaseUrl}/protected`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!profileRes.ok) {
      throw new Error("Failed to verify authenticated user profile");
    }

    const isRootAdmin = (organisation === "root" && userName === "admin");
    let detectedRole = isRootAdmin ? "admin" : (selectedRoleType === "admin" ? "admin" : "user");

    currentSession = {
      organisation,
      userName,
      role: detectedRole,
      isRootAdmin,
    };

    renderStep3();
  } catch (err) {
    showAlert(err.message);
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Sign In \u2192";
  }
});

function renderStep3() {
  step2.classList.add("hidden");

  if (currentSession.role === "user") {
    // Normal User -> Fullscreen Chatbot View
    document.body.className = "chat-mode";
    mainContainer.classList.add("hidden");
    fullscreenChat.classList.remove("hidden");

    chatNavUser.textContent = currentSession.userName;
    chatNavOrg.textContent = currentSession.organisation;
  } else {
    // Admin View (Root Admin or Org Admin)
    document.body.className = "auth-mode";
    mainContainer.classList.remove("hidden");
    step3.classList.remove("hidden");
    fullscreenChat.classList.add("hidden");
    stepSubtitle.textContent = "Dashboard";

    sessionUserSpan.textContent = currentSession.userName;
    sessionOrgSpan.textContent = currentSession.organisation;
    sessionRoleSpan.textContent = currentSession.role;

    if (currentSession.isRootAdmin) {
      createUserSection.classList.remove("hidden");
      uploadSection.classList.add("hidden");
      createUserHeading.textContent = "Create Organisation Admin";
      createUserSubtext.textContent = "As Root Admin, you can create new Admin users for any organisation.";
      targetOrgGroup.classList.remove("hidden");
      newUserOrgInput.required = true;
    } else {
      // Org Admin
      createUserSection.classList.remove("hidden");
      uploadSection.classList.remove("hidden");
      createUserHeading.textContent = `Create User for '${currentSession.organisation}'`;
      createUserSubtext.textContent = `As ${currentSession.organisation} Admin, you can create standard users within your organisation.`;
      targetOrgGroup.classList.add("hidden");
      newUserOrgInput.required = false;
    }
  }
}

// Step 3: Create User (Admin only)
createUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert();

  const payload = {
    userName: newUserNameInput.value.trim(),
    password: newUserPasswordInput.value,
  };

  if (currentSession.isRootAdmin) {
    payload.organisation = newUserOrgInput.value.trim();
    if (!payload.organisation) {
      showAlert("Organisation is required for Root Admin.");
      return;
    }
  }

  const btnCreate = document.getElementById("btnCreateUser");
  btnCreate.disabled = true;
  btnCreate.textContent = "Creating...";

  try {
    const res = await fetch(`${backendBaseUrl}/createUser`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Failed to create user");
    }

    showAlert(data.message, "success");
    newUserNameInput.value = "";
    newUserPasswordInput.value = "";
    if (newUserOrgInput) newUserOrgInput.value = "";
  } catch (err) {
    showAlert(err.message, "error");
  } finally {
    btnCreate.disabled = false;
    btnCreate.textContent = "Create User";
  }
});

// Upload File (Org Admin only)
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert();

  if (!uploadFileInput.files || uploadFileInput.files.length === 0) {
    showAlert("Please select a file to upload.");
    return;
  }

  const file = uploadFileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);

  btnUpload.disabled = true;
  btnUpload.textContent = "Uploading...";

  try {
    const res = await fetch(`${backendBaseUrl}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Upload failed");
    }

    showAlert(data.message, "success");
    uploadFileInput.value = "";
  } catch (err) {
    showAlert(err.message, "error");
  } finally {
    btnUpload.disabled = false;
    btnUpload.textContent = "Upload File";
  }
});

// Fullscreen Chatbot Prompt Handling
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const prompt = chatPromptInput.value.trim();
  if (!prompt) return;

  // Append user bubble
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble user";
  userBubble.innerHTML = `<div class="response-text">${escapeHtml(prompt)}</div>`;
  chatMessages.appendChild(userBubble);
  chatPromptInput.value = "";
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Append bot loading bubble
  const botBubble = document.createElement("div");
  botBubble.className = "chat-bubble bot";
  botBubble.innerHTML = `
    <div class="bubble-header">Assistant</div>
    <div class="response-text" style="color: #64748b;">Thinking...</div>
  `;
  chatMessages.appendChild(botBubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  btnSendPrompt.disabled = true;

  try {
    const res = await fetch(`${backendBaseUrl}/app`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Request to /app failed");
    }

    const prettyJson = JSON.stringify(data, null, 2);
    const responseText = data.response || "No response received.";

    botBubble.innerHTML = `
      <div class="bubble-header">Assistant</div>
      <details class="collapsible-json">
        <summary>&#x1F4CB; View JSON Response / Citations</summary>
        <pre class="json-preview"><code>${escapeHtml(prettyJson)}</code></pre>
      </details>
      <div class="response-text">${escapeHtml(responseText)}</div>
    `;
  } catch (err) {
    botBubble.innerHTML = `
      <div class="bubble-header">Error</div>
      <div class="response-text" style="color: #ef4444;">${escapeHtml(err.message)}</div>
    `;
  } finally {
    btnSendPrompt.disabled = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Sign Out Handlers
function signOut() {
  authToken = null;
  currentSession = null;
  loginPasswordInput.value = "";
  clearAlert();

  document.body.className = "auth-mode";
  fullscreenChat.classList.add("hidden");
  step3.classList.add("hidden");
  mainContainer.classList.remove("hidden");
  step2.classList.remove("hidden");
  stepSubtitle.textContent = "Step 2: Sign In";
}

btnLogout.addEventListener("click", signOut);
btnChatLogout.addEventListener("click", signOut);
