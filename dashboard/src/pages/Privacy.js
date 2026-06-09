import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { ArrowLeft, Shield } from '../components/Icons';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-[#222]">
        <div className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <Logo size={32} />
            <span className="text-xl font-bold tracking-wider" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '12px' }}>
              VelocityBrain
            </span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </button>
        </div>
      </nav>

      {/* Privacy Content */}
      <div className="pt-24 pb-16 px-6 max-w-4xl mx-auto">
        <div className="mb-12">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="h-8 w-8 text-[#EA803A]" />
            <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
          </div>
          <p className="text-xl text-zinc-400">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Information We Collect</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              VelocityBrain collects the following types of information:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
              <li>Account information (email, name)</li>
              <li>API usage metrics and analytics</li>
              <li>System logs and audit trails</li>
              <li>Configuration data for your VelocityBrain instance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">How We Use Your Information</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              We use your information to:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
              <li>Provide and improve our services</li>
              <li>Process API requests and manage your account</li>
              <li>Monitor system performance and security</li>
              <li>Send important notifications about your account</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Data Security</h2>
            <p className="text-zinc-400 leading-relaxed">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4 mt-4">
              <li>Encryption at rest and in transit</li>
              <li>Secure authentication with OAuth and API keys</li>
              <li>Regular security audits and penetration testing</li>
              <li>Access controls and audit logging</li>
              <li>Compliance with GDPR, CCPA, and other regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Data Retention</h2>
            <p className="text-zinc-400 leading-relaxed">
              We retain your data for as long as necessary to provide our services and comply with legal obligations. You can request deletion of your account and associated data at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Third-Party Services</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              VelocityBrain integrates with third-party services for authentication and functionality:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
              <li>GitHub OAuth for authentication</li>
              <li>Google OAuth for authentication</li>
              <li>Appwrite Cloud for authentication, database, and storage</li>
            </ul>
            <p className="text-zinc-400 leading-relaxed mt-4">
              These services have their own privacy policies which we encourage you to review.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Your Rights</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Export your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
            <p className="text-zinc-400 leading-relaxed">
              If you have questions about this privacy policy or our data practices, please contact us through our support channels or via email.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
