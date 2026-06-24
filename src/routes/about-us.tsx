import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/cinevault";
import { ArrowLeft, Zap, Popcorn, Globe } from "lucide-react";

export const Route = createFileRoute("/about-us")({
  head: () => ({
    title: "About Us — CineVault",
    meta: [
      { name: "description", content: "Learn about CineVault's mission and features" },
    ],
  }),
  component: AboutUs,
});

function AboutUs() {
  const features = [
    {
      icon: Zap,
      title: "Lightning Fast Navigation",
      description: "Clean search & pagination infrastructure engineered for 600+ movies scaling to 5000+. Instant results with zero latency."
    },
    {
      icon: Popcorn,
      title: "Zero Clutter Design",
      description: "Replacing generic movie landing styles with our signature dark cyan cinematic theme. Beautiful, minimal, professional UI."
    },
    {
      icon: Globe,
      title: "Community Connected",
      description: "Direct interactive pipelines to Telegram channels. Stay updated with latest releases, announcements, and exclusive community content."
    }
  ];

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#0b0f19] text-[#F1F5F9] py-12 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <a href="/" className="inline-flex items-center gap-2 text-[#06B6D4] hover:text-[#0891B2] mb-8 font-semibold">
            <ArrowLeft size={18} /> Back to Home
          </a>

          {/* Hero Section */}
          <div className="mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">About CineVault</h1>
            <p className="text-xl text-[#cbd5e1] leading-relaxed max-w-3xl">
              CineVault is a <span className="text-[#06B6D4] font-semibold">premium user-centric platform</span> engineered to streamline digital cinema indexing, bringing 4K, FHD, and WEB-DL media details into a unified clean hub.
            </p>
          </div>

          {/* Mission Block */}
          <div className="bg-gradient-to-r from-[#0D1321] to-[#111827] border border-[rgba(6,182,212,0.3)] rounded-xl p-8 md:p-12 mb-16">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold text-[#06B6D4] mb-6">Our Mission</h2>
              <p className="text-lg text-[#cbd5e1] leading-relaxed">
                To revolutionize how cinema enthusiasts discover, browse, and access premium streaming content. We believe technology should serve users with elegance, speed, and transparency—not clutter and confusion.
              </p>
              <p className="text-lg text-[#cbd5e1] leading-relaxed mt-4">
                Every design decision, every filter, every page transition is crafted with user experience at its core. CineVault isn't just a movie browser; it's a <span className="text-[#06B6D4] font-semibold">cinema concierge for the digital age</span>.
              </p>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-10">Why CineVault?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div key={idx} className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-8 hover:border-[#06B6D4] transition group">
                    <div className="mb-4 inline-block p-3 bg-[rgba(6,182,212,0.1)] rounded-lg group-hover:bg-[rgba(6,182,212,0.2)] transition">
                      <Icon className="text-[#06B6D4]" size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-[#94a3b8] leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Section */}
          <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-xl p-8 md:p-12 mb-16">
            <h2 className="text-3xl font-bold mb-10">By The Numbers</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-[#06B6D4] mb-2">600+</div>
                <p className="text-[#64748B]">Movies Indexed</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#06B6D4] mb-2">4K</div>
                <p className="text-[#64748B]">Max Quality</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#06B6D4] mb-2">20+</div>
                <p className="text-[#64748B]">Categories</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#06B6D4] mb-2">24/7</div>
                <p className="text-[#64748B]">Available</p>
              </div>
            </div>
          </div>

          {/* Values Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-10">Our Core Values</h2>
            <div className="space-y-4">
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-lg p-6">
                <h3 className="text-xl font-bold text-[#06B6D4] mb-2">Transparency</h3>
                <p className="text-[#cbd5e1]">We clearly disclose that CineVault indexes metadata and redirects to third-party repositories. No hidden practices or misleading claims.</p>
              </div>
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-lg p-6">
                <h3 className="text-xl font-bold text-[#06B6D4] mb-2">Compliance</h3>
                <p className="text-[#cbd5e1]">We respect copyright holders and respond to DMCA requests within 24-48 hours. Legal partnership is our priority.</p>
              </div>
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-lg p-6">
                <h3 className="text-xl font-bold text-[#06B6D4] mb-2">User First</h3>
                <p className="text-[#cbd5e1]">Every feature, filter, and interaction is designed around your needs. Performance and UX are never compromised.</p>
              </div>
              <div className="bg-[#0D1321] border border-[rgba(6,182,212,0.3)] rounded-lg p-6">
                <h3 className="text-xl font-bold text-[#06B6D4] mb-2">Innovation</h3>
                <p className="text-[#cbd5e1]">We continuously evolve our platform with smart pagination, advanced filtering, and premium features.</p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-[#06B6D4]/20 to-[#0891B2]/20 border border-[#06B6D4]/30 rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-2xl font-bold mb-4">Join the CineVault Community</h2>
            <p className="text-[#cbd5e1] mb-6 max-w-2xl mx-auto">
              Stay connected with our Telegram channel for exclusive updates, new releases, and premium content announcements.
            </p>
            <a
              href="https://t.me/cinevaultmoviesdownload"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#06B6D4] hover:bg-[#0891B2] text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Join Our Telegram
            </a>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-[rgba(6,182,212,0.2)] text-center text-[#64748B] text-sm">
            <p>© 2026 CineVault. Engineered with passion for cinema enthusiasts worldwide.</p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
