import { Link } from "react-router-dom";
import { Rocket, Github, Twitter, Linkedin } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="border-t border-border/50 bg-background pt-20 pb-10">
      <div className="container px-4">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Rocket className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight">
                WealthOS<span className="text-primary">.</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The AI-powered hub for modern wealth compounding. Institutional-grade tools for individual investors.
            </p>
            <div className="mt-6 flex gap-4">
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider">Product</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="#features" className="transition-colors hover:text-foreground">Features</Link></li>
              <li><Link to="/signals" className="transition-colors hover:text-foreground">Signals</Link></li>
              <li><Link to="/compound" className="transition-colors hover:text-foreground">Compound Engine</Link></li>
              <li><Link to="/ai-advisor" className="transition-colors hover:text-foreground">AI Advisor</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider">Company</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="#" className="transition-colors hover:text-foreground">About</Link></li>
              <li><Link to="#" className="transition-colors hover:text-foreground">Blog</Link></li>
              <li><Link to="#" className="transition-colors hover:text-foreground">Careers</Link></li>
              <li><Link to="#" className="transition-colors hover:text-foreground">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider">Legal</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link></li>
              <li><Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link></li>
              <li><Link to="/disclaimer" className="transition-colors hover:text-foreground">Disclaimer</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-20 border-t border-border/30 pt-8 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} WealthOS Hub. All rights reserved.</p>
          <p className="mt-2">
            WealthOS Hub is for informational and entertainment purposes only,
            not financial, investment, tax, or legal advice. Please consult
            licensed professionals before making decisions.
          </p>
        </div>
      </div>
    </footer>
  );
}
