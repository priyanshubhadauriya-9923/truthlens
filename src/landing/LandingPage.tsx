import { motion } from 'framer-motion';
import { Shield, Zap, Lock, Globe, Cpu, ChevronRight, ExternalLink, BarChart3, Sparkles, Award, Download, CheckCircle } from 'lucide-react';

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl border-b border-white/5" />
      <div className="relative max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield size={18} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">TruthLens</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">Features</a>
          <a href="#privacy" className="text-sm text-slate-300 hover:text-white transition-colors">Privacy</a>
          <a href="#faq" className="text-sm text-slate-300 hover:text-white transition-colors">FAQ</a>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-sm"
          >
            <Download size={14} />
            Install Extension
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-2 gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6"
            >
              <Sparkles size={12} />
              Real-Time Deepfake Detection
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl font-bold text-white leading-tight mb-4"
            >
              See the Truth.{' '}
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                Instantly.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-slate-400 mb-8 leading-relaxed max-w-lg"
            >
              A privacy-first browser extension that detects deepfake images, audio, and video
              in real-time using hybrid AI. Browse with confidence.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center gap-4"
            >
              <a href="#" className="btn-primary text-sm px-6 py-3">
                <Download size={16} />
                Add to Chrome — Free
              </a>
              <a href="#features" className="btn-secondary text-sm px-6 py-3">
                Learn More
                <ChevronRight size={14} />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-6 mt-8 pt-6 border-t border-white/5"
            >
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-xs text-slate-400">No data collection</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-xs text-slate-400">Local-first analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-xs text-slate-400">Open source</span>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="relative glass-card !p-0 overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
                    <Shield size={32} className="text-white" />
                  </div>
                  <p className="text-slate-400 text-sm">Interactive Demo</p>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between bg-slate-800/50">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Globe size={12} />
                  <span>Analyzing media on news.example.com</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Live</span>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Cpu,
      title: 'Hybrid AI Detection',
      desc: 'Lightweight local analysis with optional deep cloud inference for maximum accuracy.',
    },
    {
      icon: Zap,
      title: 'Real-Time Scanning',
      desc: 'Sequential queue processing scans visible media first — no page freeze, no lag.',
    },
    {
      icon: Shield,
      title: 'Privacy First',
      desc: 'All analysis happens locally. Cloud analysis is opt-in only. No tracking.',
    },
    {
      icon: BarChart3,
      title: 'SaaS Dashboard',
      desc: 'Full analytics dashboard with detection history, trends, and domain reputation tracking.',
    },
    {
      icon: Lock,
      title: 'Enterprise Security',
      desc: 'Encrypted storage, monthly auto-cleanup, and granular privacy controls.',
    },
    {
      icon: Award,
      title: 'Trustworthy Scoring',
      desc: 'Probabilistic confidence scores. Never claims absolute certainty.',
    },
  ];

  return (
    <section id="features" className="relative py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/3 to-transparent" />
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-white mb-3">
            Enterprise-Grade Detection
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Powered by EfficientNet forensic classifiers, XceptionNet deepfake detectors,
            and temporal frame analysis — all optimized for browser performance.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card group hover:border-blue-500/20 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon size={20} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BadgePreview() {
  const badges = [
    { label: 'Authentic', confidence: 91, level: 'authentic' },
    { label: 'Suspicious', confidence: 63, level: 'suspicious' },
    { label: 'Deepfake Risk', confidence: 89, level: 'deepfake' },
  ];

  return (
    <section className="relative py-24">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-3">
            Clear, Instant Feedback
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Badges appear directly on media elements — color-coded, animated, and non-intrusive.
          </p>
        </motion.div>

        <div className="flex justify-center gap-8">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`glass-card flex items-center gap-3 px-5 py-3 ${
                badge.level === 'authentic' ? 'hover:border-emerald-500/30' :
                badge.level === 'suspicious' ? 'hover:border-amber-500/30' :
                'hover:border-red-500/30'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${
                badge.level === 'authentic' ? 'bg-emerald-400' :
                badge.level === 'suspicious' ? 'bg-amber-400' :
                'bg-red-400'
              }`} />
              <div>
                <div className="text-sm font-semibold text-white">{badge.label}</div>
                <div className="text-xs text-slate-400">{badge.confidence}% confidence</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section id="privacy" className="relative py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/3 to-transparent" />
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-16 items-center"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
              <Lock size={12} />
              Privacy-First Architecture
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Your Data Never Leaves Your Browser
            </h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              TruthLens is built on a privacy-first principle. All primary analysis runs locally
              using WebGPU-accelerated inference. Cloud analysis is strictly opt-in and
              media is anonymized before transmission.
            </p>
            <ul className="space-y-3">
              {[
                'No browsing history tracking',
                'Media never uploaded without consent',
                'Encrypted local storage with auto-cleanup',
                'Open source and auditable',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card !p-6"
          >
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Detection Flow</h3>
            <div className="space-y-4">
              {[
                { step: '1', label: 'Media Detected', desc: 'Extension identifies visible images, videos, and audio' },
                { step: '2', label: 'Local Analysis', desc: 'Heuristic checks + ONNX inference in-browser' },
                { step: '3', label: 'Confidence Score', desc: 'Probabilistic risk classification' },
                { step: '4', label: 'Badge Rendered', desc: 'Non-intrusive badge with result and confidence' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs text-blue-400 font-bold flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">{item.label}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative py-24">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card !p-12 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-3">
              Start Detecting Deepfakes Today
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto mb-8">
              Free to use. Privacy-first. Open source.
              Available for Chrome and Chromium-based browsers.
            </p>
            <div className="flex items-center justify-center gap-4">
              <a href="#" className="btn-primary px-8 py-3">
                <Download size={16} />
                Add to Chrome — Free
              </a>
              <a href="#" className="btn-secondary px-8 py-3">
                <ExternalLink size={16} />
                View on GitHub
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-400" />
            <span className="text-sm font-semibold text-white">TruthLens</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <a href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="https://github.com/truthlens" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">GitHub</a>
            <span>&copy; 2026 TruthLens</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <Hero />
      <Features />
      <BadgePreview />
      <Privacy />
      <CTA />
      <Footer />
    </div>
  );
}
