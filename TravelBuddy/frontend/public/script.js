let currentPage = 1;

function nextPage(page) {
  const pages = document.querySelectorAll(".form-page");
  const dots = document.querySelectorAll(".dot");

  pages.forEach(p => p.classList.remove("active"));
  dots.forEach(d => d.classList.remove("active"));

  document.getElementById(`page${page}`).classList.add("active");
  if (dots[page - 1]) dots[page - 1].classList.add("active");

  currentPage = page;
}

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Firebase references
  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  // ----------------------------
  // Google Login
  // ----------------------------
  const googleBtn = document.querySelector(".google-btn");
  if (googleBtn) {
    googleBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const idToken = await user.getIdToken();

        // ✅ Send to backend for verification
        await fetch("http://localhost:4000/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        localStorage.setItem("uid", user.uid);
        alert(`Welcome ${user.displayName || "Traveler"}!`);
        window.location.href = "./Dashboard.html";
      } catch (error) {
        console.error("Google Login Error:", error.message);
        alert("Google login failed: " + error.message);
      }
    });
  }

  // ----------------------------
  // Signup (Phone + OTP + Password)
  // ----------------------------
  // ----------------------------
  // 2️⃣ Signup (Phone + OTP + Password)
  // ----------------------------
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // capture values before DOM is replaced
      const nameVal = document.getElementById("name").value.trim();
      const phoneVal = document.getElementById("phone").value.trim();
      const passVal = document.getElementById("password").value.trim();

      if (!/^[6-9]\d{9}$/.test(phoneVal)) {
        return alert("Enter a valid 10-digit Indian mobile number");
      }

      try {
        // ✅ Create invisible reCAPTCHA once only
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
            size: "invisible",
            callback: () => console.log("reCAPTCHA solved ✅"),
          });
        }

        const phoneNumber = "+91" + phoneVal;
        const confirmationResult = await firebase.auth().signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier);

        // ✅ Build OTP UI dynamically
        signupForm.innerHTML = `
        <h3>Enter OTP</h3>
        <input type="text" id="otp-input" placeholder="Enter 6-digit OTP" style="margin-top:10px;width:70%;padding:6px;">
        <button id="verify-otp-btn" style="margin-top:5px;">Verify OTP</button>
        <div id="recaptcha-container"></div>
      `;

        // ✅ Verify OTP
        document.getElementById("verify-otp-btn").addEventListener("click", async () => {
          const otp = document.getElementById("otp-input").value.trim();
          if (!otp) return alert("Please enter the OTP");

          try {
            const result = await confirmationResult.confirm(otp);
            const user = result.user;

            // update name
            await user.updateProfile({ displayName: nameVal });

            // create pseudo email for password login later
            const pseudoEmail = `${phoneVal}@gotravels.com`;
            try {
              await firebase.auth().createUserWithEmailAndPassword(pseudoEmail, passVal);
            } catch (err) {
              // ignore "email already in use" if OTP signup repeated
              if (!err.message.includes("already in use")) throw err;
            }

            const idToken = await user.getIdToken();
            await fetch("http://localhost:4000/api/auth/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken }),
            });

            alert("✅ Account created successfully! Please login now.");
            nextPage(2); // go to login page
          } catch (err) {
            console.error("OTP Verification Error:", err);
            alert("Invalid OTP. Please try again.");
          }
        });
      } catch (error) {
        console.error("Signup Error:", error);
        alert("Signup failed: " + error.message);
      }
    });
  }

  // ----------------------------
  // Login (Phone + Password)
  // ----------------------------
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const phone = document.getElementById("login-Number").value.trim();
      const password = document.getElementById("login-password").value.trim();
      const pseudoEmail = `${phone}@gotravels.com`;

      try {
        const userCredential = await auth.signInWithEmailAndPassword(pseudoEmail, password);
        const user = userCredential.user;
        const idToken = await user.getIdToken();

        await fetch("http://localhost:4000/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        localStorage.setItem("uid", user.uid);
        alert("Login successful!");
        window.location.href = "./Dashboard.html";
      } catch (error) {
        alert("Login failed: " + error.message);
      }
    });
  }
});

// ----------------------------
// ✅ Dashboard Data Loader
// ----------------------------
document.addEventListener("DOMContentLoaded", async () => {
  // Run this only if on dashboard.html
  if (!window.location.pathname.toLowerCase().includes("dashboard")) return;

  const backendURL = "http://localhost:4000/api/trips";
  const bucketBase = "https://firebasestorage.googleapis.com/v0/b/milan-4590e.appspot.com/o/";

  const recentContainer = document.getElementById("recent-trips");
  const popularContainer = document.getElementById("popular-trips");

  // Function to fetch and render trips from backend
  async function loadTrips(category, container) {
    try {
      const res = await fetch(`${backendURL}/${category}`);
      const data = await res.json();

      container.innerHTML = ""; // clear “loading” placeholder

      if (!data.success || !data.trips || !data.trips.length) {
        container.innerHTML = `<p style="color:gray;">No ${category} trips found.</p>`;
        return;
      }

      data.trips.forEach(async (trip) => {
        const res = await fetch(`http://localhost:4000/api/trips/image?path=${encodeURIComponent(trip.imagePath)}`);
        const data = await res.json();
        const imageURL = data.success ? data.url : "./fallback.jpeg";


        // Create card
        if (category === "recent") {
          const card = document.createElement("div");
          card.className = "trip-card";
          card.innerHTML = `
            <img src="${imageURL}" alt="${trip.title}">
            <div class="card-content">
              <h3>${trip.title}</h3>
              <p>${trip.duration}</p>
            </div>
          `;
          card.addEventListener("click", () => {
            console.log("🗺 Trip clicked:", trip);
            alert(`📍 ${trip.title}\n${trip.description}`);
          });
          container.appendChild(card);
        } else {
          const card = document.createElement("div");
          card.className = "destination-card";
          card.style.backgroundImage = `url('${imageURL}')`;
          card.innerHTML = `
            <div class="card-overlay">
              <h3>${trip.title}</h3>
            </div>
          `;
          card.addEventListener("click", () => {
            console.log("🏖 Destination clicked:", trip);
            const match = trip.title.match(/^(.*?)\s+(Guide|Adventure)$/i);
            const city = match ? match[1] : trip.title;

            // open details page
            window.location.href = `trip-details.html?city=${encodeURIComponent(city)}`;
          });
          container.appendChild(card);
        }
      });
    } catch (err) {
      console.error(`❌ Error loading ${category} trips:`, err);
      container.innerHTML = "<p style='color:red'>Failed to load data.</p>";
    }
  }

  // Load data for both sections
  await loadTrips("recent", recentContainer);
  await loadTrips("popular", popularContainer);
});

