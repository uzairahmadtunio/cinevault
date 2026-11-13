import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/cinevault";
import { ArrowLeft, Lock, Link as LinkIcon, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    title: "Privacy Policy — CineVault",
    meta: [
      { name: "description", content: "CineVault Privacy Policy and data handling practices" },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <SiteShell>
      <div className="min-h-screen bg-[#0b0f19] text-[#F1F5F9] py-12 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <a href="/" className="inline-flex items-center gap-2 text-[#06B6D4] hover:text-[#0891B2] mb-8 font-semibold">
            <ArrowLeft size={18} /> Back to Home
          </a>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="text-[#06B6D4]" size={32} />
              <h1 className="text-4xl md:text-5xl font-bold">Privacy Policy</h1>
            </div>
            <p className="text-[#64748B] text-lg">Last Updated: June 2026</p>
          </div>

          {/* Content Sections */}
          <div className="space-y-6">
            {/* Section 1: Information Collection */}
            <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-[#06B6D4] mb-4 flex items-center gap-2">
                <LinkIcon size={24} /> Information Collection
              </h2>
              <div className="space-y-3 text-[#cbd5e1] leading-relaxed">
                <p>
                  CineVault does <span className="text-[#06B6D4] font-semibold">not directly log personal identities</span> or store personally identifiable information on our servers. We operate as a metadata indexing platform without user registration requirements.
                </p>
                <p className="border-l-4 border-[#06B6D4] pl-4 text-sm">
                  <strong className="text-[#06B6D4]">Analytics & Cookies:</strong> Standard analytics tracking and cookies may be deployed by third-party providers (e.g., Google Analytics) to understand user behavior and platform performance. These are industry-standard practices for web optimization.
                </p>
                <p className="border-l-4 border-[#06B6D4] pl-4 text-sm">
                  <strong className="text-[#06B6D4]">Ad Networks:</strong> Our platform may display advertisements through third-party ad providers (including pop-under networks and Google AdSense). These providers may collect data for targeted advertising purposes. Please review their privacy policies directly.
                </p>
              </div>
            </div>

            {/* Section 2: Third-Party Links */}
            <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-[#06B6D4] mb-4 flex items-center gap-2">
                <LinkIcon size={24} /> Third-Party External Links & Content
              </h2>
              <div className="space-y-3 text-[#cbd5e1] leading-relaxed">
                <p>
                  CineVault operates as a <span className="text-[#06B6D4] font-semibold">premium metadata indexing platform</span>. We index streaming metadata, availability information, and technical specifications for digital cinema content across global repositories.
                </p>
                <p>
                  <strong className="text-[#06B6D4]">Important Clarification:</strong> CineVault does <span className="font-semibold">NOT host</span> raw media files, video streams, or audio content on our infrastructure. All download links redirect users to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>Third-party file repositories (HubCloud, GDFlix, similar platforms)</li>
                  <li>CDN-hosted streaming services</li>
                  <li>Cloud storage partnerships</li>
                </ul>
                <p className="border-l-4 border-yellow-600 pl-4 text-sm bg-[rgba(180,83,9,0.1)]">
                  <strong className="text-yellow-500">⚠️ External Responsibility:</strong> We are not responsible for content hosted on third-party platforms. Please review their terms of service and privacy policies.
                </p>
              </div>
            </div>

            {/* Section 3: DMCA & Copyright */}
            <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-[#06B6D4] mb-4 flex items-center gap-2">
                <AlertCircle size={24} /> DMCA & Copyright Compliance
              </h2>
              <div className="space-y-3 text-[#cbd5e1] leading-relaxed">
                <p>
                  CineVault respects intellectual property rights and fully complies with the Digital Millennium Copyright Act (DMCA) and applicable international copyright laws.
                </p>
                <p className="font-semibold text-white">
                  Copyright owners and their authorized representatives can request immediate removal of indexed content:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>Provide the specific movie title or CineVault Movie ID</li>
                  <li>Include copyright holder details and authorization proof</li>
                  <li>Specify the link(s) to be removed</li>
                  <li>Contact our legal department (details in Contact Us page)</li>
                </ul>
                <p className="border-l-4 border-[#06B6D4] pl-4 bg-[rgba(6,182,212,0.1)]">
                  <strong className="text-[#06B6D4]">Response Guarantee:</strong> Valid DMCA takedown requests will be processed and metadata removed from our index within <span className="font-semibold">24-48 hours</span>.
                </p>
              </div>
            </div>

            {/* Section 4: User Responsibilities */}
            <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-[#06B6D4] mb-4">User Responsibilities</h2>
              <div className="space-y-3 text-[#cbd5e1] leading-relaxed">
                <p>
                  Users accessing CineVault agree to comply with all applicable laws and regulations in their jurisdiction. By using our platform, you acknowledge:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>You are responsible for verifying content rights in your region</li>
                  <li>CineVault does not endorse or verify copyright status of external content</li>
                  <li>Use of our service is at your own legal risk</li>
                  <li>We recommend using a VPN for privacy when accessing third-party content</li>
                </ul>
              </div>
            </div>

            {/* Section 5: Contact */}
            <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-[#06B6D4] mb-4">Questions About This Policy?</h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                For privacy inquiries, DMCA requests, or policy clarifications, please visit our <a href="/contact-us" className="text-[#06B6D4] hover:text-[#0891B2] font-semibold underline">Contact Us</a> page.
              </p>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="mt-12 pt-8 border-t border-[rgba(6,182,212,0.2)] text-center text-[#64748B] text-sm">
            <p>© 2026 CineVault. All rights reserved. This Privacy Policy is subject to change without notice.</p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
