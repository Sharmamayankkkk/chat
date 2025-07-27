<div align="center">
  <img src="https://raw.githubusercontent.com/Sharmamayankkkk/chat/main/public/logo/light_KCS.png#gh-light-mode-only" alt="Krishna Connect Logo" width="150">
  <img src="https://raw.githubusercontent.com/Sharmamayankkkk/chat/main/public/logo/dark_KCS.png#gh-dark-mode-only" alt="Krishna Connect Logo" width="150">

  <h1 align="center">Krishna Connect</h1>

  <p align="center">
    <i>Where Devotees Unite</i>
    <br />
    A modern, real-time chat application for the conscious community, now powered by AI.
    <br />
    <a href="https://github.com/Sharmamayankkkk/krishna-connect/issues">Report Bug</a>
    ·
    <a href="https://github.com/Sharmamayankkkk/krishna-connect/issues">Request Feature</a>
  </p>
</div>

---

## About The Project

In the spirit of selfless service (*seva*) and shared wisdom (*satsang*), Krishna Connect offers a sacred digital space for our community to come together. It's more than just a chat app; it's a platform designed to foster deep connections, share spiritual inspiration, and strengthen our collective journey in Krishna consciousness.

Built with modern, scalable, and beautiful technology, Krishna Connect provides a secure, intuitive, and feature-rich environment for meaningful conversations and community growth.

## ✨ Features for a Conscious Community

Krishna Connect is packed with features designed to create a vibrant and engaging community experience.

### Real-Time Communication
- **One-on-One & Group Chats**: Engage in instantaneous, meaningful conversations.
- **Community Circles (Channels)**: Create and manage public or private groups for focused discussions, study circles, or event coordination.
- **Admin Controls**: Group admins can control chat history visibility for new members and generate secure invite links.
- **Typing Indicators**: See when others are typing in real-time.
- **Online Status**: Know who is currently online.

### Rich & Expressive Messaging
- **Rich Media Sharing**: Effortlessly share photos, important documents, and audio files with previews and direct download links.
- **Voice Notes**: Record and send heartfelt voice messages directly within the chat.
- **Text Formatting**: Emphasize your messages with **bold**, _italics_, `code`, ~~strikethrough~~, and `||spoiler||` tags.
- **Reactions & Replies**: Share your sentiments on messages with emojis, and reply directly to specific messages to keep conversations clear and organized.
- **@Mentions**: Bring specific devotees into a conversation in group chats with `@username` or notify everyone with `@everyone`.
- **Link Previews**: Automatic, beautiful previews for shared links.
- **Edit & Delete**: Communicate mindfully with the ability to edit or delete your messages.
- **Forwarding**: Easily share messages with other devotees or groups.
- **Full Emoji & Sticker Support**: Express yourself with a full emoji picker, custom server-side emojis, and beautiful stickers.

### Personalization & User Experience
- **Customizable Themes**: Personalize your chat experience with beautiful themes, bubble colors, and a selection of inspiring wallpapers. Adjust wallpaper brightness for perfect visibility.
- **Light & Dark Mode**: Switch between themes for your comfort, day or night.
- **Desktop Notifications**: Stay connected and never miss an important message, with smart notifications that don't fire if you're already in the chat.
- **Image Viewer**: A beautiful, fullscreen image viewer with controls for zoom, rotation, and download.
- **Message Info**: See who has read your message in group chats.

### Community & Events
- **Events System**: Create, share, and RSVP to community events, from online lectures to local meetups.
- **Devotee Profiles**: Learn more about fellow community members, view their bio, and see your shared groups.
- **Starred Messages**: Keep track of important verses, links, or inspiring words by starring them for easy access later.
- **Pinned Messages**: Pin important announcements or messages to the top of any chat for everyone to see.

### A Safe & Sacred Space
- **Secure Authentication**: Full email/password and OAuth (Google, Facebook) sign-in.
- **Protected DMs**: A moderated system for cross-gender communication requires admin approval to foster a safe and respectful environment.
- **User Blocking & Reporting**: Maintain your peace of mind by blocking users if needed, and report any inappropriate behavior to admins.
- **Admin Seva Panel**: A dedicated dashboard for community sevaks (admins) to manage users, review DM requests, and resolve reports.

---

## 🛠️ Tech Stack

This project is built with a modern, robust, and scalable tech stack:

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **AI Toolkit**: [Genkit](https://firebase.google.com/docs/genkit) (for Generative AI features)
- **UI Library**: [React](https://react.dev/)
- **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage, Realtime)
- **Deployment**: [Vercel](https://vercel.com/)

---

## 🚀 Getting Started

Follow these steps to get a local copy up and running for development and contribution.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- A [Supabase](https://supabase.com/) account.
- A Google Cloud account with the Gemini API enabled.
- [Vercel CLI](https://vercel.com/docs/cli) (optional, for deployment)

### 1. Clone the Repository

First, clone the repository to your local machine:
```bash
git clone https://github.com/Sharmamayankkkk/krishna-connect.git
cd krishna-connect
```

### 2. Set Up Supabase

1.  **Create a Supabase Project**: Go to [supabase.com](https://supabase.com), create a new project, and save your **Project URL** and `public` **anon key**. You'll find these in your project's *Settings > API*.
2.  **Database Schema**: Go to the **SQL Editor** in your Supabase project dashboard. Copy the entire contents of `supabase/schema.sql` from this repository and run it to set up your database tables, policies, and functions.
3.  **Clean Database (Optional)**: To start with a clean slate at any time, you can run the script in `supabase/reset.sql` in the SQL Editor. **Warning: This will delete all data.**
4.  **Enable OAuth Providers (Optional)**: If you want to use Google or Facebook login, you'll need to enable them in *Authentication > Providers* in your Supabase dashboard and add your OAuth credentials.

### 3. Set Up Environment Variables

Create a file named `.env.local` in the root of your project. You can copy the example file:

```bash
cp .env.example .env.local
```

Then, fill in the values in `.env.local` with the credentials from your Supabase and Google Cloud projects:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Google AI (Gemini)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### 4. Install Dependencies and Run

Install the project dependencies using npm:

```bash
npm install
```

Now, you need to run two processes in separate terminals:
1.  **The main Next.js app:**
    ```bash
    npm run dev
    ```
2.  **The Genkit AI development server:**
    ```bash
    npm run genkit:dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. You're all set to start developing!

---

## 🚀 Deployment

This project is optimized for deployment on [Vercel](https://vercel.com).

1.  **Push to GitHub**: Make sure your code is pushed to a GitHub repository.
2.  **Import Project on Vercel**: Import your repository into Vercel. It will automatically detect that you are using Next.js and configure the build settings.
3.  **Add Environment Variables**: In your Vercel project settings (*Settings > Environment Variables*), add the `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `GEMINI_API_KEY` variables with the same values from your `.env.local` file.
4.  **Deploy**: Vercel will build and deploy your application. Any push to the main branch will automatically trigger a new deployment.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSharmamayankkkk%2Fkrishna-connect&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,GEMINI_API_KEY&project-name=krishna-connect&repo-name=krishna-connect)

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Please see our [**Contributing Guidelines**](https://github.com/Sharmamayankkkk/krishna-connect/blob/main/CONTRIBUTING.md) for more details on how to get started.

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🙏 Acknowledgements

- [ShadCN UI](https://ui.shadcn.com/) for the fantastic component library.
- [Supabase](https://supabase.com/) for their incredible backend-as-a-service platform.
- [Vercel](https://vercel.com/) for making deployment seamless.
- All the devotees and well-wishers who inspire this project.
