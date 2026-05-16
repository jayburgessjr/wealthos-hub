import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronLeft, Leaf, Zap, Shield, Users, Globe } from "lucide-react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import AjeLogo from "@/components/AjeLogo";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: "easeOut" },
  }),
};

const pillars = [
  {
    icon: Leaf,
    title: "Wealth as a living system",
    body: "Money is not a destination — it is energy in motion. AJE is built to keep that energy flowing: compounding, allocating, learning, growing. Like a leaf converting light into life, your capital should be working even when you are not.",
  },
  {
    icon: Zap,
    title: "Intelligence without gatekeeping",
    body: "Institutional-grade research, signal processing, and AI analysis were locked behind $100K minimums and exclusive networks. We believe those tools belong to everyone who is serious about building wealth — not just the already-wealthy.",
  },
  {
    icon: Shield,
    title: "Transparency and trust",
    body: "We are not a broker. We earn nothing on your trades. We hold none of your funds. AJE is an information and decision-support platform — your money stays exactly where you put it. No conflicts of interest. No hidden incentives.",
  },
  {
    icon: Users,
    title: "Community over competition",
    body: "Wealth built in isolation is fragile. AJE is designed to be a platform for shared learning — where signals, strategies, and insights surface across the community so every member lifts the whole.",
  },
  {
    icon: Globe,
    title: "A global philosophy",
    body: "Wealth creation is a universal human endeavor — not the property of any single culture, geography, or class. AJE looks to the full breadth of human wisdom: ancient philosophy, modern mathematics, African spirituality, and Silicon Valley precision.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-36 pb-24">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />
        </div>

        <div className="container px-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <motion.div
            className="mt-12 flex flex-col items-center text-center"
            initial="hidden"
            animate="show"
          >
            <motion.div variants={fadeUp} custom={0}>
              <AjeLogo size={64} className="mx-auto mb-6" />
            </motion.div>

            <motion.p
              variants={fadeUp}
              custom={1}
              className="text-xs font-semibold uppercase tracking-[0.3em] text-primary"
            >
              Our Story
            </motion.p>

            <motion.h1
              variants={fadeUp}
              custom={2}
              className="mt-4 font-display text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl"
            >
              Build Wealth Here.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={3}
              className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
            >
              AJE was born from a simple observation: the tools that compound
              generational wealth are deliberately withheld from the people who
              need them most. We are here to change that.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Alan Watts — wealth philosophy */}
      <section className="border-y border-border/40 bg-card/30 py-20">
        <div className="container px-4">
          <div className="mx-auto max-w-3xl">
            <motion.blockquote
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="absolute -top-4 -left-4 text-7xl leading-none text-primary/20 font-serif select-none">"</div>
              <p className="relative z-10 text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
                You are under no obligation to be the same person you were five
                minutes ago. The only way to make sense out of change is to
                plunge into it, move with it, and join the dance.
              </p>
              <footer className="mt-6 text-sm text-muted-foreground">
                — Alan Watts
              </footer>
            </motion.blockquote>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-12 space-y-5 text-base text-muted-foreground leading-relaxed"
            >
              <p>
                Alan Watts spent his life dismantling the illusion that
                security comes from grasping — from hoarding, from control, from
                anxiety about the future. He argued that the universe is not a
                mechanism to be dominated but a dance to be joined. Wealth, in
                this view, is not the accumulation of numbers. It is the
                expansion of your capacity to participate fully in life.
              </p>
              <p>
                We took that seriously when we built AJE. The goal was never to
                help you stare at a bigger number. The goal is to give you the
                clarity, the confidence, and the tools to make decisions that
                create genuine freedom — time, choice, impact. Wealth as
                instrument, not destination.
              </p>
              <p>
                The market is not an enemy to be defeated. It is a living
                system of human intention, fear, greed, and hope — constantly
                in motion, constantly offering signal to those who know how to
                listen. AJE is your ear to the ground.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why AJE */}
      <section className="py-24">
        <div className="container px-4">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                The Name
              </p>
              <h2 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">
                Why AJE?
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mt-8 space-y-5 text-base text-muted-foreground leading-relaxed"
            >
              <p>
                In Yoruba cosmology — one of West Africa's richest and most
                enduring spiritual traditions — <strong className="text-foreground">Aje</strong> is the orisha
                (divine spirit) of wealth, prosperity, and financial abundance.
                Unlike deities of war or sky or ocean, Aje is specifically and
                exclusively the spirit of money itself. In Yoruba belief, Aje
                does not simply represent wealth: Aje <em>is</em> wealth made
                divine.
              </p>
              <p>
                Worshipped for centuries across Nigeria, Benin, Brazil, Cuba,
                and the African diaspora, Aje is invoked before business
                ventures, investments, and trade — to bless the endeavor with
                flow, abundance, and righteous return. To call on Aje is to
                align yourself with the ancient human understanding that
                prosperity is not luck. It is intention, wisdom, and discipline
                made manifest.
              </p>
              <p>
                We chose this name deliberately. The global financial system
                was not built with African communities in mind. It was built, in
                many cases, at their expense. We wanted a name that acknowledged
                that history — and reclaimed something: the idea that wealth
                creation wisdom runs deep in African culture, long before
                Bloomberg terminals and hedge fund structures.
              </p>
              <p>
                AJE is our offering to that spirit. A platform worthy of the
                name.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-t border-border/40 bg-card/30 py-24">
        <div className="container px-4">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                What We Believe
              </p>
              <h2 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">
                Five pillars.
              </h2>
            </motion.div>

            <div className="mt-12 space-y-10">
              {pillars.map((pillar, i) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="flex gap-5"
                >
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                    <pillar.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      {pillar.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {pillar.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The company */}
      <section className="py-24">
        <div className="container px-4">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                The Company
              </p>
              <h2 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">
                Built by RevSys.
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mt-8 space-y-5 text-base text-muted-foreground leading-relaxed"
            >
              <p>
                AJE is a product of <strong className="text-foreground">RevSys</strong> (Revuity Systems) — a
                technology company focused on building tools that redistribute
                access to sophisticated financial infrastructure.
              </p>
              <p>
                We are a small, focused team of engineers, traders, and
                researchers who have spent years working at the intersection of
                software and markets. We have seen firsthand what institutional
                tools can do — and we have seen firsthand how inaccessible they
                are to everyday investors. AJE is our answer to that gap.
              </p>
              <p>
                We operate independently. We are not affiliated with any broker,
                exchange, or financial institution. We do not take commissions,
                manage funds, or sell order flow. Our only product is AJE.
                Our only incentive is to make it excellent enough that you stay.
              </p>
            </motion.div>

            {/* Trust signals */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {[
                { label: "No broker affiliation", desc: "We earn nothing on your trades" },
                { label: "No fund management", desc: "We never hold or move your money" },
                { label: "No data sales", desc: "Your portfolio data is yours alone" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4"
                >
                  <p className="text-sm font-semibold text-primary">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40 bg-card/30 py-24">
        <div className="container px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="mx-auto max-w-2xl text-center"
          >
            <AjeLogo size={48} className="mx-auto mb-6" />
            <h2 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
              Ready to build?
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Join the platform that treats your wealth ambitions with the
              seriousness they deserve.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                to="/signup"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start for free
              </Link>
              <Link
                to="/"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-8 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Explore the platform
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
