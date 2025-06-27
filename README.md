ad# Krishna Connect
*Where Devotees Unite*

In the spirit of selfless service and shared wisdom, Krishna Connect offers a sacred digital space for our community to come together. It's more than just a chat app; it's a platform for fostering satsang, sharing inspiration, and strengthening our connection to Krishna and to each other.

Built with modern technology, Krishna Connect provides a secure, intuitive, and beautiful environment for meaningful conversations and community growth.

---

## ✨ Features for a Conscious Community

### Satsang in Real-Time
- **One-on-One & Group Chats**: Engage in instantaneous, meaningful conversations with fellow devotees.
- **Community Circles & Channels**: Create and manage public or private groups for focused discussions, study circles, or event coordination. Admins can control history visibility and generate invite links.

### Share Inspirations
- **Rich Media**: Effortlessly share photos, important documents, and audio files with previews and download links.
- **Voice Notes**: Record and send heartfelt voice messages directly within the chat.

### Expressive & Mindful Communication
- **Reactions & Replies**: Share your sentiments on messages with emojis, and reply directly to specific messages to keep conversations clear.
- **Pin & Star Messages**: Keep track of important verses, links, or inspiring words.
- **Edit & Delete**: Communicate mindfully with the ability to edit or delete your messages.
- **Forwarding**: Easily share messages with other devotees or groups.
- **@Mentions**: Bring specific devotees into a conversation in group chats.

### A Space That Feels Like Home
- **Personalize Your Sanctuary**: Customize your chat experience with beautiful themes, bubble colors, and a selection of inspiring wallpapers.
- **Express Yourself Freely**: Utilize a full emoji picker, custom server-side emojis, and beautiful stickers.
- **Light & Dark Mode**: Switch between themes for your comfort, day or night.
- **Desktop Notifications**: Stay connected and never miss an important message.

### Community Gatherings & Events
- **Events System**: Create, share, and RSVP to community events, from online lectures to local meetups.
- **Devotee Profiles**: Learn more about fellow community members and see your shared groups.

### A Safe & Sacred Space
- **Secure Authentication**: Full email/password and OAuth (Google, Facebook) sign-in.
- **Protected DMs**: A moderated system for cross-gender communication, requiring admin approval to foster a safe environment.
- **User Blocking**: Maintain your peace of mind by blocking users if needed.
- **Admin Seva Panel**: A dedicated dashboard for community sevaks (admins) to manage users, review DM requests, and resolve reports.

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router)
- **UI**: React, ShadCN UI, Tailwind CSS
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment**: Vercel

---

## 🚀 Getting Started

Follow these steps to get a local copy up and running for development or contribution.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- A [Supabase](https://supabase.com/) account.
- [Vercel CLI](https://vercel.com/docs/cli) (for deployment)

### 1. Clone the Repository

```bash
git clone https://github.com/Sharmamayankkkk/krishna-connect.git
cd krishna-connect
```

### 2. Set Up Supabase

1.  **Create a Supabase Project**: Go to [supabase.com](https://supabase.com), create a new project, and save your **Project URL** and `public` **anon key**.
2.  **Database Schema**: Go to the **SQL Editor** in your Supabase project dashboard and run the SQL from `supabase/schema.sql` to set up your database tables and policies.
3.  **Clean Database (Optional)**: To start with a clean slate, run the script in `supabase/reset.sql` in the SQL Editor.

### 3. Set Up Environment Variables

Create a file named `.env.local` in the root of your project and add your Supabase credentials. You can copy the example file:

```bash
cp .env.example .env.local
```

Then, fill in the values in `.env.local`:

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

## 🚀 Deployment

This project is optimized for deployment on [Vercel](https://vercel.com).

1.  **Push to GitHub**: Make sure your code is pushed to a GitHub repository.
2.  **Import Project on Vercel**: Import your repository into Vercel. It will automatically detect that you are using Next.js and configure the build settings.
3.  **Add Environment Variables**: In your Vercel project settings, add the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables.
4.  **Deploy**: Vercel will build and deploy your application. Any push to the main branch will trigger a new deployment.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSharmamayankkkk%2Fkrishna-connect&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY)
