import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, query, where,
  setDoc, deleteDoc, updateDoc, arrayRemove, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Firebase setup
const app = initializeApp({
  apiKey: "AIzaSyBgZX_GKkekzJ8KwxLaAsZiDKm8moTuWAA",
  authDomain: "room-chat-4f487.firebaseapp.com",
  projectId: "room-chat-4f487"
});
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const chatHistory = document.getElementById("chatHistory");
const menuBtn = document.getElementById("menuBtn");
const closePopup = document.getElementById("closePopup");
const menuPopup = document.getElementById("menuPopup");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const logoutBtn = document.getElementById("logoutBtn");
const searchUserBtn = document.getElementById("searchUserBtn");
const searchPopup = document.getElementById("searchPopup");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const archiveBtn = document.getElementById("archiveBtn");
const archivePopup = document.getElementById("archivePopup");
const archiveContent = document.getElementById("archiveContent");
const closeSearchPopup = document.getElementById("closeSearchPopup");
const customConfirm = document.getElementById("customConfirm");
const confirmDelete = document.getElementById("confirmDelete");
const confirmArchive = document.getElementById("confirmArchive");
const confirmCancel = document.getElementById("confirmCancel");
const archiveConfirm = document.getElementById("archiveConfirm");
const btnDeleteArchive = document.getElementById("btnDeleteArchive");
const btnUnarchive = document.getElementById("btnUnarchive");
const btnCancelArchive = document.getElementById("btnCancelArchive");

// Tambahan elemen opsional (hindari error jika tidak ada di halaman)
const editprofilBtn = document.getElementById("editprofilBtn");
const editprofilPopup = document.getElementById("editprofilPopup");
const closeeditprofil = document.getElementById("closeeditprofil");
const editUsername = document.getElementById("editUsername");
const editBio = document.getElementById("editBio");
const previewProfilePic = document.getElementById("previewProfilePic");
const profilePicInput = document.getElementById("profilePicInput");
const saveProfileBtn = document.querySelector(".edit-profile-btn");

let currentUsername = "";
let selectedChatId = null;
let selectedArchivedChatId = null;

// Theme toggle
themeToggleBtn.onclick = () => {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
};
(function applyTheme() {
  if (localStorage.getItem("theme") === "light") document.body.classList.add("light");
})();

// Menu
menuBtn.onclick = () => menuPopup.style.display = "flex";
closePopup.onclick = () => menuPopup.style.display = "none";
logoutBtn.onclick = () => signOut(auth).then(() => location.href = "login.html");

// Cari Username
searchUserBtn.onclick = () => searchPopup.style.display = "block";
closeSearchPopup.onclick = () => {
  searchPopup.style.display = "none";
  searchInput.value = "";
  searchResults.innerHTML = "";
};
document.getElementById("searchInputBtn").onclick = async () => {
  const val = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!val) return;
  const q = query(collection(db, "users"), where("username", ">=", val), where("username", "<=", val + "\uf8ff"));
  const snap = await getDocs(q);
  if (snap.empty) {
    searchResults.innerHTML = "<div style='color:gray;padding:10px'>Username tidak ditemukan</div>";
    return;
  }
  const seen = new Set();
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const name = data.username;
    if (seen.has(name)) return;
    seen.add(name);

    const div = document.createElement("div");
    div.className = "item";
    div.textContent = name === currentUsername ? `${name} (Itu kamu!)` : name;
    if (name === currentUsername) div.style.color = "#facc15";
    div.onclick = async () => {
      const chatId = [currentUsername, name].sort().join("_");
      const chatRef = doc(db, "chats", chatId);
      const exists = await getDoc(chatRef);
      if (!exists.exists()) {
        await setDoc(chatRef, {
          createdAt: Date.now(),
          lastMessage: "",
          lastTimestamp: 0,
          users: [currentUsername, name]
        });
      }
      localStorage.setItem("chatWith", name);
      localStorage.setItem("chatId", chatId);
      location.href = "chat.html";
    };
    searchResults.appendChild(div);
  });
};
searchInput.addEventListener("input", () => {
  if (searchInput.value.trim() === "") searchResults.innerHTML = "";
});

// Login Check
onAuthStateChanged(auth, async user => {
  if (!user || !user.emailVerified) return location.href = "login.html";
  const userDoc = await getDoc(doc(db, "users", user.uid));
  currentUsername = userDoc.exists() ? userDoc.data().username.toLowerCase() : user.email.split("@")[0];
  await setDoc(doc(db, "status", user.uid), { state: "online", last_changed: Date.now() });

  if (userDoc.exists()) {
    const data = userDoc.data();
    if (editUsername) editUsername.value = data.username || "";
    if (editBio) editBio.value = data.bio || "";
    if (previewProfilePic) {
      previewProfilePic.src = "default.jpg";
      if (data.photoURL) {
        const fullURL = `${data.photoURL}?t=${Date.now()}`;
        const img = new Image();
        img.onload = () => previewProfilePic.src = fullURL;
        img.src = fullURL;
      }
    }
  }

  realtimeChats();
});

// Realtime Chat
function realtimeChats() {
  const chatsRef = query(collection(db, "chats"), where("users", "array-contains", currentUsername));
  onSnapshot(chatsRef, async (snap) => {
    const chats = [];
    const promises = snap.docs.map(async (docSnap) => {
      const data = docSnap.data();
      if (!data.users?.includes(currentUsername)) return;
      const archived = data.archivedBy || [];
      if (archived.includes(currentUsername)) return;
      const other = data.users.find(u => u !== currentUsername);
      const userSnap = await getDocs(query(collection(db, "users"), where("username", "==", other)));
      if (userSnap.empty) return;
      const otherUID = userSnap.docs[0].id;
      const statusSnap = await getDoc(doc(db, "status", otherUID));
      const online = statusSnap.exists() && statusSnap.data().state === "online";
      const lastTime = data.lastTimestamp || data.createdAt || 0;
      const lastMsg = data.lastMessage?.trim() || "(Belum ada pesan)";
      const readStatus = data.readStatus || {};
      const unread = lastTime > (readStatus[currentUsername] || 0) ? 1 : 0;

      chats.push({
        id: docSnap.id,
        name: other,
        lastMessage: lastMsg,
        lastTimestamp: lastTime,
        online,
        unreadCount: unread
      });
    });
    await Promise.all(promises);
    chats.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    renderChats(chats);
  });
}

function renderChats(list) {
  chatHistory.innerHTML = "";
  for (const c of list) {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.innerHTML = `
      <div class="chat-name">
        <span>${c.name}</span>
        <div>
          ${c.unreadCount > 0 ? `<span class="badge">${c.unreadCount}</span>` : ""}
          <span class="chat-status ${c.online ? "online" : "offline"}">${c.online ? "●" : "○"}</span>
        </div>
      </div>
      <div class="chat-last">${c.lastMessage}</div>
    `;
    enableLongPress(div, c.id, c.name);
    chatHistory.appendChild(div);
  }
}

function enableLongPress(div, chatId, chatName) {
  let timer, isLongPress = false;
  div.addEventListener("click", () => {
    if (!isLongPress) {
      localStorage.setItem("chatWith", chatName);
      localStorage.setItem("chatId", chatId);
      location.href = "chat.html";
    }
  });
  const start = () => {
    isLongPress = false;
    timer = setTimeout(() => {
      isLongPress = true;
      selectedChatId = chatId;
      customConfirm.style.display = "flex";
    }, 600);
  };
  const cancel = () => clearTimeout(timer);
  div.addEventListener("mousedown", start);
  div.addEventListener("touchstart", start);
  div.addEventListener("mouseup", cancel);
  div.addEventListener("mouseleave", cancel);
  div.addEventListener("touchend", cancel);
}

confirmCancel.onclick = () => {
  customConfirm.style.display = "none";
  selectedChatId = null;
};
confirmDelete.onclick = async () => {
  if (!selectedChatId) return;
  const msgRef = collection(db, `chats/${selectedChatId}/messages`);
  const snap = await getDocs(msgRef);
  await Promise.all(snap.docs.map(doc => deleteDoc(doc.ref)));
  await deleteDoc(doc(db, "chats", selectedChatId));
  customConfirm.style.display = "none";
  selectedChatId = null;
};
confirmArchive.onclick = async () => {
  if (!selectedChatId) return;
  await updateDoc(doc(db, "chats", selectedChatId), {
    archivedBy: [currentUsername]
  });
  customConfirm.style.display = "none";
  selectedChatId = null;
};

// Archive
archiveBtn.onclick = () => {
  archivePopup.style.display = "block";
  loadArchivedChats();
};
document.getElementById("closeArchivePopup").onclick = () => {
  archivePopup.style.display = "none";
};

async function loadArchivedChats() {
  const snap = await getDocs(collection(db, "chats"));
  const archivedChats = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!data.users.includes(currentUsername)) continue;
    const archived = data.archivedBy || [];
    if (!archived.includes(currentUsername)) continue;

    const other = data.users.find(u => u !== currentUsername);
    const userSnap = await getDocs(query(collection(db, "users"), where("username", "==", other)));
    if (userSnap.empty) continue;
    const otherUID = userSnap.docs[0].id;
    const statusSnap = await getDoc(doc(db, "status", otherUID));
    const online = statusSnap.exists() && statusSnap.data().state === "online";
    const lastMsg = data.lastMessage?.trim() || "(Belum ada pesan)";
    archivedChats.push({ id: docSnap.id, name: other, lastMessage: lastMsg, online });
  }
  renderArchivedChats(archivedChats);
}
function renderArchivedChats(list) {
  archiveContent.innerHTML = list.length === 0
    ? "<div style='color:gray'>Belum ada chat yang diarsipkan.</div>"
    : "";
  for (const c of list) {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.innerHTML = `
      <div class="chat-name">
        <span>${c.name}</span>
        <span class="chat-status ${c.online ? "online" : "offline"}">${c.online ? "●" : "○"}</span>
      </div>
      <div class="chat-last">${c.lastMessage}</div>
    `;
    enableLongPressArchive(div, c.id, c.name);
    archiveContent.appendChild(div);
  }
}
function enableLongPressArchive(div, chatId, chatName) {
  let timer, isLongPress = false;
  div.addEventListener("click", () => {
    if (!isLongPress) {
      localStorage.setItem("chatWith", chatName);
      localStorage.setItem("chatId", chatId);
      location.href = "chat.html";
    }
  });
  const start = () => {
    isLongPress = false;
    timer = setTimeout(() => {
      isLongPress = true;
      selectedArchivedChatId = chatId;
      archiveConfirm.style.display = "flex";
    }, 600);
  };
  const cancel = () => clearTimeout(timer);
  div.addEventListener("mousedown", start);
  div.addEventListener("touchstart", start);
  div.addEventListener("mouseup", cancel);
  div.addEventListener("mouseleave", cancel);
  div.addEventListener("touchend", cancel);
}
btnCancelArchive.onclick = () => {
  archiveConfirm.style.display = "none";
  selectedArchivedChatId = null;
};
btnUnarchive.onclick = async () => {
  if (!selectedArchivedChatId) return;
  await updateDoc(doc(db, "chats", selectedArchivedChatId), {
    archivedBy: arrayRemove(currentUsername)
  });
  archiveConfirm.style.display = "none";
  selectedArchivedChatId = null;
  archivePopup.style.display = "none";
};
btnDeleteArchive.onclick = async () => {
  if (!selectedArchivedChatId) return;
  const snap = await getDocs(collection(db, `chats/${selectedArchivedChatId}/messages`));
  await Promise.all(snap.docs.map(doc => deleteDoc(doc.ref)));
  await deleteDoc(doc(db, "chats", selectedArchivedChatId));
  archiveConfirm.style.display = "none";
  selectedArchivedChatId = null;
  loadArchivedChats();
};

// Edit Profil (opsional, dicek jika elemen tersedia)
if (editprofilBtn && editprofilPopup && closeeditprofil) {
  editprofilBtn.onclick = () => editprofilPopup.style.display = "block";
  closeeditprofil.onclick = () => editprofilPopup.style.display = "none";
}
if (profilePicInput && previewProfilePic) {
  profilePicInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => previewProfilePic.src = event.target.result;
      reader.onerror = () => alert("Terjadi kesalahan saat upload foto");
      reader.readAsDataURL(file);
    }
  });
}
if (saveProfileBtn) {
  saveProfileBtn.addEventListener("click", async () => {
    const username = editUsername.value.trim();
    const bio = editBio.value.trim();
    const file = profilePicInput.files[0];
    if (!username) return alert("Username tidak boleh kosong.");

    let photoURL = previewProfilePic.src;
    if (file) {
      const formData = new FormData();
      formData.append("image", file);
      try {
        const response = await fetch("https://api.imgbb.com/1/upload?key=e22481d59073cced43528843c8ad2ff2", {
          method: "POST", body: formData
        });
        const data = await response.json();
        if (data.success) photoURL = data.data.url;
        else return alert("Gagal upload foto ke imgbb.");
      } catch (error) {
        console.error("Upload error:", error);
        return alert("Terjadi kesalahan saat upload foto.");
      }
    }

    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), { username, bio, photoURL });
        alert("Profil berhasil diperbarui!");
        editprofilPopup.style.display = "none";
      } catch (err) {
        console.error("Update error:", err);
        alert("Gagal menyimpan profil.");
      }
    }
  });
  }
