
import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Krishna Connect',
  description: 'Privacy Policy for Krishna Connect.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <h2>1. Introduction</h2>
      <p>
        Welcome to Krishna Connect. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
      </p>

      <h2>2. Information We Collect</h2>
      <p>
        We may collect information about you in a variety of ways. The information we may collect on the Service includes:
      </p>
      <ul>
        <li>
          <strong>Personal Data:</strong> Personally identifiable information, such as your name, username, email address, and demographic information, that you voluntarily give to us when you register with the Service.
        </li>
        <li>
          <strong>Derivative Data:</strong> Information our servers automatically collect when you access the Service, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Service.
        </li>
      </ul>

      <h2>3. Use of Your Information</h2>
      <p>
        Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Service to:
      </p>
      <ul>
        <li>Create and manage your account.</li>
        <li>Email you regarding your account or order.</li>
        <li>Enable user-to-user communications.</li>
        <li>Monitor and analyze usage and trends to improve your experience with the Service.</li>
      </ul>

      <h2>4. Disclosure of Your Information</h2>
      <p>
        We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
      </p>
      <ul>
        <li>
          <strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.
        </li>
      </ul>

      <h2>5. Security of Your Information</h2>
      <p>
        We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
      </p>
      
      <h2>6. Contact Us</h2>
      <p>
        If you have questions or comments about this Privacy Policy, please contact us.
      </p>
    </div>
  );
}
