import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { ArrowLeft, FileText } from '../components/Icons';

const Terms = () => {
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

      {/* Terms Content */}
      <div className="pt-24 pb-16 px-6 max-w-4xl mx-auto">
        <div className="mb-12">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="h-8 w-8 text-[#EA803A]" />
            <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
          </div>
          <p className="text-xl text-zinc-400">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Acceptance of Terms</h2>
            <p className="text-zinc-400 leading-relaxed">
              By accessing or using VelocityBrain, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Description of Service</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              VelocityBrain is an AI agent memory and execution engine that provides:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
              <li>Context management and retrieval for AI agents</li>
              <li>Skill execution and workflow automation</li>
              <li>MCP (Model Context Protocol) server functionality</li>
              <li>API key management and analytics</li>
              <li>Enterprise-grade security and monitoring</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">User Responsibilities</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              As a user of VelocityBrain, you agree to:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Use the service in compliance with applicable laws</li>
              <li>Not attempt to circumvent security measures</li>
              <li>Not use the service for malicious purposes</li>
              <li>Respect rate limits and fair usage policies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Account Security</h2>
            <p className="text-zinc-400 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">API Usage and Rate Limits</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              API usage is subject to rate limits and fair usage policies:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
              <li>VelocityBrain is currently free for everyone for a limited time</li>
              <li>Usage limits still apply to accounts and API keys</li>
              <li>Excessive usage may result in throttling</li>
              <li>Limits and access policies may change as the service evolves</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Free Access Window</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              VelocityBrain is being offered at no charge during the current access window:
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2 ml-4">
              <li>We may introduce pricing or revised usage limits in the future</li>
              <li>Any material pricing changes will be communicated in advance</li>
              <li>Continued access remains subject to these Terms and fair usage policies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Intellectual Property</h2>
            <p className="text-zinc-400 leading-relaxed">
              VelocityBrain and its original content, features, and functionality are owned by VelocityBrain and are protected by international copyright, trademark, and other intellectual property laws. You retain ownership of any data you input into the system.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Disclaimer of Warranties</h2>
            <p className="text-zinc-400 leading-relaxed">
              VelocityBrain is provided "as is" without warranties of any kind, either express or implied. We do not guarantee that the service will be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Limitation of Liability</h2>
            <p className="text-zinc-400 leading-relaxed">
              To the maximum extent permitted by law, VelocityBrain shall not be liable for any indirect, incidental, special, or consequential damages resulting from the use or inability to use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Termination</h2>
            <p className="text-zinc-400 leading-relaxed">
              We reserve the right to suspend or terminate your account at any time for violation of these terms or for any other reason at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Governing Law</h2>
            <p className="text-zinc-400 leading-relaxed">
              These terms shall be governed by and construed in accordance with applicable laws. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts in the applicable jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Changes to Terms</h2>
            <p className="text-zinc-400 leading-relaxed">
              We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact Information</h2>
            <p className="text-zinc-400 leading-relaxed">
              If you have questions about these Terms of Service, please contact us through our support channels.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
