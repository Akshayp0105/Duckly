# 🦆 Duckly

> Share anything🌐. Anytime⌚. Anywhere🗺️.

**Duckly** is a real-time file and message sharing web app that lets users instantly share **text, images, PDFs, documents, and voice notes** through temporary rooms — without login.


🔗 Live Demo: https://duckly-iota.vercel.app

---

## 🦆 Why “Duckly”?

A duck can **fly, swim, and walk** — making it an all-rounder.

Duckly follows the same idea:

* 📄 Share **documents**
* 🖼️ Share **images**
* 🎤 Share **voice notes**
* 💬 Share **text**

All in one place — no limitations.

---

## ✨ Features

* 🔗 **Temporary Rooms**

  * Create & join rooms with a unique ID

* ⚡ **Real-time Sharing**

  * Instant sync using Firebase Firestore

* 📁 **Multi-Format Support**

  * Text messages
  * Images
  * PDFs & documents
  * Voice notes

* 👀 **Live Preview**

  * View files before downloading

* 📦 **Multiple File Upload**

  * Upload multiple files at once


* 🎨 **Theme Modes**

  * Dark (black + red accents)
  * Grey
  * Light (white)

* 📱 **Responsive UI**

  * Works on all devices

* 🔒 **No Authentication Required**

  * Instant usage without login

---

## 🛠️ Tech Stack

* **Frontend:** React + TypeScript
* **Styling:** CSS (No Tailwind)
* **Backend:** Firebase
* **Database:** Firebase Firestore
* **Hosting:** Vercel

---

## ⚙️ How It Works

1. User creates or joins a room
2. All users in the room get connected in real-time
3. Files/messages are uploaded and stored in Firestore
4. Files are encoded (e.g., Base64) before storing
5. Other users instantly receive and preview/download them

---

## 📂 Project Structure (Example)

```
src/
│── components/
│── pages/
│── services/
│── firebase/
│── utils/
│── App.tsx
```

---
## Screenshots
<img width="1889" height="830" alt="image" src="https://github.com/user-attachments/assets/f796363b-92d7-4403-ae97-56f0efdd42d1" />

<img width="1892" height="838" alt="image" src="https://github.com/user-attachments/assets/04723dab-eed7-473d-8322-1f0cc31559d2" />

<img width="1874" height="847" alt="image" src="https://github.com/user-attachments/assets/83df7854-d16d-4d30-a45a-b2226b92b40e" />

## 🔥 Key Highlights

* 🚀 No login friction → instant usage
* ⚡ Real-time communication
* 📁 Supports multiple file types
* 🎯 Clean UI with theme customization
* 🧠 Smart idea inspired by simplicity + power

---

## ⚠️ Limitations

* Firestore is not optimized for large file storage
* Base64 increases file size (~33%)
* Not suitable for very large files (future improvement: Firebase Storage / S3)

---

## 🚀 Future Improvements

* 🔐 Optional authentication
* ☁️ Cloud storage integration (Firebase Storage / AWS S3)
* ⏳ Auto-delete rooms after inactivity
* 🔍 Search & filter files
* 🤖 AI-based file tagging

---

## 🤝 Contributing

Contributions are welcome🔥! Feel free to fork the repo and submit a PR.

---

## 📧 Contact

**Akshay P.**
📩 [akshay1012005@gmail.com](mailto:akshay1012005@gmail.com)
🔗 https://www.linkedin.com/in/akshay-p-6b889a288


---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!

---
