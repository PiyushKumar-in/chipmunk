/**
 * Chipmunk AI Portal - Frontend Application Logic (Vanilla JS)
 * Handles Server Connection, Multi-tenant Auth, Admin Operations & RAG Chat
 */

// Application State
let backendBaseUrl = localStorage.getItem("chipmunk_backend_url") || "http://localhost:8000";
let selectedRoleType = "root"; // 'root' | 'admin' | 'normal'
let authToken = null;
let currentSession = null;

// UI Elements - Navigation & Stepper
const mainContainer = document.getElementById("mainContainer");
const mainCard = document.getElementById("mainCard");
const alertBox = document.getElementById("alertBox");
const stepSubtitle = document.getElementById("stepSubtitle");
const stepIndicator1 = document.getElementById("stepIndicator1");
const stepIndicator2 = document.getElementById("stepIndicator2");
const stepIndicator3 = document.getElementById("stepIndicator3");

// Step 1: Server Config
const step1 = document.getElementById("step1");
const backendUrlInput = document.getElementById("backendUrl");
const btnConnect = document.getElementById("btnConnect");
const serverStatusDot = document.getElementById("serverStatusDot");
const serverStatusText = document.getElementById("serverStatusText");

// Step 2: Sign In
const step2 = document.getElementById("step2");
const tabRoot = document.getElementById("tabRoot");
const tabAdmin = document.getElementById("tabAdmin");
const tabNormal = document.getElementById("tabNormal");
const orgInputGroup = document.getElementById("orgInputGroup");
const loginOrgInput = document.getElementById("loginOrg");
const loginUsernameInput = document.getElementById("loginUsername");
const loginPasswordInput = document.getElementById("loginPassword");
const toggleLoginPassword = document.getElementById("toggleLoginPassword");
const btnBackToStep1 = document.getElementById("btnBackToStep1");
const btnLogin = document.getElementById("btnLogin");

// Step 3: Admin Dashboard
const step3 = document.getElementById("step3");
const adminSectionsGrid = document.getElementById("adminSectionsGrid");
const sessionUserSpan = document.getElementById("sessionUser");
const sessionOrgSpan = document.getElementById("sessionOrg");
const sessionRoleSpan = document.getElementById("sessionRole");
const sessionRoleBadge = document.getElementById("sessionRoleBadge");
const sessionAvatar = document.getElementById("sessionAvatar");
const btnLogout = document.getElementById("btnLogout");

const createUserSection = document.getElementById("createUserSection");
const createUserHeading = document.getElementById("createUserHeading");
const createUserSubtext = document.getElementById("createUserSubtext");
const createUserForm = document.getElementById("createUserForm");
const targetOrgGroup = document.getElementById("targetOrgGroup");
const newUserOrgInput = document.getElementById("newUserOrg");
const newUserNameInput = document.getElementById("newUserName");
const newUserPasswordInput = document.getElementById("newUserPassword");
const btnCreateUser = document.getElementById("btnCreateUser");
const btnGeneratePassword = document.getElementById("btnGeneratePassword");
const toggleNewPassword = document.getElementById("toggleNewPassword");

const uploadSection = document.getElementById("uploadSection");
const uploadForm = document.getElementById("uploadForm");
const uploadFileInput = document.getElementById("uploadFileInput");
const btnUpload = document.getElementById("btnUpload");
const dropZone = document.getElementById("dropZone");
const fileSelectedDisplay = document.getElementById("fileSelectedDisplay");
const selectedFileName = document.getElementById("selectedFileName");
const selectedFileSize = document.getElementById("selectedFileSize");

// Fullscreen Chatbot View
const fullscreenChat = document.getElementById("fullscreenChat");
const chatNavUser = document.getElementById("chatNavUser");
const chatNavOrg = document.getElementById("chatNavOrg");
const chatNavAvatar = document.getElementById("chatNavAvatar");
const btnChatLogout = document.getElementById("btnChatLogout");
const btnClearChat = document.getElementById("btnClearChat");
const toggleHyde = document.getElementById("toggleHyde");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatPromptInput = document.getElementById("chatPromptInput");
const btnSendPrompt = document.getElementById("btnSendPrompt");
const chatWelcomeHero = document.getElementById("chatWelcomeHero");
const chatMainContainer = document.getElementById("chatMainContainer");

// Theme Toggles
const themeToggleBtn = document.getElementById("themeToggleBtn");
const chatThemeToggleBtn = document.getElementById("chatThemeToggleBtn");
const themeIconSun = document.getElementById("themeIconSun");
const themeIconMoon = document.getElementById("themeIconMoon");
const chatThemeIconSun = document.getElementById("chatThemeIconSun");
const chatThemeIconMoon = document.getElementById("chatThemeIconMoon");

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem("chipmunk_theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
  applyTheme(isDark);
}

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add("dark-mode");
    localStorage.setItem("chipmunk_theme", "dark");
    if (themeIconSun) themeIconSun.classList.remove("hidden");
    if (themeIconMoon) themeIconMoon.classList.add("hidden");
    if (chatThemeIconSun) chatThemeIconSun.classList.remove("hidden");
    if (chatThemeIconMoon) chatThemeIconMoon.classList.add("hidden");
  } else {
    document.body.classList.remove("dark-mode");
    localStorage.setItem("chipmunk_theme", "light");
    if (themeIconSun) themeIconSun.classList.add("hidden");
    if (themeIconMoon) themeIconMoon.classList.remove("hidden");
    if (chatThemeIconSun) chatThemeIconSun.classList.add("hidden");
    if (chatThemeIconMoon) chatThemeIconMoon.classList.remove("hidden");
  }
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark-mode");
  applyTheme(!isDark);
}

function setViewMode(mode) {
  document.body.classList.remove("auth-mode", "chat-mode");
  document.body.classList.add(mode);
}

if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);
if (chatThemeToggleBtn) chatThemeToggleBtn.addEventListener("click", toggleTheme);
initTheme();

// ==========================================================================
// Stepper Progress Management
// ==========================================================================
function updateStepper(step) {
  [stepIndicator1, stepIndicator2, stepIndicator3].forEach((ind) => {
    if (ind) ind.className = "step-indicator";
  });

  if (step === 1) {
    if (stepIndicator1) stepIndicator1.classList.add("active");
  } else if (step === 2) {
    if (stepIndicator1) stepIndicator1.classList.add("completed");
    if (stepIndicator2) stepIndicator2.classList.add("active");
  } else if (step === 3) {
    if (stepIndicator1) stepIndicator1.classList.add("completed");
    if (stepIndicator2) stepIndicator2.classList.add("completed");
    if (stepIndicator3) stepIndicator3.classList.add("active");
  }
  fitPortalToViewport();
}

// ==========================================================================
// Viewport Auto-Scaling (Ensures Portal Fits Without Scrolling)
// ==========================================================================
function fitPortalToViewport() {
  if (!mainContainer || document.body.classList.contains("chat-mode")) {
    if (mainContainer) mainContainer.style.transform = "";
    return;
  }

  // Reset transform to measure natural height
  mainContainer.style.transform = "none";

  requestAnimationFrame(() => {
    if (!mainContainer || document.body.classList.contains("chat-mode")) return;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const containerHeight = mainContainer.offsetHeight;
    const containerWidth = mainContainer.offsetWidth;

    if (containerHeight <= 0 || containerWidth <= 0) return;

    // Available screen space with breathing room
    const availableHeight = viewportHeight - 16;
    const availableWidth = viewportWidth - 16;

    const scaleY = availableHeight / containerHeight;
    const scaleX = availableWidth / containerWidth;
    const scale = Math.min(1, scaleY, scaleX);

    if (scale < 0.99) {
      mainContainer.style.transform = `scale(${scale.toFixed(4)})`;
    } else {
      mainContainer.style.transform = "";
    }
  });
}

window.addEventListener("resize", fitPortalToViewport);
window.addEventListener("load", fitPortalToViewport);

// ==========================================================================
// Alert System
// ==========================================================================
let alertTimeout = null;
function showAlert(message, type = "error") {
  if (!alertBox) return;
  if (alertTimeout) clearTimeout(alertTimeout);

  alertBox.className = `alert ${type}`;
  let iconSvg = "";
  if (type === "error") {
    iconSvg = `<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else if (type === "success") {
    iconSvg = `<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else {
    iconSvg = `<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  alertBox.innerHTML = `${iconSvg}<div>${escapeHtml(message)}</div>`;
  alertBox.classList.remove("hidden");
  fitPortalToViewport();

  // Auto-dismiss success alerts after 6 seconds
  if (type === "success") {
    alertTimeout = setTimeout(() => {
      clearAlert();
    }, 6000);
  }
}

function clearAlert() {
  if (!alertBox) return;
  if (alertTimeout) clearTimeout(alertTimeout);
  alertBox.className = "alert hidden";
  alertBox.innerHTML = "";
  fitPortalToViewport();
}

function normalizeUrl(url) {
  let cleaned = (url || "").trim();
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "http://" + cleaned;
  }
  return cleaned.replace(/\/+$/, "");
}

// ==========================================================================
// Step 1: Server Connection & Presets
// ==========================================================================
if (backendUrlInput) {
  backendUrlInput.value = backendBaseUrl;
}

// Preset pills click handler
document.querySelectorAll(".preset-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    const targetUrl = pill.getAttribute("data-url");
    if (backendUrlInput && targetUrl) {
      backendUrlInput.value = targetUrl;
      checkServerStatus(targetUrl);
    }
  });
});

async function checkServerStatus(url) {
  if (!serverStatusDot || !serverStatusText) return;
  serverStatusDot.className = "status-dot checking";
  serverStatusText.textContent = "Checking...";

  try {
    const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      serverStatusDot.className = "status-dot online";
      serverStatusText.textContent = "Online";
      return true;
    }
  } catch (err) {
    // server unreachable
  }
  serverStatusDot.className = "status-dot";
  serverStatusText.textContent = "Offline";
  return false;
}

// Initial status check
checkServerStatus(backendBaseUrl);

btnConnect.addEventListener("click", async () => {
  clearAlert();
  const rawUrl = backendUrlInput.value;
  if (!rawUrl) {
    showAlert("Please enter a backend server address.");
    return;
  }

  const url = normalizeUrl(rawUrl);
  btnConnect.disabled = true;
  btnConnect.innerHTML = `<span class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span> Connecting...`;

  try {
    const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    
    backendBaseUrl = url;
    localStorage.setItem("chipmunk_backend_url", url);

    if (serverStatusDot) serverStatusDot.className = "status-dot online";
    if (serverStatusText) serverStatusText.textContent = "Online";

    step1.classList.add("hidden");
    step2.classList.remove("hidden");
    stepSubtitle.textContent = "Step 2: Sign In";
    updateStepper(2);
  } catch (err) {
    if (serverStatusDot) serverStatusDot.className = "status-dot";
    if (serverStatusText) serverStatusText.textContent = "Offline";
    showAlert(`Could not connect to backend at ${url}. Ensure the FastAPI server is running and reachable.`);
  } finally {
    btnConnect.disabled = false;
    btnConnect.innerHTML = "Connect &amp; Continue &rarr;";
  }
});

// ==========================================================================
// Step 2: Role Selection & Sign In
// ==========================================================================
function setRoleType(type) {
  selectedRoleType = type;
  [tabRoot, tabAdmin, tabNormal].forEach((tab) => {
    if (tab) {
      tab.classList.remove("active");
      tab.setAttribute("aria-selected", "false");
    }
  });
  clearAlert();

  if (type === "root") {
    tabRoot.classList.add("active");
    tabRoot.setAttribute("aria-selected", "true");
    orgInputGroup.classList.add("hidden");
    loginUsernameInput.value = "admin";
  } else if (type === "admin") {
    tabAdmin.classList.add("active");
    tabAdmin.setAttribute("aria-selected", "true");
    orgInputGroup.classList.remove("hidden");
    loginUsernameInput.value = "";
  } else {
    // Normal User
    tabNormal.classList.add("active");
    tabNormal.setAttribute("aria-selected", "true");
    orgInputGroup.classList.remove("hidden");
    loginUsernameInput.value = "";
  }
  fitPortalToViewport();
}

tabRoot.addEventListener("click", () => setRoleType("root"));
tabAdmin.addEventListener("click", () => setRoleType("admin"));
tabNormal.addEventListener("click", () => setRoleType("normal"));

btnBackToStep1.addEventListener("click", () => {
  clearAlert();
  step2.classList.add("hidden");
  step1.classList.remove("hidden");
  stepSubtitle.textContent = "Step 1: Backend Configuration";
  updateStepper(1);
});

// Password visibility toggles
if (toggleLoginPassword) {
  toggleLoginPassword.addEventListener("click", () => {
    const isPassword = loginPasswordInput.type === "password";
    loginPasswordInput.type = isPassword ? "text" : "password";
    toggleLoginPassword.style.color = isPassword ? "var(--primary)" : "var(--text-muted)";
  });
}

if (toggleNewPassword) {
  toggleNewPassword.addEventListener("click", () => {
    const isPassword = newUserPasswordInput.type === "password";
    newUserPasswordInput.type = isPassword ? "text" : "password";
    toggleNewPassword.style.color = isPassword ? "var(--primary)" : "var(--text-muted)";
  });
}

// Enter key submit in login inputs
[loginOrgInput, loginUsernameInput, loginPasswordInput].forEach((input) => {
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnLogin.click();
      }
    });
  }
});

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
  btnLogin.innerHTML = `<span class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span> Signing In...`;

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
    btnLogin.innerHTML = "Sign In &rarr;";
  }
});

// ==========================================================================
// Step 3 / Chat Routing
// ==========================================================================
function renderStep3() {
  step2.classList.add("hidden");
  updateStepper(3);

  if (currentSession.role === "user") {
    // Normal User -> Fullscreen Chatbot View
    setViewMode("chat-mode");
    mainContainer.classList.add("hidden");
    mainContainer.classList.remove("dashboard-mode");
    if (mainCard) mainCard.classList.remove("dashboard-mode");
    fullscreenChat.classList.remove("hidden");

    chatNavUser.textContent = currentSession.userName;
    chatNavOrg.textContent = currentSession.organisation;
    if (chatNavAvatar) {
      chatNavAvatar.textContent = (currentSession.userName[0] || "U").toUpperCase();
    }
    fitPortalToViewport();
  } else {
    // Admin View (Root Admin or Org Admin)
    setViewMode("auth-mode");
    mainContainer.classList.remove("hidden");
    step3.classList.remove("hidden");
    fullscreenChat.classList.add("hidden");
    stepSubtitle.textContent = "Dashboard";

    sessionUserSpan.textContent = currentSession.userName;
    sessionOrgSpan.textContent = currentSession.organisation;
    sessionRoleSpan.textContent = currentSession.role;

    if (sessionAvatar) {
      sessionAvatar.textContent = (currentSession.userName[0] || "A").toUpperCase();
    }

    if (currentSession.isRootAdmin) {
      // Root Admin only has ONE section (Create Org Admin) -> Keep compact!
      mainContainer.classList.remove("dashboard-mode");
      if (mainCard) mainCard.classList.remove("dashboard-mode");
      if (sessionRoleBadge) {
        sessionRoleBadge.className = "role-pill root-admin";
      }
      sessionRoleSpan.textContent = "Root Admin";
      if (adminSectionsGrid) adminSectionsGrid.classList.add("single-column");
      createUserSection.classList.remove("hidden");
      uploadSection.classList.add("hidden");
      const span = createUserHeading ? createUserHeading.querySelector("span") : null;
      if (span) span.textContent = "Create Organisation Admin";
      else if (createUserHeading) createUserHeading.textContent = "Create Organisation Admin";
      createUserSubtext.textContent = "As Root Admin, you can provision new organisations and create their administrator accounts.";
      targetOrgGroup.classList.remove("hidden");
      newUserOrgInput.required = true;
    } else {
      // Org Admin has TWO sections (Upload PDF + Create User) -> Side by side!
      mainContainer.classList.add("dashboard-mode");
      if (mainCard) mainCard.classList.add("dashboard-mode");
      if (sessionRoleBadge) {
        sessionRoleBadge.className = "role-pill org-admin";
      }
      sessionRoleSpan.textContent = "Org Admin";
      if (adminSectionsGrid) adminSectionsGrid.classList.remove("single-column");
      createUserSection.classList.remove("hidden");
      uploadSection.classList.remove("hidden");
      const span = createUserHeading ? createUserHeading.querySelector("span") : null;
      const orgHeading = `Create User for '${currentSession.organisation}'`;
      if (span) span.textContent = orgHeading;
      else if (createUserHeading) createUserHeading.textContent = orgHeading;
      createUserSubtext.textContent = `As ${currentSession.organisation} Admin, you can provision team member accounts for document querying.`;
      targetOrgGroup.classList.add("hidden");
      newUserOrgInput.required = false;
    }
    fitPortalToViewport();
  }
}

// ==========================================================================
// Admin Operations: User Creation & Password Helper
// ==========================================================================
if (btnGeneratePassword) {
  btnGeneratePassword.addEventListener("click", () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    let randomPassword = "";
    for (let i = 0; i < 12; i++) {
      randomPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    newUserPasswordInput.value = randomPassword;
    newUserPasswordInput.type = "text";
    if (toggleNewPassword) toggleNewPassword.style.color = "var(--primary)";
  });
}

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

  btnCreateUser.disabled = true;
  btnCreateUser.innerHTML = `<span class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span> Creating...`;

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
      if (isUnauthorized(res.status, data.detail)) {
        signOut("Session expired or invalid token. Please sign in again.");
        return;
      }
      throw new Error(data.detail || "Failed to create user");
    }

    showAlert(data.message, "success");
    newUserNameInput.value = "";
    newUserPasswordInput.value = "";
    if (newUserOrgInput) newUserOrgInput.value = "";
  } catch (err) {
    showAlert(err.message, "error");
  } finally {
    btnCreateUser.disabled = false;
    btnCreateUser.textContent = "Create User";
  }
});

// ==========================================================================
// Admin Operations: File Upload & Drag and Drop
// ==========================================================================
if (dropZone && uploadFileInput) {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      uploadFileInput.files = dt.files;
      updateFileDisplay(dt.files[0]);
    }
  });

  uploadFileInput.addEventListener("change", () => {
    if (uploadFileInput.files && uploadFileInput.files.length > 0) {
      updateFileDisplay(uploadFileInput.files[0]);
    } else {
      fileSelectedDisplay.classList.add("hidden");
    }
  });
}

function updateFileDisplay(file) {
  if (!file || !fileSelectedDisplay) return;
  selectedFileName.textContent = file.name;
  const sizeKb = (file.size / 1024).toFixed(1);
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  selectedFileSize.textContent = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
  fileSelectedDisplay.classList.remove("hidden");
}

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
  btnUpload.innerHTML = `<span class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span> Uploading &amp; Indexing...`;

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
      if (isUnauthorized(res.status, data.detail)) {
        signOut("Session expired or invalid token. Please sign in again.");
        return;
      }
      throw new Error(data.detail || "Upload failed");
    }

    showAlert(data.message, "success");
    uploadFileInput.value = "";
    if (fileSelectedDisplay) fileSelectedDisplay.classList.add("hidden");
  } catch (err) {
    showAlert(err.message, "error");
  } finally {
    btnUpload.disabled = false;
    btnUpload.textContent = "Upload & Index Document";
  }
});

// ==========================================================================
// Chatbot: Auto-growing Textarea & Enter key
// ==========================================================================
if (chatPromptInput) {
  chatPromptInput.addEventListener("input", () => {
    chatPromptInput.style.height = "auto";
    const newHeight = Math.min(chatPromptInput.scrollHeight, 140);
    chatPromptInput.style.height = `${newHeight}px`;
  });

  chatPromptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!btnSendPrompt.disabled && chatPromptInput.value.trim()) {
        if (typeof chatForm.requestSubmit === "function") {
          chatForm.requestSubmit();
        } else {
          chatForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
      }
    }
  });
}

// Starter Prompts Click Handler
document.querySelectorAll(".prompt-card").forEach((card) => {
  card.addEventListener("click", () => {
    const promptText = card.getAttribute("data-prompt");
    if (promptText && chatPromptInput) {
      chatPromptInput.value = promptText;
      chatPromptInput.focus();
      if (typeof chatForm.requestSubmit === "function") {
        chatForm.requestSubmit();
      } else {
        chatForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    }
  });
});

// Clear Chat Action
if (btnClearChat) {
  btnClearChat.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear your current conversation?")) {
      chatMessages.innerHTML = "";
      if (chatWelcomeHero) {
        chatMessages.appendChild(chatWelcomeHero);
      }
      // Re-append greeting
      const greeting = document.createElement("div");
      greeting.className = "chat-bubble bot";
      greeting.innerHTML = `
        <div class="chat-avatar bot-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="10" rx="2"></rect>
            <circle cx="12" cy="5" r="2"></circle>
            <path d="M12 7v4"></path>
          </svg>
        </div>
        <div class="bubble-body">
          <div class="bubble-header">
            <span class="bubble-sender">Chipmunk Assistant</span>
          </div>
          <div class="response-text">Hello! How can I assist you with your organisation's documents today?</div>
        </div>
      `;
      chatMessages.appendChild(greeting);
    }
  });
}

// ==========================================================================
// Chat Prompt Handling & RAG Response Visualizer
// ==========================================================================
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const prompt = chatPromptInput.value.trim();
  if (!prompt) return;

  // Hide welcome hero on first message
  if (chatWelcomeHero) {
    chatWelcomeHero.style.display = "none";
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Append user bubble
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble user";
  userBubble.innerHTML = `
    <div class="chat-avatar user-avatar">${(currentSession?.userName[0] || "U").toUpperCase()}</div>
    <div class="bubble-body">
      <div class="response-text">${escapeHtml(prompt)}</div>
    </div>
  `;
  chatMessages.appendChild(userBubble);
  chatPromptInput.value = "";
  chatPromptInput.style.height = "auto";
  chatMainContainer.scrollTop = chatMainContainer.scrollHeight;

  // Append assistant loading bubble
  const botBubble = document.createElement("div");
  botBubble.className = "chat-bubble bot";
  botBubble.innerHTML = `
    <div class="chat-avatar bot-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="10" rx="2"></rect>
        <circle cx="12" cy="5" r="2"></circle>
        <path d="M12 7v4"></path>
      </svg>
    </div>
    <div class="bubble-body">
      <div class="bubble-header">
        <span class="bubble-sender">Chipmunk Assistant</span>
        <span class="bubble-timestamp">${timeString}</span>
      </div>
      <div class="response-text" style="color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
        <span class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </span>
        <span>Searching documents &amp; synthesizing answer...</span>
      </div>
    </div>
  `;
  chatMessages.appendChild(botBubble);
  chatMainContainer.scrollTop = chatMainContainer.scrollHeight;

  btnSendPrompt.disabled = true;

  try {
    const useHyde = toggleHyde ? toggleHyde.checked : false;
    const res = await fetch(`${backendBaseUrl}/app`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt, useHyde }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (isUnauthorized(res.status, data.detail)) {
        signOut("Session expired or invalid token. Please sign in again.");
        return;
      }
      throw new Error(data.detail || "Request to /app failed");
    }

    const responseText = data.response || "No response received.";
    const citations = Array.isArray(data.citations) ? data.citations : [];
    const metrics = data.timeMetrics || {};

    const trimmedResponse = responseText.trim();
    const isNotCovered = trimmedResponse.toLowerCase().replace(/[.\s]/g, "") === "notcovered" ||
                         trimmedResponse.toLowerCase().startsWith("not covered");

    // Render formatted markdown or clean badge if Not Covered
    const formattedHtml = isNotCovered
      ? `<div class="not-covered-card">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>${escapeHtml(trimmedResponse)}</span>
        </div>`
      : formatMarkdown(responseText);

    // Render citations cards if any AND NOT "Not Covered."
    let citationsHtml = "";
    if (!isNotCovered && citations.length > 0) {
      citationsHtml = `
        <div class="citations-container">
          <div class="citations-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>Retrieved Sources (${citations.length})</span>
          </div>
          <div class="citations-grid">
            ${citations.map((c) => {
              const fileName = c.fileName || "Document";
              const page = c.pageNo != null ? `Page ${c.pageNo}` : "";
              const para = c.paragraphNo != null ? `Para ${c.paragraphNo}` : "";
              const dist = c.distance != null ? `Dist: ${Number(c.distance).toFixed(3)}` : "";
              return `
                <div class="citation-card" title="Source: ${escapeHtml(fileName)}">
                  <svg class="citation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <div class="citation-meta">
                    <span class="citation-filename">${escapeHtml(fileName)}</span>
                    <span class="citation-location">${[page, para].filter(Boolean).join(" &bull; ")}</span>
                  </div>
                  ${dist ? `<span class="citation-score-tag">${dist}</span>` : ""}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    // Render performance metrics strip
    let metricsHtml = `
      <div class="metrics-strip">
        ${metrics.totalTime != null ? `<span class="metric-pill total">&#x23F1; Total: <strong>${metrics.totalTime}s</strong></span>` : ""}
        ${metrics.queryingTime != null ? `<span class="metric-pill">&#x1F50D; Vector Query: <strong>${metrics.queryingTime}s</strong></span>` : ""}
        ${metrics.mainAnswerTime != null ? `<span class="metric-pill">&#x2728; Generation: <strong>${metrics.mainAnswerTime}s</strong></span>` : ""}
        ${metrics.pseudoAnswerTime != null ? `<span class="metric-pill">&#x1F9E0; HyDE: <strong>${metrics.pseudoAnswerTime}s</strong></span>` : ""}
      </div>
    `;

    // Filter out citations from JSON preview when Not Covered
    const displayData = isNotCovered
      ? { response: responseText, timeMetrics: metrics }
      : data;
    const prettyJson = JSON.stringify(displayData, null, 2);
    const detailsSummary = isNotCovered
      ? "&#x1F4CB; View Response &amp; Time Metrics"
      : "&#x1F4CB; View Full Response JSON &amp; Time Metrics";

    botBubble.querySelector(".bubble-body").innerHTML = `
      <div class="bubble-header">
        <span class="bubble-sender">Chipmunk Assistant</span>
        <div class="bubble-actions">
          <span class="bubble-timestamp">${timeString}</span>
          <button class="bubble-action-btn copy-response-btn" title="Copy response text" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
        </div>
      </div>
      <div class="response-text">${formattedHtml}</div>
      ${citationsHtml}
      ${metricsHtml}
      <details class="collapsible-json">
        <summary>${detailsSummary}</summary>
        <pre class="json-preview"><code>${escapeHtml(prettyJson)}</code></pre>
      </details>
    `;

    // Attach copy response event
    const copyBtn = botBubble.querySelector(".copy-response-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(responseText).then(() => {
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Copied!</span>
          `;
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            `;
          }, 2000);
        });
      });
    }

    // Attach code block copy events
    botBubble.querySelectorAll(".copy-code-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const codeText = btn.getAttribute("data-code") || "";
        navigator.clipboard.writeText(codeText).then(() => {
          btn.textContent = "Copied!";
          setTimeout(() => { btn.textContent = "Copy"; }, 2000);
        });
      });
    });

  } catch (err) {
    botBubble.querySelector(".bubble-body").innerHTML = `
      <div class="bubble-header">
        <span class="bubble-sender" style="color: var(--danger);">Error</span>
        <span class="bubble-timestamp">${timeString}</span>
      </div>
      <div class="response-text" style="color: var(--danger);">
        ${escapeHtml(err.message)}
      </div>
    `;
  } finally {
    btnSendPrompt.disabled = false;
    chatMainContainer.scrollTop = chatMainContainer.scrollHeight;
  }
});

// ==========================================================================
// Formatting & Helpers (Vanilla Markdown Parser)
// ==========================================================================
function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function formatMarkdown(text) {
  if (!text) return "";

  // 1. Extract fenced code blocks
  const codeBlocks = [];
  let processed = text.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang.trim() || "code", code });
    return placeholder;
  });

  // 2. Escape HTML for safe rendering
  processed = escapeHtml(processed);

  // 3. Headers
  processed = processed.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  processed = processed.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  processed = processed.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // 4. Bold & Italic
  processed = processed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  processed = processed.replace(/__(.*?)__/g, "<strong>$1</strong>");
  processed = processed.replace(/\*(.*?)\*/g, "<em>$1</em>");
  processed = processed.replace(/_(.*?)_/g, "<em>$1</em>");

  // 5. Inline code
  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 6. Source citation tags in text: [Source: file, Page X, Paragraph Y]
  processed = processed.replace(/\[Source:\s*([^\]]+)\]/gi, (m, content) => {
    return `<span class="badge-info" style="display:inline-block; margin: 0 2px;">&#x1F4C4; ${content}</span>`;
  });

  // 7. Bullet lists
  processed = processed.replace(/^\s*[\-\*]\s+(.*$)/gim, "<li>$1</li>");
  processed = processed.replace(/(<li>[\s\S]*?<\/li>)/gim, "<ul>$1</ul>");
  // Clean duplicate nested <ul> tags
  processed = processed.replace(/<\/ul>\s*<ul>/g, "");

  // 8. Paragraphs and line breaks
  const paragraphs = processed.split(/\n{2,}/);
  processed = paragraphs
    .map((p) => {
      p = p.trim();
      if (!p) return "";
      if (p.startsWith("<h") || p.startsWith("<ul") || p.startsWith("__CODE_BLOCK_")) {
        return p;
      }
      return `<p>${p.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  // 9. Reinsert code blocks
  codeBlocks.forEach((block, index) => {
    const escapedCode = escapeHtml(block.code.trim());
    const blockHtml = `
      <div class="code-block-container">
        <div class="code-block-header">
          <span>${block.lang}</span>
          <button type="button" class="copy-code-btn" data-code="${escapeHtml(block.code.trim())}">Copy</button>
        </div>
        <pre><code>${escapedCode}</code></pre>
      </div>
    `;
    processed = processed.replace(`__CODE_BLOCK_${index}__`, blockHtml);
  });

  return processed;
}

function isUnauthorized(status, message) {
  return (
    status === 401 ||
    status === 403 ||
    (typeof message === "string" && message.toLowerCase().includes("invalid"))
  );
}

// ==========================================================================
// Sign Out
// ==========================================================================
function signOut(reasonMessage) {
  authToken = null;
  currentSession = null;
  loginPasswordInput.value = "";
  clearAlert();

  setViewMode("auth-mode");
  fullscreenChat.classList.add("hidden");
  step3.classList.add("hidden");
  mainContainer.classList.remove("hidden");
  mainContainer.classList.remove("dashboard-mode");
  if (mainCard) mainCard.classList.remove("dashboard-mode");
  if (adminSectionsGrid) adminSectionsGrid.classList.remove("single-column");
  step2.classList.remove("hidden");
  stepSubtitle.textContent = "Step 2: Sign In";
  updateStepper(2);

  if (reasonMessage) {
    showAlert(reasonMessage, "error");
  }
  fitPortalToViewport();
}

btnLogout.addEventListener("click", () => signOut());
btnChatLogout.addEventListener("click", () => signOut());
