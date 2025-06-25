# Krishna Connect

**A modern, real-time chat application designed for the conscious community.**

Krishna Connect is a feature-rich communication platform built with Next.js, Supabase, and Tailwind CSS. It provides a secure and intuitive space for community members to connect, share, and grow together.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-github-username%2Fkrishna-connect&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY&project-name=krishna-connect&repository-name=krishna-connect)

---

## ✨ Key Features

### Core Chat Functionality
- **Real-time Messaging**: Instantaneous message delivery in both one-on-one (DM) and group chats.
- **Group & Channel Chats**: Create and manage groups. Admins can set groups to public/private, control history visibility, and generate invite links.
- **Rich Media Sharing**: Effortlessly share images, audio files, and documents. Attachments include previews and download links.
- **Voice Notes**: Record, pause, resume, and send voice messages directly within the chat interface.
- **Message Interactions**:
  - **Reactions**: React to messages with a full emoji picker.
  - **Starring**: Star important messages to find them easily later.
  - **Edit & Delete**: Edit your messages after sending or delete them for everyone.
  - **Forwarding**: Forward messages to other chats.

### User Experience & Personalization
- **Expressive Communication**: Full-featured Emoji Picker, custom server-side emojis, and animated stickers.
- **Customizable Appearance**:
  - **Theme Engine**: Users can personalize their chat experience by changing outgoing/incoming bubble colors and username colors.
  - **Dynamic Wallpapers**: Choose from a selection of pre-loaded chat wallpapers or upload your own.
  - **Light & Dark Mode**: Seamless theme switching for user comfort.
- **Responsive Design**: A beautiful and functional experience across all devices.
- **Desktop Notifications**: Receive native desktop notifications for new messages.

### Community & Events
- **Events System**: Create, edit, share, and RSVP to community events.
- **User Profiles**: View other users' profiles, including their bio and shared groups.
- **Profile Management**: Users can update their own name, username, bio, and avatar.
- **Start New Chats**: Easily find and start new one-on-one conversations.

### Authentication & Security
- **Secure Auth**: Full email/password authentication flow with unique username and email checks.
- **OAuth Support**: Sign in quickly and securely with Google and Facebook.
- **Password Reset**: A complete "Forgot Password" flow via email.
- **User Blocking**: Block other users to prevent them from messaging you.

### Advanced & Admin Features
- **@Mentions**: Tag users in group chats to send them a notification.
- **DM Request System**: A moderated system for cross-gender communication. Users must send a request with a reason, which an admin must approve.
- **Admin Panel**: A dedicated dashboard for administrators to:
  - View application overview stats.
  - Manage all users (view profiles, grant/revoke admin privileges).
  - Manage all DM requests (approve, reject, or revoke permissions).
  - Review and resolve user-submitted reports.

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router)
- **UI**: React, ShadCN UI, Tailwind CSS
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **State Management**: React Context API
- **Deployment**: Vercel

---

## 🚀 Getting Started

Follow these steps to get a local copy up and running.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- A [Supabase](https://supabase.com/) account for the database and authentication.

### 1. Clone the Repository

```bash
git clone https://github.com/your-github-username/krishna-connect.git
cd krishna-connect
```

### 2. Set Up Supabase

1.  **Create a Supabase Project**: Go to [supabase.com](https://supabase.com), create a new project, and save your **Project URL** and `public` **anon key**.

2.  **Database Schema**: Go to the **SQL Editor** in your Supabase project dashboard and run the SQL scripts required to set up your database tables and policies.
    *You can find the schema in your Supabase project settings if you've already configured it, or you can create them based on the types in `src/lib/types.ts`.*

3.  **Clean Database (Optional)**: To start with a clean slate, you can run the script in `supabase/reset.sql` in the SQL Editor. This will truncate all data while keeping the table structure.

### 3. Set Up Environment Variables

Create a file named `.env.local` in the root of your project and add your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 4. Install Dependencies and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## ☁️ Deployment

This project is optimized for deployment on [Vercel](https://vercel.com/).

### Deploy with the Vercel Button

Click the "Deploy with Vercel" button at the top of this README to automatically clone, deploy, and configure your project. You will be prompted to enter your Supabase environment variables during the setup process.

### Manual Deployment

1.  Push your code to a Git repository (GitHub, GitLab, Bitbucket).
2.  Import the repository into Vercel.
3.  Add your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the **Environment Variables** section of your Vercel project settings.
4.  Deploy! Vercel will automatically build and deploy your Next.js application.
# studio
