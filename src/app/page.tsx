import { redirect } from 'next/navigation';

export default function Home() {
  // The root page now redirects to the main chat interface.
  // The app layout will handle authentication and redirect to /login if needed.
  redirect('/chat');
  return null;
}
