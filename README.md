# 🌌 Nexus Study Assistant: The Command Center

Nexus is a high-performance, private-first study assistant designed to bridge the gap between high-fidelity AI vision and local autonomous processing. It transforms your study environment into a synchronized "Command Center" across your desktop and mobile devices.

![Nexus Interface](https://via.placeholder.com/1200x600/08080A/F27D26?text=NEXUS+COMMAND+CENTER)

## 🚀 Core Architecture

### 1. Tri-Panel Command Center
- **Workload Node (Left)**: Active task tracking, Pomodoro integration, and Local AI node configuration.
- **Vision Hub (Center)**: 3D Neural Avatar with real-time screen-capture broadcast and vision monitoring.
- **Neural History (Right)**: Persistent terminal log that synchronizes session memory across all connected nodes.

### 2. Dual-Processing Engine
- **Local Mode**: Uses [Ollama](https://ollama.com/) or [LM Studio](https://lmstudio.ai/) (Gemma 2 / Llama 3) for private, offline data processing.
- **Cloud Mode**: Leverages **Google Gemini 2.0 Flash** for ultra-fast, high-context vision analysis and real-time audio reasoning.

### 3. Neural Sync System
Nexus uses a unique 6-digit handshake system to bridge devices. Broadcast your PC screen to your phone and chat with the vision feed while away from your desk.

---

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js** (v18+)
- **Firebase Account** (for real-time synchronization)
- **Ollama** (for Local Private Mode)

### Getting Started

1. **Clone the Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/nexus-study-assistant.git
   cd nexus-study-assistant
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_key
   VITE_FIREBASE_API_KEY=your_firebase_key
   ...
   ```

4. **Launch Local AI Node**
   ```bash
   # If using Ollama
   ollama serve
   # Make sure OLLAMA_ORIGINS is set to allow your app domain
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

---

## 📱 PWA Support
Nexus is a Progressive Web App. You can install it on your Android/iOS device by selecting "Add to Home Screen" to use it as a standalone, full-screen tool.

## 🛡️ Security & Privacy
Nexus is built on a "Privacy-First" principle. Local Mode ensures that your study materials and screen data never leave your local network when using a local LLM node.

---

## 📜 License
MIT License. Built with ⚡ by Antigravity.
