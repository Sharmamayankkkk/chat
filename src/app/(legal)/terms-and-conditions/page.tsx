
import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions | Krishna Connect',
  description: 'Terms and Conditions for Krishna Connect.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Terms and Conditions</h1>
      <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <h2>1. Agreement to Terms</h2>
      <p>
        By using our application, you agree to be bound by these Terms and Conditions. If you do not agree to these Terms and Conditions, you may not use the application.
      </p>

      <h2>2. User Accounts</h2>
      <p>
        When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
      </p>

      <h2>3. Prohibited Activities</h2>
      <p>
        You may not access or use the Service for any purpose other than that for which we make the Service available. As a user of the Service, you agree not to:
      </p>
      <ul>
        <li>Systematically retrieve data or other content from the Service to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.</li>
        <li>Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.</li>
        <li>Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Service to you.</li>
      </ul>

      <h2>4. Intellectual Property Rights</h2>
      <p>
        Unless otherwise indicated, the Service is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Service are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.
      </p>

      <h2>5. Termination</h2>
      <p>
        We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms and Conditions.
      </p>

      <h2>6. Governing Law</h2>
      <p>
        These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which the company is based, without regard to its conflict of law provisions.
      </p>
      
      <h2>7. Contact Us</h2>
      <p>
        If you have any questions about these Terms, please contact us.
      </p>
    </div>
  );
}
