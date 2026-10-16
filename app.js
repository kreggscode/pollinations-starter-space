"use strict";

// ---------------------------------------------------------------------------
// EDIT ME: which app key attributes this Space on the consent screen.
// Create your own at https://enter.pollinations.ai/keys -> "Create New App Key".
// It is publishable by design, like an OAuth client_id, so it is safe here.
// ---------------------------------------------------------------------------
const CLIENT_ID = "pk_hBFhl5uCcIoqWKbg";

const ENTER = "https://enter.pollinations.ai/api";
const GEN = "https://gen.pollinations.ai";

const STORE = { token: "starter_byop_token", expires: "starter_byop_expires", device: "starter_device_code" };

// EDIT ME: defaults for the generator.
const DEFAULTS = { model: "flux", width: 1024, height: 1024 };

// EDIT ME: the models the picker offers.
const MODELS = [
  { id: "flux", label: "Flux - balanced, cheap" },
  { id: "tongyi-mai/z-image-turbo", label: "Z-Image Turbo - fastest" },
  { id: "kontext", label: "Kontext - follows wording closely" },
];

const $ = (id) => document.getElementById(id);
const screens = ["screenSignIn", "screenApp"];

function show(name) {
  screens.forEach((s) => $(s).classList.toggle("hidden", s !== name));
}

function setError(id, message) {
  const el = $(id);
  el.textContent = message || "";
  el.classList.toggle("hidden", !message);
}

// --- BYOP device flow -------------------------------------------------------
// No redirect URI is involved anywhere, which is the whole point: a duplicated
// Space works at any URL without registering anything.

function hasToken() {
  const value = sessionStorage.getItem(STORE.token);
  if (!value) return false;
  const expires = Number(sessionStorage.getItem(STORE.expires)) || 0;
  if (expires && Date.now() > expires) {
    signOut();
    return false;
  }
  return true;
}

function signOut() {
  sessionStorage.removeItem(STORE.token);
  sessionStorage.removeItem(STORE.expires);
  sessionStorage.removeItem(STORE.device);
  syncAccountUi();
}

function syncAccountUi() {
  const signedIn = hasToken();
  $("signOutBtn").classList.toggle("hidden", !signedIn);
  $("accountLabel").classList.toggle("hidden", !signedIn);
  if (signedIn) $("accountLabel").textContent = "Signed in";
}

async function requestDeviceCode() {
  const res = await fetch(ENTER + "/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error("Could not start sign-in (" + res.status + ").");
  if (!data.device_code) throw new Error("Pollinations returned no device code.");
  sessionStorage.setItem(STORE.device, data.device_code);
  return data;
}

// Polls until the visitor approves on their phone or laptop.
async function pollForToken(deviceCode, intervalSeconds) {
  let interval = (intervalSeconds || 5) * 1000;
  const deadline = Date.now() + 30 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));

    const res = await fetch(ENTER + "/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode, client_id: CLIENT_ID }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok && data && data.access_token) {
      sessionStorage.setItem(STORE.token, data.access_token);
      const lifetime = Number(data.expires_in) || 7 * 24 * 3600;
      sessionStorage.setItem(STORE.expires, String(Date.now() + lifetime * 1000));
      sessionStorage.removeItem(STORE.device);
      return data.access_token;
    }

    const error = data && data.error;
    if (error === "authorization_pending") continue;
    if (error === "slow_down") {
      interval += 5000;
      continue;
    }
    if (error === "expired_token") throw new Error("That code expired. Start sign-in again.");
    if (error === "access_denied") throw new Error("Authorisation was declined.");
    throw new Error("Sign-in failed: " + (error || "unexpected reply") + ".");
  }
  throw new Error("Timed out waiting for approval.");
}

async function startSignIn() {
  setError("signInError", "");
  const btn = $("startBtn");
  btn.disabled = true;
  try {
    const code = await requestDeviceCode();
    $("deviceLink").href = code.verification_uri_complete;
    $("deviceLink").textContent = code.verification_uri_complete;
    $("deviceStep").classList.remove("hidden");
    $("deviceStatus").textContent = "Waiting for approval...";
    window.open(code.verification_uri_complete, "_blank", "noopener");

    await pollForToken(code.device_code, code.interval);
    enterApp();
  } catch (err) {
    setError("signInError", err.message);
    $("deviceStep").classList.add("hidden");
  } finally {
    btn.disabled = false;
  }
}

function enterApp() {
  syncAccountUi();
  show("screenApp");
}

// --- Narration --------------------------------------------------------------

// EDIT ME: the voice that speaks each caption. Both entries must be
// paid_only=false in the audio model list so visitors never need Paid Pollen.
const NARRATION = { model: "openai/tts-1", voice: "nova" };
let demoMode = false;
let lastCaption = "";

async function narrate() {
  const btn = $("narrateBtn");
  const text = lastCaption || $("promptInput").value.trim();
  if (!text) return;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Narrating...";
  try {
    let url;
    if (demoMode) {
      // The preview plays a committed recording and never calls the API.
      url = "sample-narration.mp3";
    } else {
      const res = await fetch(
        GEN +
          "/audio/" +
          encodeURIComponent(text) +
          "?model=" +
          NARRATION.model +
          "&voice=" +
          NARRATION.voice,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error("Narration failed (" + res.status + ").");
      url = URL.createObjectURL(await res.blob());
    }
    await new Audio(url).play();
  } catch (err) {
    setError("appError", err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// --- Generation -------------------------------------------------------------

function authHeaders() {
  return { Authorization: "Bearer " + sessionStorage.getItem(STORE.token) };
}

async function generateImage(prompt, model) {
  const params = new URLSearchParams({
    model,
    width: String(DEFAULTS.width),
    height: String(DEFAULTS.height),
    seed: String(Math.floor(Math.random() * 1e6)),
    nologo: "true",
  });
  const res = await fetch(GEN + "/image/" + encodeURIComponent(prompt) + "?" + params, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Image request failed (" + res.status + ").");
  const blob = await res.blob();
  if (!blob.size) throw new Error("The image came back empty.");
  return URL.createObjectURL(blob);
}

// EDIT ME: system prompt that sets the tone of the caption.
const CAPTION_SYSTEM = "You write one short caption for a generated image. Two sentences maximum. No emoji.";

async function generateCaption(prompt) {
  const res = await fetch(GEN + "/v1/chat/completions", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-5.4-nano",
      max_tokens: 80,
      messages: [
        { role: "system", content: CAPTION_SYSTEM },
        { role: "user", content: "Image prompt: " + prompt },
      ],
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error("Caption failed (" + res.status + ").");
  return (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
}

async function generate() {
  const prompt = $("promptInput").value.trim();
  if (!prompt) {
    setError("appError", "Describe something first.");
    return;
  }
  setError("appError", "");

  const btn = $("generateBtn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Generating...";

  try {
    const [imageUrl, caption] = await Promise.all([
      generateImage(prompt, $("modelSelect").value),
      generateCaption(prompt).catch(() => ""),
    ]);
    const img = $("resultImage");
    img.src = imageUrl;
    img.classList.remove("hidden");
    $("placeholder").classList.add("hidden");
    if (caption.trim()) {
      $("caption").textContent = caption.trim();
      $("caption").classList.remove("hidden");
    }
    lastCaption = caption.trim() || prompt;
    $("narrateBtn").classList.remove("hidden");
  } catch (err) {
    setError("appError", err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// --- Wiring -----------------------------------------------------------------

function init() {
  for (const m of MODELS) {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.label;
    if (m.id === DEFAULTS.model) option.selected = true;
    $("modelSelect").appendChild(option);
  }

  document.querySelectorAll(".example").forEach((b) =>
    b.addEventListener("click", () => {
      $("promptInput").value = b.textContent.trim();
    }),
  );

  $("startBtn").addEventListener("click", startSignIn);
  $("signOutBtn").addEventListener("click", () => {
    signOut();
    show("screenSignIn");
  });
  $("generateBtn").addEventListener("click", generate);
  $("narrateBtn").addEventListener("click", narrate);
  $("promptInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") generate();
  });

  syncAccountUi();

  // ?demo=1 renders the generator with a committed sample so the app can be
  // seen without signing in. It never calls the API and spends nothing.
  if (new URLSearchParams(location.search).get("demo") === "1") {
    enterDemo();
    return;
  }

  show(hasToken() ? "screenApp" : "screenSignIn");
}

const DEMO = {
  prompt: "a glass terrarium holding a tiny storm",
  caption: "Lightning curls inside the dome while the moss below waits out the weather, entirely unbothered.",
};

function enterDemo() {
  demoMode = true;
  lastCaption = DEMO.caption;
  $("promptInput").value = DEMO.prompt;
  $("resultImage").src = "sample.png";
  $("resultImage").classList.remove("hidden");
  $("placeholder").classList.add("hidden");
  $("caption").textContent = DEMO.caption;
  $("caption").classList.remove("hidden");
  $("narrateBtn").classList.remove("hidden");
  $("accountLabel").textContent = "Preview";
  $("accountLabel").classList.remove("hidden");
  show("screenApp");
}

init();
