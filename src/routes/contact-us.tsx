import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/cinevault";
import { ArrowLeft, AlertCircle, Send, Mail, Copy, Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/contact-us")({
  head: () => ({
    title: "Contact Us — CineVault",
    meta: [
      { name: "description", content: "Get in touch with CineVault for support and inquiries" },
    ],
  }),
  component: ContactUs,
});

function ContactUs() {
  const [emailCopied, setEmailCopied] = useState(false);
  
  const businessEmail = "legal@cinevault.to";

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(businessEmail);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#0b0f19] text-[#F1F5F9] py-12 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Back Button */}
          <a href="/" className="inline-flex items-center gap-2 text-[#06B6D4] hover:text-[#0891B2] mb-8 font-semibold">
            <ArrowLeft size={18} /> Back to Home
          </a>

          {/* Header */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">Get in Touch</h1>
            <p className="text-xl text-[#cbd5e1]">
              Questions, copyright concerns, or partnership inquiries? We're here to help.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: DMCA Notice */}
            <div>
              <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.5)] rounded-xl p-8 sticky top-24">
                <div className="flex items-start gap-4">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={28} />
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-4">DMCA & Copyright Removal</h2>
                    <div className="space-y-4 text-[#cbd5e1]">
                      <p className="font-semibold text-red-400">
                        ⚠️ For immediate copyright removal requests, please:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-sm">
                        <li>Mention the exact <strong>Movie Title</strong> or <strong>Movie ID</strong></li>
                        <li>Provide your <strong>Copyright Owner details</strong></li>
                        <li>Include <strong>authorization proof</strong> (if applicable)</li>
                        <li>Specify the <strong>link(s) to be removed</strong></li>
                      </ul>
                      <p className="border-t border-[rgba(239,68,68,0.3)] pt-4 mt-4 text-xs">
                        <strong>⏱️ Response Time:</strong> Valid DMCA requests will be processed within <span className="text-red-400 font-bold">24-48 hours</span>.
                      </p>
                      <p className="bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded text-xs border border-[rgba(239,68,68,0.3)]">
                        Escalate your case using the email contact below.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Action Cards */}
            <div className="space-y-6">
              {/* Telegram Card */}
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-8 hover:border-[#06B6D4] transition group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-[rgba(6,182,212,0.1)] rounded-lg group-hover:bg-[rgba(6,182,212,0.2)] transition">
                    <Send className="text-[#06B6D4]" size={28} />
                  </div>
                  <h3 className="text-2xl font-bold">Official Telegram</h3>
                </div>
                <p className="text-[#94a3b8] mb-6">
                  Join our community for instant support, announcements, and direct interaction with the CineVault team.
                </p>
                <a
                  href="https://t.me/cinevaultmoviesdownload"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-[#06B6D4] hover:bg-[#0891B2] text-white px-6 py-3 rounded-lg font-semibold transition w-full justify-center"
                >
                  <Send size={18} /> Join Telegram Channel
                </a>
              </div>

              {/* WhatsApp Card */}
              <div className="bg-[#0D1321] border border-[rgba(16,185,129,0.25)] rounded-xl p-8 hover:border-[#10B981] transition group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-[rgba(16,185,129,0.1)] rounded-lg group-hover:bg-[rgba(16,185,129,0.2)] transition">
                    <Send className="text-[#10B981]" size={28} />
                  </div>
                  <h3 className="text-2xl font-bold">WhatsApp Channel</h3>
                </div>
                <p className="text-[#94a3b8] mb-6">
                  Join our WhatsApp channel for updates, new releases, and quick announcements.
                </p>
                <a
                  href="https://whatsapp.com/channel/0029VbCs1JSK5cDCl6uOzP3L"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white px-6 py-3 rounded-lg font-semibold transition w-full justify-center"
                >
                  <Send size={18} /> Join WhatsApp Channel
                </a>
              </div>

              {/* Email Card */}
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-8 hover:border-[#06B6D4] transition group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-[rgba(6,182,212,0.1)] rounded-lg group-hover:bg-[rgba(6,182,212,0.2)] transition">
                    <Mail className="text-[#06B6D4]" size={28} />
                  </div>
                  <h3 className="text-2xl font-bold">Business Email</h3>
                </div>
                <p className="text-[#94a3b8] mb-4">
                  For formal inquiries, copyright notices, and partnership requests.
                </p>
                <div className="bg-[#111827] border border-[rgba(6,182,212,0.2)] rounded-lg p-4 flex items-center justify-between group/email">
                  <div className="flex flex-col">
                    <span className="text-xs text-[#64748B]">Email Address</span>
                    <span className="text-[#06B6D4] font-mono font-semibold">{businessEmail}</span>
                  </div>
                  <button
                    onClick={handleCopyEmail}
                    className="p-2 hover:bg-[rgba(6,182,212,0.2)] rounded transition"
                    title="Copy email"
                  >
                    {emailCopied ? (
                      <Check className="text-green-500" size={20} />
                    ) : (
                      <Copy className="text-[#06B6D4]" size={20} />
                    )}
                  </button>
                </div>
                <p className="text-xs text-[#64748B] mt-3">
                  Click the icon to copy email address to clipboard.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Categories */}
          <div className="mt-16">
            <h2 className="text-3xl font-bold mb-8">How We Can Help</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-6">
                <h3 className="text-lg font-bold text-[#06B6D4] mb-3">General Support</h3>
                <p className="text-[#cbd5e1] text-sm">
                  Technical issues, bug reports, or feature requests? Contact us via Telegram for fastest response.
                </p>
              </div>
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-6">
                <h3 className="text-lg font-bold text-[#06B6D4] mb-3">Copyright Issues</h3>
                <p className="text-[#cbd5e1] text-sm">
                  DMCA takedown notices and copyright inquiries must be sent to our legal email with proper documentation.
                </p>
              </div>
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-6">
                <h3 className="text-lg font-bold text-[#06B6D4] mb-3">Partnerships</h3>
                <p className="text-[#cbd5e1] text-sm">
                  Interested in collaborating? Reach out via email to discuss potential business opportunities.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16">
            <h2 className="text-3xl font-bold mb-8">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <details className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-lg p-6 cursor-pointer group">
                <summary className="font-bold text-[#06B6D4] flex items-center justify-between">
                  How do I report a copyright issue?
                  <span className="group-open:rotate-180 transition">▼</span>
                </summary>
                <p className="text-[#cbd5e1] mt-4 text-sm">
                  Send a detailed DMCA notice to our legal email with the movie title/ID, copyright holder details, and authorization proof. We respond within 24-48 hours.
                </p>
              </details>
              <details className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-lg p-6 cursor-pointer group">
                <summary className="font-bold text-[#06B6D4] flex items-center justify-between">
                  Is CineVault a legal platform?
                  <span className="group-open:rotate-180 transition">▼</span>
                </summary>
                <p className="text-[#cbd5e1] mt-4 text-sm">
                  CineVault is a metadata indexing platform. We do not host media files on our servers. Third-party content availability depends on your jurisdiction and local laws. We recommend using a VPN and reviewing applicable copyright laws.
                </p>
              </details>
              <details className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-lg p-6 cursor-pointer group">
                <summary className="font-bold text-[#06B6D4] flex items-center justify-between">
                  Can I suggest a feature?
                  <span className="group-open:rotate-180 transition">▼</span>
                </summary>
                <p className="text-[#cbd5e1] mt-4 text-sm">
                  Absolutely! Join our Telegram channel and share your ideas. We actively listen to community feedback and implement popular feature requests regularly.
                </p>
              </details>
              <details className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-lg p-6 cursor-pointer group">
                <summary className="font-bold text-[#06B6D4] flex items-center justify-between">
                  What's your response time for inquiries?
                  <span className="group-open:rotate-180 transition">▼</span>
                </summary>
                <p className="text-[#cbd5e1] mt-4 text-sm">
                  Telegram: 1-2 hours during business hours. Email: 24-48 hours for all inquiries. DMCA requests receive priority handling.
                </p>
              </details>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-[rgba(6,182,212,0.2)] text-center text-[#64748B] text-sm">
            <p>© 2026 CineVault. All inquiries are handled confidentially and professionally.</p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
